/** Socket.IO room names — branch and tenant scoped. */
export function roomOrdersBranch(branchId: string) {
  return `orders.branch.${branchId}`;
}

export function roomKdsBranch(branchId: string) {
  return `kds.branch.${branchId}`;
}

export function roomPosBranch(branchId: string) {
  return `pos.branch.${branchId}`;
}

export function roomAdminTenant(tenantId: string) {
  return `admin.tenant.${tenantId}`;
}

/** Canonical realtime event names (SYNC-1 / SYNC-3). */
export const RealtimeEvents = {
  ORDER_CREATED: "order.created",
  ORDER_UPDATED: "order.updated",
  ORDER_CLOSED: "order.closed",
  PAYMENT_ADDED: "payment.added",
  KDS_UPDATED: "kds.updated",
  /** New tickets sent to kitchen (SYNC-3). */
  ORDER_SENT: "order.sent",
  /** Ticket / line flow into preparing (SYNC-3). */
  ITEM_PREPARING: "item.preparing",
  /** Ticket / line marked ready for pickup (SYNC-3). */
  ITEM_READY: "item.ready",
  SYNC_DELTA_AVAILABLE: "sync.delta.available",
  CONNECTED: "connected"
} as const;

const BRANCH_ROOM = /^(orders|kds|pos)\.branch\.(.+)$/;

export function parseBranchScopedRoom(
  channel: string
): { kind: "orders" | "kds" | "pos"; branchId: string } | null {
  const m = channel.match(BRANCH_ROOM);
  if (!m) return null;
  const kind = m[1] as "orders" | "kds" | "pos";
  return { kind, branchId: m[2] };
}

export function parseAdminTenantRoom(channel: string): string | null {
  const m = channel.match(/^admin\.tenant\.(.+)$/);
  return m ? m[1] : null;
}
