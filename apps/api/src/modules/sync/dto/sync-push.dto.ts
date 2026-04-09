import { Type } from "class-transformer";
import { IsArray, IsIn, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";

/**
 * Each op carries a JSON `payload`. Optional concurrency fields (SYNC-5):
 * - `expected_version` (number): optimistic version for the affected order on order/payment/table ops
 *   except `merge_orders` (see below). Omit for legacy last-write-wins–only clients.
 * - `expected_version_source` / `expected_version_target` (numbers): for `table` / `merge_orders` only,
 *   align with `source_order_id` and `target_order_id`.
 */
export class SyncPushOpDto {
  @IsIn(["order", "payment", "table", "shift"])
  domain!: "order" | "payment" | "table" | "shift";

  @IsString()
  type!: string;

  @IsString()
  idempotency_key!: string;

  /** Client-generated operation id (e.g. outbox row) for sync_logs. */
  @IsOptional()
  @IsString()
  op_id?: string;

  /** Client wall time when the op was created (ISO-8601); used for last-write-wins. */
  @IsOptional()
  @IsString()
  client_timestamp?: string;

  @IsObject()
  payload!: Record<string, unknown>;
}

export class SyncPushRequestDto {
  @IsOptional()
  @IsString()
  device_id?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncPushOpDto)
  ops!: SyncPushOpDto[];
}
