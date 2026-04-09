import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { TenantContext } from "../auth/types/tenant-context.type";
import { OcrUploadDto, OcrVerifyDto } from "./dto/ocr.dto";
import { AccountingService } from "../accounting/accounting.service";

@Injectable()
export class OcrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService
  ) {}

  async upload(ctx: TenantContext, dto: OcrUploadDto) {
    const created = await this.prisma.ocrUpload.create({
      data: {
        tenantId: ctx.tenant_id,
        branchId: ctx.branch_id,
        uploadedBy: ctx.sub,
        fileUrl: dto.file_url,
        supplierName: dto.supplier_name,
        documentDate: dto.date ? new Date(dto.date) : null,
        totalAmount: dto.total,
        taxAmount: dto.tax,
        status: "processed",
        lines: {
          create: (dto.lines || []).map((line) => ({
            inventoryItemId: line.inventory_item_id,
            quantity: line.quantity,
            unitPrice: line.unit_price,
            taxAmount: line.tax_amount || 0,
            total: line.total
          }))
        }
      },
      include: { lines: true }
    });
    return created;
  }

  async getOne(ctx: TenantContext, id: string) {
    const row = await this.prisma.ocrUpload.findFirst({
      where: { id, tenantId: ctx.tenant_id, branchId: ctx.branch_id },
      include: { lines: true }
    });
    if (!row) throw new NotFoundException("OCR upload not found");
    return row;
  }

  async verify(ctx: TenantContext, dto: OcrVerifyDto) {
    const upload = await this.prisma.ocrUpload.findFirst({
      where: { id: dto.ocr_upload_id, tenantId: ctx.tenant_id, branchId: ctx.branch_id },
      include: { lines: true }
    });
    if (!upload) throw new NotFoundException("OCR upload not found");
    if (upload.status === "verified") throw new BadRequestException("OCR upload already verified");

    const lines = dto.lines || upload.lines.map((line) => ({
      inventory_item_id: line.inventoryItemId || undefined,
      quantity: Number(line.quantity),
      unit_price: Number(line.unitPrice),
      tax_amount: Number(line.taxAmount),
      total: Number(line.total)
    }));
    if (!lines.length) throw new BadRequestException("No OCR lines available for posting");
    const computedTotal = Number(lines.reduce((s, line) => s + Number(line.total), 0).toFixed(2));
    const finalTotal = Number((dto.total ?? Number(upload.totalAmount ?? computedTotal)).toFixed(2));
    if (finalTotal <= 0) throw new BadRequestException("Validated total must be greater than zero");

    return this.prisma.$transaction(async (tx) => {
      await tx.ocrUpload.update({
        where: { id: upload.id },
        data: {
          supplierName: dto.supplier_name || upload.supplierName,
          documentDate: dto.date ? new Date(dto.date) : upload.documentDate,
          totalAmount: finalTotal,
          taxAmount: dto.tax ?? Number(upload.taxAmount || 0),
          status: "verified"
        }
      });

      if (dto.lines) {
        await tx.ocrLine.deleteMany({ where: { ocrUploadId: upload.id } });
        await tx.ocrLine.createMany({
          data: dto.lines.map((line) => ({
            ocrUploadId: upload.id,
            inventoryItemId: line.inventory_item_id || null,
            quantity: line.quantity,
            unitPrice: line.unit_price,
            taxAmount: line.tax_amount || 0,
            total: line.total
          }))
        });
      }

      let createdPoId: string | null = null;
      let createdBillId: string | null = null;
      if (dto.post_as === "po") {
        const supplierId = await this.resolveSupplierId(ctx, dto.supplier_name || upload.supplierName || "");
        if (!supplierId) throw new BadRequestException("Supplier not found for PO creation");
        const po = await tx.purchaseOrder.create({
          data: {
            tenantId: ctx.tenant_id,
            branchId: ctx.branch_id,
            supplierId,
            poNumber: `OCR-PO-${Date.now()}`,
            status: "draft",
            lines: {
              create: lines.map((line) => ({
                inventoryItemId: this.requiredInventoryItemId(line.inventory_item_id),
                quantity: line.quantity,
                unitPrice: line.unit_price
              }))
            }
          }
        });
        createdPoId = po.id;
      } else if (dto.post_as === "bill") {
        const vendorId = await this.resolveVendorId(ctx, dto.supplier_name || upload.supplierName || "");
        if (!vendorId) throw new BadRequestException("Vendor not found for bill creation");
        const bill = await tx.apBill.create({
          data: {
            tenantId: ctx.tenant_id,
            branchId: ctx.branch_id,
            vendorId,
            billNo: `OCR-BILL-${Date.now()}`,
            amount: finalTotal,
            status: "posted",
            dueDate: new Date(dto.date || upload.documentDate || new Date())
          }
        });
        await this.accountingService.postApBill(
          {
            tenantId: ctx.tenant_id,
            conceptId: ctx.concept_id,
            branchId: ctx.branch_id,
            billId: bill.id,
            amount: Number(bill.amount),
            actorId: ctx.sub
          },
          tx
        );
        createdBillId = bill.id;
      } else {
        for (const line of lines) {
          const inventoryItemId = this.requiredInventoryItemId(line.inventory_item_id);
          const item = await tx.inventoryItem.findFirst({
            where: {
              id: inventoryItemId,
              tenantId: ctx.tenant_id,
              conceptId: ctx.concept_id,
              OR: [{ branchId: ctx.branch_id }, { branchId: null }]
            }
          });
          if (!item) throw new BadRequestException(`Inventory item not found: ${inventoryItemId}`);
          await tx.inventoryItem.update({
            where: { id: item.id },
            data: { stockLevel: { increment: line.quantity } }
          });
          await tx.stockLedger.create({
            data: {
              inventoryItemId: item.id,
              branchId: ctx.branch_id,
              txnType: "addition",
              qty: line.quantity,
              reference: `ocr:${upload.id}`
            }
          });
        }
      }

      return {
        ocr_upload_id: upload.id,
        status: "verified",
        post_as: dto.post_as,
        created_po_id: createdPoId,
        created_bill_id: createdBillId
      };
    });
  }

  private async resolveSupplierId(ctx: TenantContext, supplierName: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        tenantId: ctx.tenant_id,
        name: { equals: supplierName, mode: "insensitive" }
      }
    });
    return supplier?.id || null;
  }

  private async resolveVendorId(ctx: TenantContext, supplierName: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: {
        tenantId: ctx.tenant_id,
        name: { equals: supplierName, mode: "insensitive" }
      }
    });
    return vendor?.id || null;
  }

  private requiredInventoryItemId(id?: string) {
    if (!id) throw new BadRequestException("inventory_item_id is required for this posting mode");
    return id;
  }
}
