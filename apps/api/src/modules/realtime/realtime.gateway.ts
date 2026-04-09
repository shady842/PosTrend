import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { PrismaService } from "../database/prisma.service";
import {
  parseAdminTenantRoom,
  parseBranchScopedRoom,
  RealtimeEvents,
  roomAdminTenant,
  roomKdsBranch,
  roomOrdersBranch,
  roomPosBranch
} from "./realtime.constants";

type WsJwtPayload = {
  sub: string;
  role: string;
  tenant_id?: string;
  branch_id?: string;
  concept_id?: string;
};

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ["websocket", "polling"]
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  handleDisconnect(_client: Socket) {
    return;
  }

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    const secret = process.env.JWT_SECRET || "dev-secret";
    if (!token) {
      this.logger.warn("connection rejected: missing token");
      client.emit("error", { message: "auth_required" });
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwtService.verify(token, { secret }) as WsJwtPayload;
      client.data.wsUser = payload;
      await this.applyDefaultSubscriptions(client, payload);
      client.emit(RealtimeEvents.CONNECTED, { authenticated: true });
    } catch {
      this.logger.warn("connection rejected: invalid token");
      client.emit("error", { message: "invalid_token" });
      client.disconnect(true);
    }
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token && typeof auth.token === "string" && auth.token.length > 0) {
      return auth.token.trim();
    }
    const raw = client.handshake.headers.authorization;
    if (typeof raw === "string" && raw.startsWith("Bearer ")) {
      return raw.slice("Bearer ".length).trim();
    }
    return null;
  }

  /** POS devices: branch channels only. Staff: tenant admin room + optional home branch. */
  private async applyDefaultSubscriptions(client: Socket, p: WsJwtPayload) {
    if (p.role === "super_admin" && !p.tenant_id) {
      return;
    }
    if (!p.tenant_id) {
      return;
    }

    if (p.role === "pos_device" && p.branch_id) {
      await client.join(roomOrdersBranch(p.branch_id));
      await client.join(roomKdsBranch(p.branch_id));
      await client.join(roomPosBranch(p.branch_id));
      return;
    }

    await client.join(roomAdminTenant(p.tenant_id));
    if (p.branch_id) {
      await client.join(roomOrdersBranch(p.branch_id));
      await client.join(roomKdsBranch(p.branch_id));
      await client.join(roomPosBranch(p.branch_id));
    }
  }

  @SubscribeMessage("realtime.subscribe")
  async onSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { channels?: string[] }
  ) {
    const user = client.data.wsUser as WsJwtPayload | undefined;
    if (!user?.tenant_id) {
      return { ok: false, error: "unauthorized" };
    }
    const channels = Array.isArray(body?.channels) ? body.channels : [];
    const joined: string[] = [];
    for (const ch of channels) {
      if (typeof ch !== "string" || !ch.trim()) continue;
      const c = ch.trim();
      if (await this.mayJoinChannel(user, c)) {
        await client.join(c);
        joined.push(c);
      }
    }
    return { ok: true, joined };
  }

  @SubscribeMessage("realtime.unsubscribe")
  async onUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { channels?: string[] }
  ) {
    const user = client.data.wsUser as WsJwtPayload | undefined;
    if (!user?.tenant_id) {
      return { ok: false, error: "unauthorized" };
    }
    const channels = Array.isArray(body?.channels) ? body.channels : [];
    const left: string[] = [];
    for (const ch of channels) {
      if (typeof ch !== "string" || !ch.trim()) continue;
      const c = ch.trim();
      if (await this.mayJoinChannel(user, c)) {
        await client.leave(c);
        left.push(c);
      }
    }
    return { ok: true, left };
  }

  /** @deprecated Use realtime.subscribe with channel names. */
  @SubscribeMessage("join_branch")
  async onJoinBranchLegacy(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { branch_id?: string }
  ) {
    const user = client.data.wsUser as WsJwtPayload | undefined;
    const branchId = payload?.branch_id?.trim();
    if (!user?.tenant_id || !branchId) {
      return { ok: false, error: "bad_request" };
    }
    if (!(await this.mayJoinChannel(user, roomOrdersBranch(branchId)))) {
      return { ok: false, error: "forbidden" };
    }
    await client.join(roomOrdersBranch(branchId));
    await client.join(roomKdsBranch(branchId));
    await client.join(roomPosBranch(branchId));
    return { ok: true, joined: branchId };
  }

  private async mayJoinChannel(user: WsJwtPayload, channel: string): Promise<boolean> {
    if (!user.tenant_id) return false;
    const adminId = parseAdminTenantRoom(channel);
    if (adminId) {
      return adminId === user.tenant_id && user.role !== "pos_device";
    }
    const br = parseBranchScopedRoom(channel);
    if (!br) return false;
    const row = await this.prisma.branch.findFirst({
      where: { id: br.branchId, tenantId: user.tenant_id },
      select: { id: true }
    });
    return !!row;
  }

  private envelope(tenantId: string, branchId: string, extra: Record<string, unknown>) {
    return {
      tenant_id: tenantId,
      branch_id: branchId,
      ts: new Date().toISOString(),
      ...extra
    };
  }

  private emitToOrdersPosAdmin(event: string, payload: Record<string, unknown>) {
    const branchId = payload.branch_id as string;
    const tenantId = payload.tenant_id as string;
    this.server.to(roomOrdersBranch(branchId)).emit(event, payload);
    this.server.to(roomPosBranch(branchId)).emit(event, payload);
    this.server.to(roomAdminTenant(tenantId)).emit(event, payload);
  }

  private emitToKdsPosAdmin(event: string, payload: Record<string, unknown>) {
    const branchId = payload.branch_id as string;
    const tenantId = payload.tenant_id as string;
    this.server.to(roomKdsBranch(branchId)).emit(event, payload);
    this.server.to(roomPosBranch(branchId)).emit(event, payload);
    this.server.to(roomAdminTenant(tenantId)).emit(event, payload);
  }

  /** Kitchen flow (SYNC-3): KDS + POS + orders channel + admin — POS tables refresh on orders.branch. */
  private emitKitchenBranchWide(event: string, payload: Record<string, unknown>) {
    const branchId = payload.branch_id as string;
    const tenantId = payload.tenant_id as string;
    this.server.to(roomKdsBranch(branchId)).emit(event, payload);
    this.server.to(roomPosBranch(branchId)).emit(event, payload);
    this.server.to(roomOrdersBranch(branchId)).emit(event, payload);
    this.server.to(roomAdminTenant(tenantId)).emit(event, payload);
  }

  broadcastOrderCreated(tenantId: string, branchId: string, orderId: string) {
    const payload = this.envelope(tenantId, branchId, { order_id: orderId });
    this.emitToOrdersPosAdmin(RealtimeEvents.ORDER_CREATED, payload);
  }

  broadcastOrderUpdated(tenantId: string, branchId: string, orderId: string) {
    const payload = this.envelope(tenantId, branchId, { order_id: orderId });
    this.emitToOrdersPosAdmin(RealtimeEvents.ORDER_UPDATED, payload);
  }

  broadcastOrderClosed(tenantId: string, branchId: string, orderId: string) {
    const payload = this.envelope(tenantId, branchId, { order_id: orderId });
    this.emitToOrdersPosAdmin(RealtimeEvents.ORDER_CLOSED, payload);
  }

  broadcastPaymentAdded(tenantId: string, branchId: string, orderId: string, paymentId: string) {
    const payload = this.envelope(tenantId, branchId, { order_id: orderId, payment_id: paymentId });
    this.emitToOrdersPosAdmin(RealtimeEvents.PAYMENT_ADDED, payload);
  }

  broadcastKdsUpdated(
    tenantId: string,
    branchId: string,
    ticketId: string,
    orderId: string,
    status: string
  ) {
    const payload = this.envelope(tenantId, branchId, {
      ticket_id: ticketId,
      order_id: orderId,
      status
    });
    this.emitToKdsPosAdmin(RealtimeEvents.KDS_UPDATED, payload);
  }

  broadcastOrderSent(tenantId: string, branchId: string, orderId: string, ticketIds: string[]) {
    const payload = this.envelope(tenantId, branchId, {
      order_id: orderId,
      ticket_ids: ticketIds
    });
    this.emitKitchenBranchWide(RealtimeEvents.ORDER_SENT, payload);
  }

  broadcastItemPreparing(tenantId: string, branchId: string, orderId: string, ticketId: string) {
    const payload = this.envelope(tenantId, branchId, {
      order_id: orderId,
      ticket_id: ticketId
    });
    this.emitKitchenBranchWide(RealtimeEvents.ITEM_PREPARING, payload);
  }

  broadcastItemReady(tenantId: string, branchId: string, orderId: string, ticketId: string) {
    const payload = this.envelope(tenantId, branchId, {
      order_id: orderId,
      ticket_id: ticketId
    });
    this.emitKitchenBranchWide(RealtimeEvents.ITEM_READY, payload);
  }

  /** Hint for POS offline sync / pull (pos channel + admin). */
  broadcastSyncDeltaAvailable(tenantId: string, branchId: string) {
    const payload = this.envelope(tenantId, branchId, {});
    this.server.to(roomPosBranch(branchId)).emit(RealtimeEvents.SYNC_DELTA_AVAILABLE, payload);
    this.server.to(roomAdminTenant(tenantId)).emit(RealtimeEvents.SYNC_DELTA_AVAILABLE, payload);
  }
}
