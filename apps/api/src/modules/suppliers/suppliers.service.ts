import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AccountingService } from "../accounting/accounting.service";
import { TenantContext } from "../auth/types/tenant-context.type";
import { PrismaService } from "../database/prisma.service";
import { SupplierBillDto, SupplierPurchaseOrderDto, CreateSupplierDto } from "./dto/suppliers.dto";

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService
  ) {}

  listSuppliers(ctx: TenantContext) {
    return this.prisma.supplier.findMany({
      where: { tenantId: ctx.tenant_id },
      orderBy: { name: "asc" },
      include: { _count: { select: { purchaseOrders: true } } }
    });
  }

  async createSupplier(ctx: TenantContext, dto: CreateSupplierDto) {
    const branchIds = dto.branch_ids?.length ? dto.branch_ids : [ctx.branch_id];
    return this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: {
          tenantId: ctx.tenant_id,
          name: dto.name,
          contactInfo: (dto.contact_info || {}) as Prisma.InputJsonValue,
          status: "active"
        }
      });
      const vendor = await tx.vendor.create({
        data: {
          tenantId: ctx.tenant_id,
          name: dto.name,
          supplierId: supplier.id,
          contactInfo: (dto.contact_info || {}) as Prisma.InputJsonValue
        }
      });
      for (const branchId of branchIds) {
        await tx.vendorBranch.create({
          data: { vendorId: vendor.id, branchId }
        });
        await tx.vendorStatement.upsert({
          where: { vendorId_branchId: { vendorId: vendor.id, branchId } },
          create: {
            vendorId: vendor.id,
            tenantId: ctx.tenant_id,
            branchId,
            balance: 0
          },
          update: {}
        });
      }
      return { id: vendor.id, supplier_id: supplier.id, name: vendor.name };
    });
  }

  async getSupplier(ctx: TenantContext, id: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, tenantId: ctx.tenant_id },
      include: { statements: true, branches: true }
    });
    if (!vendor) throw new NotFoundException("Supplier not found");
    return vendor;
  }

  async createSupplierPurchaseOrder(ctx: TenantContext, supplierId: string, dto: SupplierPurchaseOrderDto) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: supplierId, tenantId: ctx.tenant_id },
      include: { branches: true }
    });
    if (!vendor) throw new NotFoundException("Supplier not found");
    const branchId = dto.branch_id || ctx.branch_id;
    const assigned = vendor.branches.some((b) => b.branchId === branchId);
    if (!assigned) throw new BadRequestException("Supplier is not assigned to branch");
    if (!vendor.supplierId) throw new BadRequestException("Supplier inventory profile is missing");
    const supplierRefId = vendor.supplierId;

    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          tenantId: ctx.tenant_id,
          branchId,
          supplierId: supplierRefId,
          poNumber: dto.po_number,
          status: dto.status,
          receivedAt: dto.status === "received" ? new Date() : null,
          lines: {
            create: dto.lines.map((line) => ({
              inventoryItemId: line.inventory_item_id,
              quantity: line.quantity,
              unitPrice: line.unit_price
            }))
          }
        },
        include: { lines: true }
      });
      if (dto.status === "received") {
        for (const line of dto.lines) {
          const item = await tx.inventoryItem.findFirst({
            where: {
              id: line.inventory_item_id,
              tenantId: ctx.tenant_id,
              conceptId: ctx.concept_id,
              OR: [{ branchId }, { branchId: null }]
            }
          });
          if (!item) throw new NotFoundException("Inventory item not found");
          await tx.inventoryItem.update({
            where: { id: item.id },
            data: { stockLevel: { increment: line.quantity } }
          });
          await tx.stockLedger.create({
            data: {
              inventoryItemId: item.id,
              branchId,
              txnType: "addition",
              qty: line.quantity,
              reference: `po:${po.poNumber}`
            }
          });
        }
      }
      return po;
    });
  }

  async createSupplierBill(ctx: TenantContext, supplierId: string, dto: SupplierBillDto) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: supplierId, tenantId: ctx.tenant_id },
      include: { branches: true }
    });
    if (!vendor) throw new NotFoundException("Supplier not found");
    const branchId = dto.branch_id || ctx.branch_id;
    const assigned = vendor.branches.some((b) => b.branchId === branchId);
    if (!assigned) throw new BadRequestException("Supplier is not assigned to branch");

    return this.prisma.$transaction(async (tx) => {
      const bill = await tx.apBill.create({
        data: {
          tenantId: ctx.tenant_id,
          branchId,
          vendorId: vendor.id,
          billNo: dto.bill_no,
          amount: dto.amount,
          status: dto.status,
          dueDate: new Date(dto.due_date)
        }
      });

      if (dto.status === "posted" || dto.status === "paid") {
        await this.accountingService.postApBill(
          {
            tenantId: ctx.tenant_id,
            conceptId: ctx.concept_id,
            branchId,
            billId: bill.id,
            amount: Number(bill.amount),
            actorId: dto.actor_id || ctx.sub
          },
          tx
        );
      }
      if (dto.status === "paid") {
        await this.accountingService.postApPayment(
          {
            tenantId: ctx.tenant_id,
            conceptId: ctx.concept_id,
            branchId,
            billId: bill.id,
            amount: Number(bill.amount),
            actorId: dto.actor_id || ctx.sub
          },
          tx
        );
      }

      const delta = dto.status === "paid" ? 0 : Number(bill.amount);
      await tx.vendorStatement.upsert({
        where: { vendorId_branchId: { vendorId: vendor.id, branchId } },
        create: {
          vendorId: vendor.id,
          tenantId: ctx.tenant_id,
          branchId,
          balance: delta
        },
        update: {
          balance: { increment: delta }
        }
      });
      return bill;
    });
  }

  async getSupplierStatement(ctx: TenantContext, supplierId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: supplierId, tenantId: ctx.tenant_id }
    });
    if (!vendor) throw new NotFoundException("Supplier not found");
    const statements = await this.prisma.vendorStatement.findMany({
      where: { vendorId: vendor.id, tenantId: ctx.tenant_id },
      orderBy: { lastUpdated: "desc" }
    });
    const bills = await this.prisma.apBill.findMany({
      where: { tenantId: ctx.tenant_id, vendorId: vendor.id, status: { in: ["draft", "posted", "paid"] } }
    });
    const now = Date.now();
    let current = 0;
    let d30 = 0;
    let d60 = 0;
    let d90 = 0;
    for (const b of bills) {
      if (b.status === "paid") continue;
      const ageDays = Math.floor((now - b.dueDate.getTime()) / (24 * 60 * 60 * 1000));
      const amt = Number(b.amount);
      if (ageDays <= 0) current += amt;
      else if (ageDays <= 30) d30 += amt;
      else if (ageDays <= 60) d60 += amt;
      else d90 += amt;
    }
    return {
      vendor_id: vendor.id,
      vendor_name: vendor.name,
      branch_balances: statements.map((s) => ({
        branch_id: s.branchId,
        balance: Number(s.balance),
        last_updated: s.lastUpdated
      })),
      aging: {
        current,
        days_1_30: d30,
        days_31_60: d60,
        days_61_plus: d90
      }
    };
  }
}
