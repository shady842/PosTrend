import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TenantContext } from "../auth/types/tenant-context.type";
import { PrismaService } from "../database/prisma.service";
import {
  AccountingReportQueryDto,
  CreateApBillDto,
  CreateArInvoiceDto,
  CreateChartOfAccountDto,
  CreateJournalEntryDto,
  ListJournalEntriesDto,
  UpdateJournalEntryDto
} from "./dto/accounting.dto";

type PostingContext = {
  tenantId: string;
  conceptId: string;
  branchId: string;
  orderId: string;
  total: number;
  tax: number;
  actorId?: string;
};

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  private postedOnly(q: AccountingReportQueryDto) {
    if (String(q.posted_only || "").toLowerCase() === "false") return false;
    return true;
  }

  private dateRange(q: AccountingReportQueryDto) {
    return {
      from: q.date_from ? new Date(q.date_from) : null,
      to: q.date_to ? new Date(q.date_to) : null
    };
  }

  private async reportLines(ctx: TenantContext, q: AccountingReportQueryDto) {
    const postedOnly = this.postedOnly(q);
    const { from, to } = this.dateRange(q);

    return this.prisma.journalLine.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        ...(q.branch_id ? { branchId: q.branch_id } : { OR: [{ branchId: ctx.branch_id }, { branchId: null }] }),
        ...(q.account_id ? { accountId: q.account_id } : {}),
        entry: {
          tenantId: ctx.tenant_id,
          conceptId: ctx.concept_id,
          ...(postedOnly ? { postedAt: { not: null } } : {}),
          ...(from || to
            ? {
                date: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {})
                }
              }
            : {})
        }
      },
      include: { account: true, entry: true },
      orderBy: [{ entry: { date: "asc" } }, { createdAt: "asc" }]
    });
  }

  async getChartOfAccounts(ctx: TenantContext) {
    return this.prisma.chartOfAccount.findMany({
      where: { tenantId: ctx.tenant_id, OR: [{ branchId: ctx.branch_id }, { branchId: null }] },
      orderBy: [{ code: "asc" }]
    });
  }

  async createChartOfAccount(ctx: TenantContext, dto: CreateChartOfAccountDto) {
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    if (!code || !name) throw new BadRequestException("Code and name are required");

    if (dto.parent_id) {
      const p = await this.prisma.chartOfAccount.findFirst({
        where: { id: dto.parent_id, tenantId: ctx.tenant_id }
      });
      if (!p) throw new BadRequestException("Parent account not found");
    }

    const row = await this.prisma.chartOfAccount.create({
      data: {
        tenantId: ctx.tenant_id,
        branchId: dto.concept_wide ? null : ctx.branch_id,
        code,
        name,
        type: dto.type,
        parentId: dto.parent_id || null
      }
    });
    await this.audit(ctx, "coa_created", "chart_of_account", row.id, {
      code: row.code,
      type: row.type
    });
    return row;
  }

  async createJournalEntry(ctx: TenantContext, dto: CreateJournalEntryDto) {
    const totalDebit = dto.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = dto.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.0001) {
      throw new BadRequestException("Journal entry is not balanced");
    }
    const entry = await this.prisma.journalEntry.create({
      data: {
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: dto.branch_id || ctx.branch_id,
        date: new Date(dto.date),
        description: dto.description,
        totalDebit,
        totalCredit,
        createdBy: dto.created_by,
        postedAt: null,
        lines: {
          create: dto.lines.map((line) => ({
            tenantId: ctx.tenant_id,
            conceptId: ctx.concept_id,
            branchId: dto.branch_id || ctx.branch_id,
            accountId: line.account_id,
            accountCode: line.account_code,
            debit: line.debit,
            credit: line.credit,
            referenceType: line.reference_type,
            referenceId: line.reference_id
          }))
        }
      },
      include: { lines: true }
    });
    await this.audit(ctx, "journal_entry_created", "journal_entry", entry.id, {
      total_debit: totalDebit,
      total_credit: totalCredit
    });
    return entry;
  }

  async listJournalEntries(ctx: TenantContext, q: ListJournalEntriesDto) {
    const where: Prisma.JournalEntryWhereInput = {
      tenantId: ctx.tenant_id,
      conceptId: ctx.concept_id,
      ...(q.branch_id ? { branchId: q.branch_id } : { OR: [{ branchId: ctx.branch_id }, { branchId: null }] })
    };
    if (q.posted === true) where.postedAt = { not: null };
    if (q.posted === false) where.postedAt = null;
    if (q.date_from || q.date_to) {
      where.date = {
        ...(q.date_from ? { gte: new Date(q.date_from) } : {}),
        ...(q.date_to ? { lte: new Date(q.date_to) } : {})
      };
    }
    if (q.q) {
      const s = q.q.trim();
      if (s) {
        where.OR = [
          ...(where.OR || []),
          { description: { contains: s, mode: "insensitive" } },
          { createdBy: { contains: s, mode: "insensitive" } },
          { refType: { contains: s, mode: "insensitive" } },
          { refId: { contains: s, mode: "insensitive" } }
        ];
      }
    }
    const rows = await this.prisma.journalEntry.findMany({
      where,
      include: { lines: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200
    });
    return rows;
  }

  async getJournalEntry(ctx: TenantContext, id: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, tenantId: ctx.tenant_id, OR: [{ branchId: ctx.branch_id }, { branchId: null }] },
      include: { lines: true }
    });
    if (!entry) throw new NotFoundException("Journal entry not found");
    return entry;
  }

  async updateJournalEntry(ctx: TenantContext, id: string, dto: UpdateJournalEntryDto) {
    const existing = await this.prisma.journalEntry.findFirst({
      where: { id, tenantId: ctx.tenant_id, conceptId: ctx.concept_id, OR: [{ branchId: ctx.branch_id }, { branchId: null }] },
      include: { lines: true }
    });
    if (!existing) throw new NotFoundException("Journal entry not found");
    if (existing.postedAt) throw new BadRequestException("Cannot edit a posted entry (unpost first)");
    if (existing.refType) throw new BadRequestException("Auto-posted entries cannot be edited");

    const totalDebit = dto.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = dto.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.0001) {
      throw new BadRequestException("Journal entry is not balanced");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.journalLine.deleteMany({ where: { entryId: existing.id } });
      const entry = await tx.journalEntry.update({
        where: { id: existing.id },
        data: {
          branchId: dto.branch_id || existing.branchId,
          date: new Date(dto.date),
          description: dto.description,
          totalDebit,
          totalCredit,
          createdBy: dto.created_by,
          lines: {
            create: dto.lines.map((line) => ({
              tenantId: ctx.tenant_id,
              conceptId: ctx.concept_id,
              branchId: dto.branch_id || existing.branchId || ctx.branch_id,
              accountId: line.account_id,
              accountCode: line.account_code,
              debit: line.debit,
              credit: line.credit,
              referenceType: line.reference_type,
              referenceId: line.reference_id
            }))
          }
        },
        include: { lines: true }
      });
      await this.audit(ctx, "journal_entry_updated", "journal_entry", entry.id, {
        total_debit: totalDebit,
        total_credit: totalCredit
      });
      return entry;
    });
  }

  async postJournalEntry(ctx: TenantContext, id: string) {
    const entry = await this.getJournalEntry(ctx, id);
    if (entry.postedAt) return entry;
    const updated = await this.prisma.journalEntry.update({
      where: { id: entry.id },
      data: { postedAt: new Date() },
      include: { lines: true }
    });
    await this.audit(ctx, "journal_entry_posted", "journal_entry", updated.id);
    return updated;
  }

  async unpostJournalEntry(ctx: TenantContext, id: string) {
    const entry = await this.getJournalEntry(ctx, id);
    if (entry.refType) throw new BadRequestException("Auto-posted entries cannot be unposted");
    if (!entry.postedAt) return entry;
    const updated = await this.prisma.journalEntry.update({
      where: { id: entry.id },
      data: { postedAt: null },
      include: { lines: true }
    });
    await this.audit(ctx, "journal_entry_unposted", "journal_entry", updated.id);
    return updated;
  }

  async createArInvoice(ctx: TenantContext, dto: CreateArInvoiceDto) {
    const invoice = await this.prisma.arInvoice.create({
      data: {
        tenantId: ctx.tenant_id,
        branchId: ctx.branch_id,
        customerId: dto.customer_id,
        invoiceNo: dto.invoice_no,
        amount: dto.amount,
        status: dto.status,
        dueDate: new Date(dto.due_date)
      }
    });
    await this.audit(ctx, "ar_invoice_created", "ar_invoice", invoice.id, {
      invoice_no: dto.invoice_no,
      amount: dto.amount
    });
    return invoice;
  }

  async createApBill(ctx: TenantContext, dto: CreateApBillDto) {
    const bill = await this.prisma.apBill.create({
      data: {
        tenantId: ctx.tenant_id,
        branchId: ctx.branch_id,
        vendorId: dto.vendor_id,
        billNo: dto.bill_no,
        amount: dto.amount,
        status: dto.status,
        dueDate: new Date(dto.due_date)
      }
    });
    await this.audit(ctx, "ap_bill_created", "ap_bill", bill.id, {
      bill_no: dto.bill_no,
      amount: dto.amount
    });
    return bill;
  }

  async listArInvoices(ctx: TenantContext, status?: string) {
    return this.prisma.arInvoice.findMany({
      where: {
        tenantId: ctx.tenant_id,
        branchId: ctx.branch_id,
        ...(status ? { status } : {})
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }

  async listApBills(ctx: TenantContext, status?: string) {
    return this.prisma.apBill.findMany({
      where: {
        tenantId: ctx.tenant_id,
        branchId: ctx.branch_id,
        ...(status ? { status } : {})
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }

  async getTrialBalance(ctx: TenantContext, q: AccountingReportQueryDto) {
    const lines = await this.reportLines(ctx, q);
    const map = new Map<string, { account_id: string; code: string; name: string; type: string; debit: number; credit: number }>();
    for (const l of lines) {
      const accId = l.accountId || l.account?.id || "unknown";
      const code = l.accountCode || l.account?.code || "—";
      const name = l.account?.name || "Unknown";
      const type = l.account?.type || "UNKNOWN";
      const key = `${accId}:${code}`;
      const row = map.get(key) || { account_id: accId, code, name, type, debit: 0, credit: 0 };
      row.debit += Number(l.debit);
      row.credit += Number(l.credit);
      map.set(key, row);
    }
    const rows = [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
    const total_debit = rows.reduce((s, r) => s + r.debit, 0);
    const total_credit = rows.reduce((s, r) => s + r.credit, 0);
    return { rows, total_debit, total_credit };
  }

  async getGeneralLedger(ctx: TenantContext, q: AccountingReportQueryDto) {
    const lines = await this.reportLines(ctx, q);
    // group by accountCode for the UI; include running balance per account
    const groups = new Map<
      string,
      { account_code: string; account_id: string | null; name: string; type: string; rows: any[]; debit: number; credit: number }
    >();
    for (const l of lines) {
      const code = l.accountCode || l.account?.code || "—";
      const name = l.account?.name || "Unknown";
      const type = l.account?.type || "UNKNOWN";
      const g = groups.get(code) || { account_code: code, account_id: l.accountId || null, name, type, rows: [], debit: 0, credit: 0 };
      g.debit += Number(l.debit);
      g.credit += Number(l.credit);
      g.rows.push({
        id: l.id,
        date: l.entry.date,
        entry_id: l.entryId,
        description: l.entry.description,
        debit: Number(l.debit),
        credit: Number(l.credit),
        ref_type: l.entry.refType,
        ref_id: l.entry.refId
      });
      groups.set(code, g);
    }
    const result = [...groups.values()].sort((a, b) => a.account_code.localeCompare(b.account_code));
    return { groups: result };
  }

  async getProfitLoss(ctx: TenantContext, q: AccountingReportQueryDto) {
    const tb = await this.getTrialBalance(ctx, q);
    const income = tb.rows.filter((r) => String(r.type).toUpperCase() === "INCOME").reduce((s, r) => s + (r.credit - r.debit), 0);
    const expenses = tb.rows.filter((r) => String(r.type).toUpperCase() === "EXPENSE").reduce((s, r) => s + (r.debit - r.credit), 0);
    const gross = income - expenses;
    return { income, expenses, net_profit: gross, rows: tb.rows.filter((r) => ["INCOME", "EXPENSE"].includes(String(r.type).toUpperCase())) };
  }

  async getBalanceSheet(ctx: TenantContext, q: AccountingReportQueryDto) {
    const tb = await this.getTrialBalance(ctx, q);
    const assets = tb.rows.filter((r) => String(r.type).toUpperCase() === "ASSET").map((r) => ({ ...r, balance: r.debit - r.credit }));
    const liabilities = tb.rows.filter((r) => String(r.type).toUpperCase() === "LIABILITY").map((r) => ({ ...r, balance: r.credit - r.debit }));
    const equity = tb.rows.filter((r) => String(r.type).toUpperCase() === "EQUITY").map((r) => ({ ...r, balance: r.credit - r.debit }));
    const total_assets = assets.reduce((s, r) => s + r.balance, 0);
    const total_liabilities = liabilities.reduce((s, r) => s + r.balance, 0);
    const total_equity = equity.reduce((s, r) => s + r.balance, 0);
    return { assets, liabilities, equity, total_assets, total_liabilities, total_equity };
  }

  getTaxLedger(ctx: TenantContext) {
    return this.prisma.taxLedger.findMany({
      where: { tenantId: ctx.tenant_id, branchId: ctx.branch_id },
      orderBy: { postedAt: "desc" }
    });
  }

  async postOrderPayment(
    ctx: PostingContext,
    db: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    const existing = await db.journalEntry.findFirst({
      where: { tenantId: ctx.tenantId, branchId: ctx.branchId, refType: "order_payment", refId: ctx.orderId }
    });
    if (existing) return existing;
    const entry = await db.journalEntry.create({
      data: {
        tenantId: ctx.tenantId,
        conceptId: ctx.conceptId || null,
        branchId: ctx.branchId,
        date: new Date(),
        description: "POS payment auto-post",
        totalDebit: ctx.total,
        totalCredit: ctx.total,
        createdBy: ctx.actorId || "system",
        refType: "order_payment",
        refId: ctx.orderId
      }
    });

    const netSales = Number((ctx.total - ctx.tax).toFixed(2));
    await db.journalLine.createMany({
      data: [
        {
          tenantId: ctx.tenantId,
          conceptId: ctx.conceptId || null,
          branchId: ctx.branchId,
          entryId: entry.id,
          accountCode: "1000-CASH",
          debit: ctx.total,
          credit: 0,
          referenceType: "order",
          referenceId: ctx.orderId
        },
        {
          tenantId: ctx.tenantId,
          conceptId: ctx.conceptId || null,
          branchId: ctx.branchId,
          entryId: entry.id,
          accountCode: "4000-SALES",
          debit: 0,
          credit: netSales,
          referenceType: "order",
          referenceId: ctx.orderId
        },
        {
          tenantId: ctx.tenantId,
          conceptId: ctx.conceptId || null,
          branchId: ctx.branchId,
          entryId: entry.id,
          accountCode: "2100-TAX-PAYABLE",
          debit: 0,
          credit: ctx.tax,
          referenceType: "order",
          referenceId: ctx.orderId
        }
      ]
    });
    await db.taxLedger.create({
      data: {
        tenantId: ctx.tenantId,
        branchId: ctx.branchId,
        taxCode: "VAT",
        taxRate: ctx.total > 0 ? Number((ctx.tax / ctx.total).toFixed(4)) : 0,
        amount: ctx.tax
      }
    });
    return entry;
  }

  async postApBill(
    ctx: {
      tenantId: string;
      conceptId?: string;
      branchId: string;
      billId: string;
      amount: number;
      actorId?: string;
    },
    db: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    const existing = await db.journalEntry.findFirst({
      where: { tenantId: ctx.tenantId, branchId: ctx.branchId, refType: "ap_bill", refId: ctx.billId }
    });
    if (existing) return existing;
    const entry = await db.journalEntry.create({
      data: {
        tenantId: ctx.tenantId,
        conceptId: ctx.conceptId || null,
        branchId: ctx.branchId,
        date: new Date(),
        description: "AP bill auto-post",
        totalDebit: ctx.amount,
        totalCredit: ctx.amount,
        createdBy: ctx.actorId || "system",
        refType: "ap_bill",
        refId: ctx.billId
      }
    });
    await db.journalLine.createMany({
      data: [
        {
          tenantId: ctx.tenantId,
          conceptId: ctx.conceptId || null,
          branchId: ctx.branchId,
          entryId: entry.id,
          accountCode: "5100-PURCHASE-EXPENSE",
          debit: ctx.amount,
          credit: 0,
          referenceType: "ap_bill",
          referenceId: ctx.billId
        },
        {
          tenantId: ctx.tenantId,
          conceptId: ctx.conceptId || null,
          branchId: ctx.branchId,
          entryId: entry.id,
          accountCode: "2200-AP",
          debit: 0,
          credit: ctx.amount,
          referenceType: "ap_bill",
          referenceId: ctx.billId
        }
      ]
    });
    return entry;
  }

  async postApPayment(
    ctx: {
      tenantId: string;
      conceptId?: string;
      branchId: string;
      billId: string;
      amount: number;
      actorId?: string;
    },
    db: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    const existing = await db.journalEntry.findFirst({
      where: { tenantId: ctx.tenantId, branchId: ctx.branchId, refType: "ap_payment", refId: ctx.billId }
    });
    if (existing) return existing;
    const entry = await db.journalEntry.create({
      data: {
        tenantId: ctx.tenantId,
        conceptId: ctx.conceptId || null,
        branchId: ctx.branchId,
        date: new Date(),
        description: "AP payment auto-post",
        totalDebit: ctx.amount,
        totalCredit: ctx.amount,
        createdBy: ctx.actorId || "system",
        refType: "ap_payment",
        refId: ctx.billId
      }
    });
    await db.journalLine.createMany({
      data: [
        {
          tenantId: ctx.tenantId,
          conceptId: ctx.conceptId || null,
          branchId: ctx.branchId,
          entryId: entry.id,
          accountCode: "2200-AP",
          debit: ctx.amount,
          credit: 0,
          referenceType: "ap_bill",
          referenceId: ctx.billId
        },
        {
          tenantId: ctx.tenantId,
          conceptId: ctx.conceptId || null,
          branchId: ctx.branchId,
          entryId: entry.id,
          accountCode: "1000-CASH",
          debit: 0,
          credit: ctx.amount,
          referenceType: "ap_bill",
          referenceId: ctx.billId
        }
      ]
    });
    return entry;
  }

  async postCogsForOrder(
    ctx: { tenantId: string; conceptId: string; branchId: string; orderId: string; cogs: number },
    db: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    if (ctx.cogs <= 0) return null;
    const existing = await db.journalEntry.findFirst({
      where: { tenantId: ctx.tenantId, branchId: ctx.branchId, refType: "order_cogs", refId: ctx.orderId }
    });
    if (existing) return existing;
    const entry = await db.journalEntry.create({
      data: {
        tenantId: ctx.tenantId,
        conceptId: ctx.conceptId || null,
        branchId: ctx.branchId,
        date: new Date(),
        description: "COGS auto-post from inventory consumption",
        totalDebit: ctx.cogs,
        totalCredit: ctx.cogs,
        createdBy: "system",
        refType: "order_cogs",
        refId: ctx.orderId
      }
    });
    await db.journalLine.createMany({
      data: [
        {
          tenantId: ctx.tenantId,
          conceptId: ctx.conceptId || null,
          branchId: ctx.branchId,
          entryId: entry.id,
          accountCode: "5000-COGS",
          debit: ctx.cogs,
          credit: 0,
          referenceType: "order",
          referenceId: ctx.orderId
        },
        {
          tenantId: ctx.tenantId,
          conceptId: ctx.conceptId || null,
          branchId: ctx.branchId,
          entryId: entry.id,
          accountCode: "1200-INVENTORY",
          debit: 0,
          credit: ctx.cogs,
          referenceType: "order",
          referenceId: ctx.orderId
        }
      ]
    });
    return entry;
  }

  async postBankReconciliation(
    ctx: {
      tenantId: string;
      conceptId?: string;
      branchId: string;
      transactionId: string;
      amount: number;
      type: "credit" | "debit";
      matchedRefType?: string;
      matchedRefId?: string;
      actorId?: string;
    },
    db: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    const existing = await db.journalEntry.findFirst({
      where: {
        tenantId: ctx.tenantId,
        branchId: ctx.branchId,
        refType: "bank_reconciliation",
        refId: ctx.transactionId
      }
    });
    if (existing) return existing;

    const absAmount = Math.abs(ctx.amount);
    const entry = await db.journalEntry.create({
      data: {
        tenantId: ctx.tenantId,
        conceptId: ctx.conceptId || null,
        branchId: ctx.branchId,
        date: new Date(),
        description: "Bank transaction reconciliation auto-post",
        totalDebit: absAmount,
        totalCredit: absAmount,
        createdBy: ctx.actorId || "system",
        refType: "bank_reconciliation",
        refId: ctx.transactionId
      }
    });

    const bankLine =
      ctx.type === "credit"
        ? { debit: absAmount, credit: 0, accountCode: "1100-BANK" }
        : { debit: 0, credit: absAmount, accountCode: "1100-BANK" };
    const counterpartyLine =
      ctx.type === "credit"
        ? { debit: 0, credit: absAmount, accountCode: "1200-AR-CLEARING" }
        : { debit: absAmount, credit: 0, accountCode: "2200-AP-CLEARING" };

    await db.journalLine.createMany({
      data: [
        {
          tenantId: ctx.tenantId,
          conceptId: ctx.conceptId || null,
          branchId: ctx.branchId,
          entryId: entry.id,
          accountCode: bankLine.accountCode,
          debit: bankLine.debit,
          credit: bankLine.credit,
          referenceType: ctx.matchedRefType || "bank_transaction",
          referenceId: ctx.matchedRefId || ctx.transactionId
        },
        {
          tenantId: ctx.tenantId,
          conceptId: ctx.conceptId || null,
          branchId: ctx.branchId,
          entryId: entry.id,
          accountCode: counterpartyLine.accountCode,
          debit: counterpartyLine.debit,
          credit: counterpartyLine.credit,
          referenceType: ctx.matchedRefType || "bank_transaction",
          referenceId: ctx.matchedRefId || ctx.transactionId
        }
      ]
    });
    return entry;
  }

  async postAssetDepreciation(
    ctx: {
      tenantId: string;
      conceptId?: string;
      branchId: string;
      assetId: string;
      amount: number;
      actorId?: string;
    },
    db: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    const refId = `${ctx.assetId}:${new Date().toISOString().slice(0, 7)}`;
    const existing = await db.journalEntry.findFirst({
      where: { tenantId: ctx.tenantId, branchId: ctx.branchId, refType: "asset_depreciation", refId }
    });
    if (existing) return existing;
    const entry = await db.journalEntry.create({
      data: {
        tenantId: ctx.tenantId,
        conceptId: ctx.conceptId || null,
        branchId: ctx.branchId,
        date: new Date(),
        description: "Asset depreciation posting",
        totalDebit: ctx.amount,
        totalCredit: ctx.amount,
        createdBy: ctx.actorId || "system",
        refType: "asset_depreciation",
        refId
      }
    });
    await db.journalLine.createMany({
      data: [
        {
          tenantId: ctx.tenantId,
          conceptId: ctx.conceptId || null,
          branchId: ctx.branchId,
          entryId: entry.id,
          accountCode: "5300-DEPRECIATION-EXPENSE",
          debit: ctx.amount,
          credit: 0,
          referenceType: "asset",
          referenceId: ctx.assetId
        },
        {
          tenantId: ctx.tenantId,
          conceptId: ctx.conceptId || null,
          branchId: ctx.branchId,
          entryId: entry.id,
          accountCode: "1500-ACCUMULATED-DEPRECIATION",
          debit: 0,
          credit: ctx.amount,
          referenceType: "asset",
          referenceId: ctx.assetId
        }
      ]
    });
    return entry;
  }

  async postAssetDisposal(
    ctx: {
      tenantId: string;
      conceptId?: string;
      branchId: string;
      assetId: string;
      proceeds: number;
      netBookValue: number;
      actorId?: string;
    },
    db: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    const existing = await db.journalEntry.findFirst({
      where: { tenantId: ctx.tenantId, branchId: ctx.branchId, refType: "asset_disposal", refId: ctx.assetId }
    });
    if (existing) return existing;
    const gainLoss = Number((ctx.proceeds - ctx.netBookValue).toFixed(2));
    const total = Math.max(ctx.proceeds, ctx.netBookValue);
    const entry = await db.journalEntry.create({
      data: {
        tenantId: ctx.tenantId,
        conceptId: ctx.conceptId || null,
        branchId: ctx.branchId,
        date: new Date(),
        description: "Asset disposal posting",
        totalDebit: total,
        totalCredit: total,
        createdBy: ctx.actorId || "system",
        refType: "asset_disposal",
        refId: ctx.assetId
      }
    });
    const lines: Prisma.JournalLineCreateManyInput[] = [
      {
        tenantId: ctx.tenantId,
        conceptId: ctx.conceptId || null,
        branchId: ctx.branchId,
        entryId: entry.id,
        accountCode: "1000-CASH",
        debit: ctx.proceeds,
        credit: 0,
        referenceType: "asset",
        referenceId: ctx.assetId
      },
      {
        tenantId: ctx.tenantId,
        conceptId: ctx.conceptId || null,
        branchId: ctx.branchId,
        entryId: entry.id,
        accountCode: "1400-FIXED-ASSETS",
        debit: 0,
        credit: ctx.netBookValue,
        referenceType: "asset",
        referenceId: ctx.assetId
      }
    ];
    if (gainLoss > 0) {
      lines.push({
        tenantId: ctx.tenantId,
        conceptId: ctx.conceptId || null,
        branchId: ctx.branchId,
        entryId: entry.id,
        accountCode: "7100-GAIN-ON-DISPOSAL",
        debit: 0,
        credit: gainLoss,
        referenceType: "asset",
        referenceId: ctx.assetId
      });
    } else if (gainLoss < 0) {
      lines.push({
        tenantId: ctx.tenantId,
        conceptId: ctx.conceptId || null,
        branchId: ctx.branchId,
        entryId: entry.id,
        accountCode: "6100-LOSS-ON-DISPOSAL",
        debit: Math.abs(gainLoss),
        credit: 0,
        referenceType: "asset",
        referenceId: ctx.assetId
      });
    }
    await db.journalLine.createMany({ data: lines });
    return entry;
  }

  private async audit(
    ctx: TenantContext,
    action: string,
    entityType: string,
    entityId?: string,
    metadata?: Record<string, unknown>
  ) {
    await this.prisma.accountingAuditLog.create({
      data: {
        tenantId: ctx.tenant_id,
        branchId: ctx.branch_id,
        actorId: ctx.sub,
        action,
        entityType,
        entityId,
        metadata: (metadata || {}) as Prisma.InputJsonValue
      }
    });
  }
}
