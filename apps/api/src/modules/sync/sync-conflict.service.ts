import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { TenantContext } from "../auth/types/tenant-context.type";
import { AddPaymentDto, SplitPaymentDto } from "../payments/dto/payments.dto";
import { TransferTableDto } from "../orders/dto/pos-orders.dto";
import { SyncPushOpDto } from "./dto/sync-push.dto";

export type OrderMutationResolution = "none" | "strict_match" | "lww";

@Injectable()
export class SyncConflictService {
  constructor(private readonly prisma: PrismaService) {}

  candidateOrderIds(op: SyncPushOpDto): string[] {
    const p = op.payload;
    const key = `${op.domain}:${op.type}`;
    switch (key) {
      case "order:create_takeaway": {
        const cid = String(p["client_order_id"] ?? "").trim();
        return cid ? [cid] : [];
      }
      case "order:close":
        return [String(p["order_id"] ?? "").trim()].filter(Boolean);
      case "payment:add":
        return [String((p as unknown as AddPaymentDto).order_id ?? "").trim()].filter(Boolean);
      case "payment:split":
        return [String((p as unknown as SplitPaymentDto).order_id ?? "").trim()].filter(Boolean);
      case "table:transfer_table":
        return [String((p as unknown as TransferTableDto).order_id ?? "").trim()].filter(Boolean);
      case "table:merge_orders":
        return [String(p["source_order_id"] ?? ""), String(p["target_order_id"] ?? "")].filter(Boolean);
      case "table:open_table": {
        const cid = String(p["client_order_id"] ?? "").trim();
        return cid ? [cid] : [];
      }
      default:
        return [];
    }
  }

  /** Per-order expected version: merge uses `expected_version_source` / `expected_version_target`; others use `expected_version`. */
  expectedVersionForCandidateOrder(op: SyncPushOpDto, orderId: string): number | undefined {
    const p = op.payload;
    if (op.domain === "table" && op.type === "merge_orders") {
      const src = String(p["source_order_id"] ?? "").trim();
      const tgt = String(p["target_order_id"] ?? "").trim();
      if (orderId === src) return this.readVersionKey(p, "expected_version_source");
      if (orderId === tgt) return this.readVersionKey(p, "expected_version_target");
      return undefined;
    }
    return this.readExpectedVersion(p);
  }

  private readVersionKey(p: Record<string, unknown>, key: string): number | undefined {
    const v = p[key];
    if (v == null) return undefined;
    const n = Number(v);
    if (!Number.isFinite(n)) return undefined;
    return Math.floor(n);
  }

  async existingOrderIdsInScope(ctx: TenantContext, op: SyncPushOpDto): Promise<string[]> {
    const candidates = this.candidateOrderIds(op);
    const out: string[] = [];
    for (const id of candidates) {
      const o = await this.prisma.order.findFirst({
        where: { id, tenantId: ctx.tenant_id, branchId: ctx.branch_id }
      });
      if (o) out.push(id);
    }
    return out;
  }

  readExpectedVersion(payload: Record<string, unknown>): number | undefined {
    const v = payload["expected_version"];
    if (v == null) return undefined;
    const n = Number(v);
    if (!Number.isFinite(n)) return undefined;
    return Math.floor(n);
  }

  /**
   * Version check + last-write-wins using client_timestamp vs server lastMutationAt.
   * - No expected_version: allow (legacy clients).
   * - expected === server: allow (strict_match).
   * - expected < server: allow only if client_timestamp >= server lastMutationAt (lww).
   * - expected > server: reject (client must refetch).
   */
  async checkOrderMutation(
    ctx: TenantContext,
    orderId: string,
    expectedVersion: number | undefined,
    clientTs: Date | null
  ): Promise<
    | { ok: true; resolution: OrderMutationResolution }
    | { ok: false; current_version: number; last_mutation_at: string | null }
  > {
    const row = await this.prisma.entityVersion.findUnique({
      where: {
        tenantId_entityType_entityId: {
          tenantId: ctx.tenant_id,
          entityType: "order",
          entityId: orderId
        }
      }
    });
    const current = row?.version ?? 0;
    const lastMs = row?.lastMutationAt?.getTime() ?? 0;
    const clientMs = clientTs?.getTime() ?? Date.now();

    if (expectedVersion === undefined) {
      return { ok: true, resolution: "none" };
    }
    if (expectedVersion > current) {
      throw new BadRequestException(
        JSON.stringify({
          code: "expected_version_ahead",
          order_id: orderId,
          current_version: current,
          message: "Refetch order version and retry"
        })
      );
    }
    if (expectedVersion === current) {
      return { ok: true, resolution: "strict_match" };
    }
    const skewMs = 10_000;
    if (clientMs >= lastMs - skewMs && clientMs >= lastMs) {
      return { ok: true, resolution: "lww" };
    }
    return {
      ok: false,
      current_version: current,
      last_mutation_at: row?.lastMutationAt?.toISOString() ?? null
    };
  }

