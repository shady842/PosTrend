import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AccountingService } from "../accounting/accounting.service";
import { TenantContext } from "../auth/types/tenant-context.type";
import { PrismaService } from "../database/prisma.service";
import { ImportBankTransactionsDto, ReconcileBankDto } from "./dto/bank.dto";

@Injectable()
export class BankService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService
  ) {}

  getAccounts(ctx: TenantContext) {
    return this.prisma.bankAccount.findMany({
      where: { tenantId: ctx.tenant_id, branchId: ctx.branch_id },
      orderBy: { createdAt: "asc" }
    });
  }

  async importTransactions(ctx: TenantContext, dto: ImportBankTransactionsDto) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id: dto.bank_account_id, tenantId: ctx.tenant_id, branchId: ctx.branch_id }
    });
    if (!account) throw new NotFoundException("Bank account not found");

    const created = [];
    let matched = 0;
    let unmatched = 0;
    for (const line of dto.transactions) {
      const tx = await this.prisma.bankTransaction.create({
        data: {
          bankAccountId: account.id,
          date: new Date(line.date),
          description: line.description,
          amount: line.amount,
          type: line.type,
          reference: line.reference,
          status: "unmatched"
        }
      });
      const auto = await this.tryAutoMatch(ctx, tx);
      if (auto.matched) matched += 1;
      else unmatched += 1;
      created.push(auto.transaction);
    }
    return {
      imported: created.length,
      matched,
      unmatched,
      transactions: created
    };
  }

  async reconcile(ctx: TenantContext, dto: ReconcileBankDto) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id: dto.bank_account_id, tenantId: ctx.tenant_id, branchId: ctx.branch_id }
    });
    if (!account) throw new NotFoundException("Bank account not found");

    let reconciled = 0;
    let flagged = 0;
    const txIds = dto.transaction_ids || [];
    for (const id of txIds) {
      const tx = await this.prisma.bankTransaction.findFirst({
        where: { id, bankAccountId: account.id }
      });
      if (!tx) continue;
      if (tx.status === "matched") continue;
      const auto = await this.tryAutoMatch(ctx, tx);
      if (auto.matched) reconciled += 1;
      else flagged += 1;
    }

    for (const adj of dto.adjustments || []) {
      const tx = await this.prisma.bankTransaction.findFirst({
        where: { id: adj.transaction_id, bankAccountId: account.id }
      });
      if (!tx) continue;
      await this.prisma.bankTransaction.update({
        where: { id: tx.id },
        data: {
          status: "matched",
          matchedRefType: "adjustment",
          matchedRefId: adj.reason
        }
      });
      await this.accountingService.postBankReconciliation({
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id,
        transactionId: tx.id,
        amount: Number(tx.amount),
        type: tx.type as "credit" | "debit",
        matchedRefType: "adjustment",
        matchedRefId: adj.reason,
        actorId: ctx.sub
      });
      reconciled += 1;
    }

    return { reconciled, flagged_for_review: flagged };
  }

  async reports(ctx: TenantContext) {
    const accounts = await this.prisma.bankAccount.findMany({
      where: { tenantId: ctx.tenant_id, branchId: ctx.branch_id }
    });
    const accountIds = accounts.map((a) => a.id);
    const txs = await this.prisma.bankTransaction.findMany({
      where: { bankAccountId: { in: accountIds } },
      orderBy: { date: "desc" }
    });

    const matched = txs.filter((t) => t.status === "matched").length;
    const unmatchedRows = txs.filter((t) => t.status !== "matched");
    const unmatched = unmatchedRows.length;
    const totalCredit = txs.filter((t) => t.type === "credit").reduce((s, t) => s + Number(t.amount), 0);
    const totalDebit = txs.filter((t) => t.type === "debit").reduce((s, t) => s + Number(t.amount), 0);
    const balance = totalCredit - totalDebit;
    const alerts = balance < 0 ? ["bank_balance_negative"] : balance < 100 ? ["bank_balance_low"] : [];

    const drawerClosures = await this.prisma.cashDrawer.findMany({
      where: { branchId: ctx.branch_id, closedAt: { not: null } }
    });
    const cashExpected = drawerClosures.reduce((s, d) => s + Number(d.endingAmount || 0), 0);

    return {
      accounts: accounts.length,
      transactions: txs.length,
      matched,
      unmatched,
      balance,
      alerts,
      cash_reconciliation: {
        expected_cash_from_drawers: cashExpected
      },
      exceptions: unmatchedRows.map((u) => ({
        transaction_id: u.id,
        date: u.date,
        amount: Number(u.amount),
        reference: u.reference,
        status: u.status
      }))
    };
  }

  private async tryAutoMatch(ctx: TenantContext, tx: { id: string; date: Date; amount: Prisma.Decimal; reference: string | null; type: string }) {
    const ref = tx.reference?.trim();
    let matchedRefType: string | null = null;
    let matchedRefId: string | null = null;
    if (ref) {
      const invoice = await this.prisma.arInvoice.findFirst({
        where: {
          tenantId: ctx.tenant_id,
          branchId: ctx.branch_id,
          invoiceNo: ref,
          amount: tx.amount
        }
      });
      if (invoice && this.sameDay(invoice.createdAt, tx.date)) {
        matchedRefType = "invoice";
        matchedRefId = invoice.id;
      }
      if (!matchedRefType) {
        const bill = await this.prisma.apBill.findFirst({
          where: {
            tenantId: ctx.tenant_id,
            branchId: ctx.branch_id,
            billNo: ref,
            amount: tx.amount
          }
        });
        if (bill && this.sameDay(bill.createdAt, tx.date)) {
          matchedRefType = "bill";
          matchedRefId = bill.id;
        }
      }
    }

    if (!matchedRefType || !matchedRefId) {
      return {
        matched: false,
        transaction: tx
      };
    }

    const updated = await this.prisma.bankTransaction.update({
      where: { id: tx.id },
      data: {
        status: "matched",
        matchedRefType,
        matchedRefId
      }
    });
    await this.accountingService.postBankReconciliation({
      tenantId: ctx.tenant_id,
      conceptId: ctx.concept_id,
      branchId: ctx.branch_id,
      transactionId: updated.id,
      amount: Number(updated.amount),
      type: updated.type as "credit" | "debit",
      matchedRefType,
      matchedRefId,
      actorId: ctx.sub
    });
    return {
      matched: true,
      transaction: updated
    };
  }

  private sameDay(a: Date, b: Date) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
}
