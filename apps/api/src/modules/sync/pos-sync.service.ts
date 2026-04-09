import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { TenantContext } from "../auth/types/tenant-context.type";
import { OrdersService } from "../orders/orders.service";
import { PaymentsService } from "../payments/payments.service";
import { ShiftService } from "../shift/shift.service";
import { AddPaymentDto, SplitPaymentDto } from "../payments/dto/payments.dto";
import { TransferTableDto } from "../orders/dto/pos-orders.dto";
import { OpenShiftDto, CloseShiftDto, CashDrawerMoveDto } from "../shift/dto/shift.dto";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { SyncPushOpDto, SyncPushRequestDto } from "./dto/sync-push.dto";
import { SyncConflictService } from "./sync-conflict.service";

type LineIn = {
  menu_item_id: string;
  qty: number;
  variant_id?: string;
  notes?: string;
  modifier_option_ids: string[];
};

@Injectable()
export class PosSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly shiftService: ShiftService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly syncConflict: SyncConflictService
  ) {}

  private parseDeviceId(sub: string): string | null {
    if (!sub?.startsWith("device:")) return null;
    return sub.slice("device:".length);
  }

  private async assertTenantActive(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true, suspensionReason: true }
    });
    if (!tenant) throw new UnauthorizedException("Tenant not found");
    if (tenant.status === "suspended") {
      throw new ForbiddenException(
        `Tenant suspended${tenant.suspensionReason ? `: ${tenant.suspensionReason}` : ""}`
      );
    }
  }

  async pull(ctx: TenantContext, cursor?: string) {
    await this.assertTenantActive(ctx.tenant_id);
    const openShift = await this.prisma.shift.findFirst({
      where: { tenantId: ctx.tenant_id, branchId: ctx.branch_id, status: "OPEN" },
      select: { id: true, name: true, startTime: true, status: true }
    });
    const menuAgg = await this.prisma.menuItem.aggregate({
      where: { tenantId: ctx.tenant_id, conceptId: ctx.concept_id },
      _max: { createdAt: true }
    });
    const menuMaxMs = menuAgg._max?.createdAt?.getTime() ?? 0;
    const cursorMs = cursor ? Date.parse(cursor) : 0;
    const serverTime = new Date().toISOString();
    return {
      cursor_prev: cursor ?? null,
      cursor_next: serverTime,
      server_time: serverTime,
      branch_id: ctx.branch_id,
      open_shift: openShift,
      menu_created_at_max: menuAgg._max?.createdAt?.toISOString() ?? null,
      hints: {
        refresh_menu: cursor ? menuMaxMs > cursorMs : false
      },
      conflicts: [] as unknown[]
    };
  }

  async push(ctx: TenantContext, dto: SyncPushRequestDto) {
    await this.assertTenantActive(ctx.tenant_id);
    const deviceId = dto.device_id ?? this.parseDeviceId(ctx.sub);
    if (dto.device_id && deviceId && dto.device_id !== deviceId) {
      throw new BadRequestException("device_id does not match authenticated device");
    }
    const results: Record<string, unknown>[] = [];
    for (const op of dto.ops ?? []) {
      results.push(await this.applyOne(ctx, deviceId, op));
    }
    this.realtimeGateway.broadcastSyncDeltaAvailable(ctx.tenant_id, ctx.branch_id);
    return {
      device_id: deviceId,
      results,
      server_time: new Date().toISOString()
    };
  }

  private errMessage(err: unknown): string {
    if (err instanceof HttpException) {
      const r = err.getResponse();
      if (typeof r === "string") return r;
      if (r && typeof r === "object" && "message" in r) {
        const m = (r as { message?: unknown }).message;
        if (Array.isArray(m)) return m.join(", ");
        if (typeof m === "string") return m;
      }
    }
    if (err instanceof Error) return err.message;
    return String(err);
  }

  private async applyOne(
    ctx: TenantContext,
    deviceId: string | null,
    op: SyncPushOpDto
  ): Promise<Record<string, unknown>> {
    const prior = await this.prisma.posDeviceSyncLedger.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: ctx.tenant_id,
          idempotencyKey: op.idempotency_key
        }
      }
    });
    if (prior) {
      await this.syncConflict.appendLog({
        ctx,
        deviceId,
        op,
        status: "duplicate",
        detail: null
      });
      return {
        idempotency_key: op.idempotency_key,
        status: "duplicate",
        domain: op.domain,
        type: op.type,
        result: prior.result
      };
    }

    const clientTs = op.client_timestamp ? new Date(op.client_timestamp) : null;
    const existingOrderIds = await this.syncConflict.existingOrderIdsInScope(ctx, op);
    for (const orderId of existingOrderIds) {
      const expected = this.syncConflict.expectedVersionForCandidateOrder(op, orderId);
      try {
        const check = await this.syncConflict.checkOrderMutation(ctx, orderId, expected, clientTs);
        if (!check.ok) {
          return await this.finishConflictStale(ctx, deviceId, op, {
            order_id: orderId,
            current_version: check.current_version,
            last_mutation_at: check.last_mutation_at
          });
        }
      } catch (err: unknown) {
        const ahead = this.parseExpectedVersionAhead(err);
        if (ahead) {
          return await this.finishConflictStale(ctx, deviceId, op, ahead);
        }
        throw err;
      }
    }

    let result: Record<string, unknown>;
    try {
      result = await this.dispatch(ctx, op);
    } catch (err: unknown) {
      await this.syncConflict.appendLog({
        ctx,
        deviceId,
        op,
        status: "rejected",
        detail: { error: this.errMessage(err) }
      });
      return {
        idempotency_key: op.idempotency_key,
        status: "rejected",
        domain: op.domain,
        type: op.type,
        error: this.errMessage(err)
      };
    }

    try {
      await this.prisma.posDeviceSyncLedger.create({
        data: {
          tenantId: ctx.tenant_id,
          branchId: ctx.branch_id,
          deviceId: deviceId ?? undefined,
          idempotencyKey: op.idempotency_key,
          domain: op.domain,
          opType: op.type,
          result: result as object
        }
      });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const dup = await this.prisma.posDeviceSyncLedger.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: ctx.tenant_id,
              idempotencyKey: op.idempotency_key
            }
          }
        });
        await this.syncConflict.appendLog({
          ctx,
          deviceId,
          op,
          status: "duplicate",
          detail: null
        });
        return {
          idempotency_key: op.idempotency_key,
          status: "duplicate",
          domain: op.domain,
          type: op.type,
          result: dup?.result ?? {}
        };
      }
      throw e;
    }

    await this.syncConflict.bumpOrdersFromOp(ctx, op, result);

    await this.syncConflict.appendLog({
      ctx,
      deviceId,
      op,
      status: "applied",
      detail: null
    });

    return {
      idempotency_key: op.idempotency_key,
      status: "applied",
      domain: op.domain,
      type: op.type,
      result
    };
  }

  private parseExpectedVersionAhead(err: unknown): Record<string, unknown> | null {
    if (!(err instanceof BadRequestException)) return null;
    const msg = this.errMessage(err);
    try {
      const j = JSON.parse(msg) as Record<string, unknown>;
      if (j && j["code"] === "expected_version_ahead") return j;
    } catch {
      /* not JSON */
    }
    return null;
  }

  private async finishConflictStale(
    ctx: TenantContext,
    deviceId: string | null,
    op: SyncPushOpDto,
    detail: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const orderId = String(detail["order_id"] ?? "");
    const serverVersion =
      typeof detail["current_version"] === "number"
        ? detail["current_version"]
        : Number(detail["current_version"]);

    const ledgerResult = {
      kind: "conflict_stale",
      ...detail
    } as Record<string, unknown>;

    try {
      await this.prisma.posDeviceSyncLedger.create({
        data: {
          tenantId: ctx.tenant_id,
          branchId: ctx.branch_id,
          deviceId: deviceId ?? undefined,
          idempotencyKey: op.idempotency_key,
          domain: op.domain,
          opType: op.type,
          result: ledgerResult as object
        }
      });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const dup = await this.prisma.posDeviceSyncLedger.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: ctx.tenant_id,
              idempotencyKey: op.idempotency_key
            }
          }
        });
        await this.syncConflict.appendLog({
          ctx,
          deviceId,
          op,
          status: "duplicate",
          detail: null
        });
        return {
          idempotency_key: op.idempotency_key,
          status: "duplicate",
          domain: op.domain,
          type: op.type,
          result: dup?.result ?? {}
        };
      }
      throw e;
    }

    await this.syncConflict.appendLog({
      ctx,
      deviceId,
      op,
      status: "conflict_stale",
      entityType: "order",
      entityId: orderId || null,
      serverVersion: Number.isFinite(serverVersion) ? serverVersion : null,
      resolution: "rejected_stale",
      detail
    });

    return {
      idempotency_key: op.idempotency_key,
      status: "conflict_stale",
      domain: op.domain,
      type: op.type,
      ...detail
    };
  }

  private normalizeLine(raw: unknown): LineIn {
    const m = raw as Record<string, unknown>;
    const menu_item_id = String(m["menu_item_id"] ?? m["item_id"] ?? "").trim();
    const qty = Number(m["qty"] ?? 0);
    const variant_id = m["variant_id"] != null ? String(m["variant_id"]) : undefined;
    const notes = m["notes"] != null ? String(m["notes"]) : undefined;
    const modifier_option_ids: string[] = [];
    const mods = m["modifiers"];
    if (Array.isArray(mods)) {
      for (const x of mods) {
        if (typeof x === "string") modifier_option_ids.push(x);
        else if (x && typeof x === "object" && "id" in x) {
          modifier_option_ids.push(String((x as { id: unknown }).id));
        }
      }
    }
    const modIds = m["modifier_option_ids"];
    if (Array.isArray(modIds)) {
      for (const x of modIds) modifier_option_ids.push(String(x));
    }
    return { menu_item_id, qty, variant_id, notes, modifier_option_ids };
  }

  private async syncCreateTakeaway(ctx: TenantContext, payload: Record<string, unknown>) {
    const clientOrderId = String(payload["client_order_id"] ?? "").trim();
    if (!clientOrderId) throw new BadRequestException("client_order_id required");
    const linesRaw = payload["lines"] as unknown[] | undefined;
    if (!linesRaw?.length) throw new BadRequestException("lines required");
    const lines = linesRaw.map((x) => this.normalizeLine(x));
    for (const ln of lines) {
      if (!ln.menu_item_id || ln.qty < 0.001) {
        throw new BadRequestException("Each line needs menu_item_id and qty");
      }
    }

    let order = await this.prisma.order.findFirst({
      where: {
        id: clientOrderId,
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id
      }
    });
    if (!order) {
      const created = await this.ordersService.openOrder(ctx, "TAKEAWAY", {
        client_order_id: clientOrderId,
        notes: payload["notes"] ? String(payload["notes"]) : undefined
      });
      order = created;
    }

    let full = await this.ordersService.getForTenant(order.id, ctx);
    while (full.items.length < lines.length) {
      const idx = full.items.length;
      const line = lines[idx]!;
      await this.ordersService.addPosItem(ctx, {
        order_id: order.id,
        menu_item_id: line.menu_item_id,
        qty: line.qty,
        variant_id: line.variant_id,
        notes: line.notes
      });
      full = await this.ordersService.getForTenant(order.id, ctx);
    }

    full = await this.ordersService.getForTenant(order.id, ctx);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const orderItem = full.items[i];
      if (!orderItem || !line.modifier_option_ids.length) continue;
      const existing = new Set(
        (orderItem.modifiers ?? []).map((m) => m.modifierOptionId)
      );
      for (const modOptId of line.modifier_option_ids) {
        if (existing.has(modOptId)) continue;
        await this.ordersService.addModifier(ctx, {
          order_item_id: orderItem.id,
          modifier_option_id: modOptId
        });
        existing.add(modOptId);
      }
    }

    return { order_id: order.id, lines: lines.length };
  }

  private async dispatch(ctx: TenantContext, op: SyncPushOpDto): Promise<Record<string, unknown>> {
    const p = op.payload;
    if (op.domain === "order") {
      if (op.type === "create_takeaway") return await this.syncCreateTakeaway(ctx, p);
      if (op.type === "close") {
        const orderId = String(p["order_id"] ?? "").trim();
        if (!orderId) throw new BadRequestException("order_id required");
        await this.ordersService.close(orderId, ctx);
        return { order_id: orderId, closed: true };
      }
      throw new BadRequestException(`Unknown order op: ${op.type}`);
    }
    if (op.domain === "payment") {
      if (op.type === "add") {
        const dto = p as unknown as AddPaymentDto;
        return await this.paymentsService.addPayment(ctx, dto);
      }
      if (op.type === "split") {
        const dto = p as unknown as SplitPaymentDto;
        return await this.paymentsService.splitPayment(ctx, dto);
      }
      throw new BadRequestException(`Unknown payment op: ${op.type}`);
    }
    if (op.domain === "table") {
      if (op.type === "open_table") {
        const tableId = String(p["table_id"] ?? "").trim();
        if (!tableId) throw new BadRequestException("table_id required");
        const guestCount = p["guest_count"] != null ? Number(p["guest_count"]) : 2;
        const created = await this.ordersService.openOrder(ctx, "DINE_IN", {
          table_id: tableId,
          guest_count: guestCount,
          notes: p["notes"] ? String(p["notes"]) : undefined,
          client_order_id: p["client_order_id"] ? String(p["client_order_id"]) : undefined
        });
        return { order_id: created.id, table_id: tableId };
      }
      if (op.type === "transfer_table") {
        const dto = p as unknown as TransferTableDto;
        await this.ordersService.transferTable(ctx, dto);
        return { transferred: true };
      }
      if (op.type === "merge_orders") {
        await this.ordersService.mergeOrders(
          ctx,
          String(p["source_order_id"] ?? ""),
          String(p["target_order_id"] ?? "")
        );
        return { merged: true };
      }
      throw new BadRequestException(`Unknown table op: ${op.type}`);
    }
    if (op.domain === "shift") {
      if (op.type === "open") {
        const dto = p as unknown as OpenShiftDto;
        return await this.shiftService.openShift(ctx, dto);
      }
      if (op.type === "close") {
        const dto = p as unknown as CloseShiftDto;
        return await this.shiftService.closeShift(ctx, dto);
      }
      if (op.type === "cash_move") {
        const dto = p as unknown as CashDrawerMoveDto;
        return await this.shiftService.moveCash(ctx, dto);
      }
      throw new BadRequestException(`Unknown shift op: ${op.type}`);
    }
    throw new BadRequestException(`Unknown domain: ${op.domain}`);
  }
}