  async bumpOrderVersion(ctx: TenantContext, orderId: string) {
    const now = new Date();
    await this.prisma.entityVersion.upsert({
      where: {
        tenantId_entityType_entityId: {
          tenantId: ctx.tenant_id,
          entityType: "order",
          entityId: orderId
        }
      },
      create: {
        tenantId: ctx.tenant_id,
        branchId: ctx.branch_id,
        entityType: "order",
        entityId: orderId,
        version: 1,
        lastMutationAt: now
      },
      update: {
        version: { increment: 1 },
        lastMutationAt: now,
        branchId: ctx.branch_id
      }
    });
  }

  async bumpOrdersFromOp(ctx: TenantContext, op: SyncPushOpDto, result: Record<string, unknown>) {
    const ids = new Set<string>();
    const ro = result["order_id"];
    if (typeof ro === "string" && ro) ids.add(ro);
    if (op.domain === "table" && op.type === "merge_orders") {
      const t = String(op.payload["target_order_id"] ?? "").trim();
      if (t) ids.add(t);
    }
    if (op.domain === "table" && op.type === "transfer_table") {
      const t = String((op.payload as unknown as TransferTableDto).order_id ?? "").trim();
      if (t) ids.add(t);
    }
    if (op.domain === "payment" && op.type === "add") {
      const t = String((op.payload as unknown as AddPaymentDto).order_id ?? "").trim();
      if (t) ids.add(t);
    }
    if (op.domain === "payment" && op.type === "split") {
      const t = String((op.payload as unknown as SplitPaymentDto).order_id ?? "").trim();
      if (t) ids.add(t);
    }
    if (op.domain === "order" && op.type === "close") {
      const t = String(op.payload["order_id"] ?? "").trim();
      if (t) ids.add(t);
    }
    if (op.domain === "order" && op.type === "create_takeaway") {
      const t = String(result["order_id"] ?? op.payload["client_order_id"] ?? "").trim();
      if (t) ids.add(t);
    }
    if (op.domain === "table" && op.type === "open_table") {
      const t = String(result["order_id"] ?? "").trim();
      if (t) ids.add(t);
    }
    for (const id of ids) {
      await this.bumpOrderVersion(ctx, id);
    }
  }

  async appendLog(input: {
    ctx: TenantContext;
    deviceId: string | null;
    op: SyncPushOpDto;
    status: string;
    resolution?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    serverVersion?: number | null;
    detail?: Record<string, unknown> | null;
  }) {
    const clientTs = input.op.client_timestamp ? new Date(input.op.client_timestamp) : null;
    await this.prisma.syncLog.create({
      data: {
        tenantId: input.ctx.tenant_id,
        branchId: input.ctx.branch_id,
        deviceId: input.deviceId ?? undefined,
        opId: input.op.op_id,
        idempotencyKey: input.op.idempotency_key,
        domain: input.op.domain,
        opType: input.op.type,
        status: input.status,
        clientTimestamp: Number.isNaN(clientTs?.getTime() ?? NaN) ? undefined : clientTs ?? undefined,
        entityType: input.entityType ?? undefined,
        entityId: input.entityId ?? undefined,
        serverVersion: input.serverVersion ?? undefined,
        resolution: input.resolution ?? undefined,
        detail: input.detail ? (input.detail as object) : undefined
      }
    });
  }
}
