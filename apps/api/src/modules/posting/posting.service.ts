import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { Prisma } from "@prisma/client";
import { AccountingService } from "../accounting/accounting.service";
import { TenantContext } from "../auth/types/tenant-context.type";
import { PrismaService } from "../database/prisma.service";
import { PostingEvent } from "./posting.types";

/**
 * PostingEngine: single source of truth for all automated postings.
 *
 * Invariants:
 * - Financial reports must read from JournalEntry/JournalLine only.
 * - Inventory availability must read from StockLedger only.
 *
 * This service ensures each event results in:
 * - journal_entries + journal_lines (if applicable)
 * - stock_ledger movements (if applicable)
 * - audit log
 *
 * NOTE: Some events (PRODUCTION, PAYROLL_PROCESSED) require domain modules
 * to exist; this engine provides the contract and will throw until wired.
 */
@Injectable()
export class PostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly moduleRef: ModuleRef
  ) {}

  async post(ctx: TenantContext, event: PostingEvent, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    switch (event.type) {
      case "ORDER_PAID":
        return this.postOrderPaid(ctx, event.order_id, db);
      case "PURCHASE_RECEIVED":
        return this.postPurchaseReceived(ctx, event.purchase_order_id, db);
      case "STOCK_TRANSFER":
        return this.postStockTransfer(ctx, event.transfer_id, db);
      case "WASTAGE":
        return this.postWastage(ctx, event.wastage_id, db);
      case "PRODUCTION":
        return this.postProduction(ctx, event.batch_id, event.valuation_amount || 0, db);
      case "PAYROLL_PROCESSED":
        return this.postPayrollProcessed(
          ctx,
          event.payroll_record_id || event.payroll_run_id || "",
          db
        );
      case "DEPRECIATION_RUN":
        return this.postDepreciationRun(ctx, event.depreciation_run_id, db);
      case "BANK_RECONCILED":
        return this.postBankReconciled(ctx, event.bank_reconcile_id, db);
      default:
        throw new BadRequestException("Unknown posting event");
    }
  }

  private async audit(
    ctx: TenantContext,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown>,
    db: Prisma.TransactionClient | PrismaService
  ) {
    await db.accountingAuditLog.create({
      data: {
        tenantId: ctx.tenant_id,
        branchId: ctx.branch_id,
        actorId: ctx.sub,
        action,
        entityType,
        entityId,
        metadata: metadata as Prisma.InputJsonValue
      }
    });
  }

  private async postOrderPaid(ctx: TenantContext, orderId: string, db: Prisma.TransactionClient | PrismaService) {
    const order = await db.order.findFirst({
      where: { id: orderId, tenantId: ctx.tenant_id, conceptId: ctx.concept_id },
      include: { payments: true }
    });
    if (!order) throw new NotFoundException("Order not found");

    // Idempotency: if payment posting exists, do not double-post.
    const existing = await db.journalEntry.findFirst({
      where: { tenantId: order.tenantId, branchId: order.branchId, refType: "order_payment", refId: order.id }
    });
    if (!existing) {
      await this.accounting.postOrderPayment(
        {
          tenantId: order.tenantId,
          conceptId: order.conceptId || ctx.concept_id,
          branchId: order.branchId,
          orderId: order.id,
          total: Number(order.total),
          tax: Number(order.tax),
          actorId: ctx.sub
        },
        db
      );
    }

    // Inventory consumption (idempotent inside InventoryService).
    // Use ModuleRef to avoid circular dependency: InventoryService -> PostingService -> InventoryService.
    const inventory = this.moduleRef.get<any>("INVENTORY_SERVICE", { strict: false });
    if (inventory) {
      await inventory.consumeForOrder(
        {
          tenantId: order.tenantId,
          conceptId: order.conceptId || "",
          branchId: order.branchId,
          orderId: order.id
        },
        db
      );
    } else {
      throw new BadRequestException("InventoryService unavailable for ORDER_PAID posting");
    }

    await this.audit(
      ctx,
      "posting_event_applied",
      "ORDER_PAID",
      order.id,
      { order_id: order.id, branch_id: order.branchId },
      db
    );

    return { status: "ok", event: "ORDER_PAID", order_id: order.id };
  }

  private async postPurchaseReceived(
    ctx: TenantContext,
    purchaseOrderId: string,
    db: Prisma.TransactionClient | PrismaService
  ) {
    const po = await db.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, tenantId: ctx.tenant_id },
      include: { lines: true, supplier: true }
    });
    if (!po) throw new NotFoundException("Purchase order not found");

    // If not received, nothing to post yet.
    if (po.status !== "received") {
      throw new BadRequestException("Purchase order is not received");
    }

    // Idempotency: rely on AP bill posting (refType ap_bill) OR journal entry for PO receive.
    const refKey = `po_receive:${po.id}`;
    const existing = await db.journalEntry.findFirst({
      where: { tenantId: po.tenantId, branchId: po.branchId, refType: "po_receive", refId: po.id }
    });
    if (!existing) {
      const amount = po.lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice), 0);
      // Minimal accounting: Inventory (debit) / AP (credit).
      const entry = await db.journalEntry.create({
        data: {
          tenantId: po.tenantId,
          conceptId: ctx.concept_id,
          branchId: po.branchId,
          date: po.receivedAt || new Date(),
          description: `PO received ${po.poNumber}`,
          totalDebit: amount,
          totalCredit: amount,
          createdBy: ctx.sub,
          refType: "po_receive",
          refId: po.id
        }
      });
      await db.journalLine.createMany({
        data: [
          {
            tenantId: po.tenantId,
            conceptId: ctx.concept_id,
            branchId: po.branchId,
            entryId: entry.id,
            accountCode: "1200-INVENTORY",
            debit: amount,
            credit: 0,
            referenceType: "purchase_order",
            referenceId: po.id
          },
          {
            tenantId: po.tenantId,
            conceptId: ctx.concept_id,
            branchId: po.branchId,
            entryId: entry.id,
            accountCode: "2000-ACCOUNTS-PAYABLE",
            debit: 0,
            credit: amount,
            referenceType: "supplier",
            referenceId: po.supplierId
          }
        ]
      });
    }

    // Inventory stock_ledger is created by InventoryService when receiving PO lines.
    // We still assert there are stock_ledger rows for this PO number reference.
    const anyLedger = await db.stockLedger.findFirst({
      where: { branchId: po.branchId, reference: { contains: `po:${po.poNumber}` } }
    });
    if (!anyLedger) {
      // Do not auto-create here (business logic lives in inventory). Signal wiring issue.
      throw new BadRequestException(`Missing stock_ledger movements for ${refKey}`);
    }

    await this.audit(
      ctx,
      "posting_event_applied",
      "PURCHASE_RECEIVED",
      po.id,
      { purchase_order_id: po.id, po_number: po.poNumber, branch_id: po.branchId },
      db
    );

    return { status: "ok", event: "PURCHASE_RECEIVED", purchase_order_id: po.id };
  }

  private async postStockTransfer(ctx: TenantContext, transferId: string, db: Prisma.TransactionClient | PrismaService) {
    const transfer = await db.stockTransfer.findFirst({
      where: { id: transferId }
    });
    if (!transfer) throw new NotFoundException("Transfer not found");
    if (transfer.status !== "completed") throw new BadRequestException("Transfer not completed");

    const existing = await db.journalEntry.findFirst({
      where: { tenantId: ctx.tenant_id, branchId: transfer.fromBranchId, refType: "stock_transfer", refId: transfer.id }
    });
    if (!existing) {
      // No value/cost model in DB; record zero-value memo entry to keep event trail in journal.
      const entry = await db.journalEntry.create({
        data: {
          tenantId: ctx.tenant_id,
          conceptId: ctx.concept_id,
          branchId: transfer.fromBranchId,
          date: new Date(),
          description: `Stock transfer ${transfer.id}`,
          totalDebit: 0,
          totalCredit: 0,
          createdBy: ctx.sub,
          refType: "stock_transfer",
          refId: transfer.id
        }
      });
      await db.journalLine.createMany({
        data: [
          {
            tenantId: ctx.tenant_id,
            conceptId: ctx.concept_id,
            branchId: transfer.fromBranchId,
            entryId: entry.id,
            accountCode: "1200-INVENTORY",
            debit: 0,
            credit: 0,
            referenceType: "stock_transfer",
            referenceId: transfer.id
          }
        ]
      });
    }

    const out = await db.stockLedger.findFirst({
      where: { branchId: transfer.fromBranchId, reference: { contains: `transfer_out:${transfer.id}` } }
    });
    const inn = await db.stockLedger.findFirst({
      where: { branchId: transfer.toBranchId, reference: { contains: `transfer_in:${transfer.id}` } }
    });
    if (!out || !inn) throw new BadRequestException("Missing stock_ledger movements for transfer");

    await this.audit(
      ctx,
      "posting_event_applied",
      "STOCK_TRANSFER",
      transfer.id,
      { transfer_id: transfer.id, from_branch_id: transfer.fromBranchId, to_branch_id: transfer.toBranchId },
      db
    );

    return { status: "ok", event: "STOCK_TRANSFER", transfer_id: transfer.id };
  }

  private async postWastage(ctx: TenantContext, wastageId: string, db: Prisma.TransactionClient | PrismaService) {
    const w = await db.wastageEntry.findFirst({
      where: { id: wastageId, branchId: ctx.branch_id }
    });
    if (!w) throw new NotFoundException("Wastage entry not found");

    const existing = await db.journalEntry.findFirst({
      where: { tenantId: ctx.tenant_id, branchId: w.branchId, refType: "wastage", refId: w.id }
    });
    if (!existing) {
      const entry = await db.journalEntry.create({
        data: {
          tenantId: ctx.tenant_id,
          conceptId: ctx.concept_id,
          branchId: w.branchId,
          date: new Date(),
          description: `Wastage: ${w.reason}`,
          totalDebit: 0,
          totalCredit: 0,
          createdBy: ctx.sub,
          refType: "wastage",
          refId: w.id
        }
      });
      await db.journalLine.createMany({
        data: [
          {
            tenantId: ctx.tenant_id,
            conceptId: ctx.concept_id,
            branchId: w.branchId,
            entryId: entry.id,
            accountCode: "5200-WASTAGE",
            debit: 0,
            credit: 0,
            referenceType: "wastage",
            referenceId: w.id
          }
        ]
      });
    }

    const anyLedger = await db.stockLedger.findFirst({
      where: { branchId: w.branchId, reference: { contains: `wastage:${w.id}` } }
    });
    if (!anyLedger) throw new BadRequestException("Missing stock_ledger movement for wastage");

    await this.audit(
      ctx,
      "posting_event_applied",
      "WASTAGE",
      w.id,
      { wastage_id: w.id, inventory_item_id: w.inventoryItemId, qty: Number(w.quantity) },
      db
    );
    return { status: "ok", event: "WASTAGE", wastage_id: w.id };
  }

  private async postPayrollProcessed(
    ctx: TenantContext,
    payrollRecordId: string,
    db: Prisma.TransactionClient | PrismaService
  ) {
    if (!payrollRecordId) throw new BadRequestException("Missing payroll_record_id");
    const record = await db.payrollRecord.findFirst({
      where: {
        id: payrollRecordId,
        branchId: ctx.branch_id,
        employee: { tenantId: ctx.tenant_id, conceptId: ctx.concept_id }
      },
      include: { employee: true }
    });
    if (!record) throw new NotFoundException("Payroll record not found");

    const existing = await db.journalEntry.findFirst({
      where: {
        tenantId: ctx.tenant_id,
        branchId: ctx.branch_id,
        refType: "payroll",
        refId: record.id
      }
    });
    if (!existing) {
      const amount = Number(record.grossSalary);
      const entry = await db.journalEntry.create({
        data: {
          tenantId: ctx.tenant_id,
          conceptId: ctx.concept_id,
          branchId: ctx.branch_id,
          date: new Date(),
          description: `Payroll posting ${record.id}`,
          totalDebit: amount,
          totalCredit: amount,
          createdBy: ctx.sub,
          refType: "payroll",
          refId: record.id
        }
      });
      await db.journalLine.createMany({
        data: [
          {
            tenantId: ctx.tenant_id,
            conceptId: ctx.concept_id,
            branchId: ctx.branch_id,
            entryId: entry.id,
            accountCode: "5200-PAYROLL-EXPENSE",
            debit: amount,
            credit: 0,
            referenceType: "payroll",
            referenceId: record.id
          },
          {
            tenantId: ctx.tenant_id,
            conceptId: ctx.concept_id,
            branchId: ctx.branch_id,
            entryId: entry.id,
            accountCode: "2300-PAYROLL-PAYABLE",
            debit: 0,
            credit: amount,
            referenceType: "payroll",
            referenceId: record.id
          }
        ]
      });
    }

    await this.audit(
      ctx,
      "posting_event_applied",
      "PAYROLL_PROCESSED",
      record.id,
      { payroll_record_id: record.id, employee_id: record.employeeId, status: record.status },
      db
    );
    return { status: "ok", event: "PAYROLL_PROCESSED", payroll_record_id: record.id };
  }

  private async postProduction(
    ctx: TenantContext,
    batchId: string,
    valuationAmount: number,
    db: Prisma.TransactionClient | PrismaService
  ) {
    if (!batchId) throw new BadRequestException("Missing batch_id");
    const existing = await db.journalEntry.findFirst({
      where: {
        tenantId: ctx.tenant_id,
        branchId: ctx.branch_id,
        refType: "production",
        refId: batchId
      }
    });
    if (!existing) {
      const amount = Math.max(0, Number(valuationAmount || 0));
      const entry = await db.journalEntry.create({
        data: {
          tenantId: ctx.tenant_id,
          conceptId: ctx.concept_id,
          branchId: ctx.branch_id,
          date: new Date(),
          description: `Production posting ${batchId}`,
          totalDebit: amount,
          totalCredit: amount,
          createdBy: ctx.sub,
          refType: "production",
          refId: batchId
        }
      });
      await db.journalLine.createMany({
        data: [
          {
            tenantId: ctx.tenant_id,
            conceptId: ctx.concept_id,
            branchId: ctx.branch_id,
            entryId: entry.id,
            accountCode: "1200-INVENTORY",
            debit: amount,
            credit: 0,
            referenceType: "production",
            referenceId: batchId
          },
          {
            tenantId: ctx.tenant_id,
            conceptId: ctx.concept_id,
            branchId: ctx.branch_id,
            entryId: entry.id,
            accountCode: "5100-PRODUCTION-CONSUMPTION",
            debit: 0,
            credit: amount,
            referenceType: "production",
            referenceId: batchId
          }
        ]
      });
    }
    await this.audit(
      ctx,
      "posting_event_applied",
      "PRODUCTION",
      batchId,
      { batch_id: batchId, valuation_amount: Number(valuationAmount || 0) },
      db
    );
    return { status: "ok", event: "PRODUCTION", batch_id: batchId };
  }

  private async postDepreciationRun(ctx: TenantContext, depreciationRunId: string, db: Prisma.TransactionClient | PrismaService) {
    // Domain model isn't present; keep contract and audit.
    const existing = await db.journalEntry.findFirst({
      where: { tenantId: ctx.tenant_id, branchId: ctx.branch_id, refType: "depreciation_run", refId: depreciationRunId }
    });
    if (!existing) {
      throw new BadRequestException("Depreciation run is not wired (no domain model / job runner)");
    }
    await this.audit(
      ctx,
      "posting_event_applied",
      "DEPRECIATION_RUN",
      depreciationRunId,
      { depreciation_run_id: depreciationRunId },
      db
    );
    return { status: "ok", event: "DEPRECIATION_RUN", depreciation_run_id: depreciationRunId };
  }

  private async postBankReconciled(ctx: TenantContext, bankReconcileId: string, db: Prisma.TransactionClient | PrismaService) {
    const existing = await db.journalEntry.findFirst({
      where: { tenantId: ctx.tenant_id, branchId: ctx.branch_id, refType: "bank_reconcile", refId: bankReconcileId }
    });
    if (!existing) {
      throw new BadRequestException("Bank reconciliation is not wired (no domain model / endpoint)");
    }
    await this.audit(
      ctx,
      "posting_event_applied",
      "BANK_RECONCILED",
      bankReconcileId,
      { bank_reconcile_id: bankReconcileId },
      db
    );
    return { status: "ok", event: "BANK_RECONCILED", bank_reconcile_id: bankReconcileId };
  }
}

