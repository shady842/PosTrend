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

@WebSocketGateway({
  cors: {
    origin: "*"
  }
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    client.emit("connected", { status: "ok" });
  }

  handleDisconnect(_client: Socket) {
    return;
  }

  @SubscribeMessage("join_branch")
  onJoinBranch(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { branch_id: string }
  ) {
    client.join(`branch:${payload.branch_id}`);
    return { joined: payload.branch_id };
  }

  emitKdsUpdate(branchId: string, ticketId: string, status: string) {
    this.server.to(`branch:${branchId}`).emit("kds.ticket.updated", {
      ticket_id: ticketId,
      status
    });
  }

  /** Live POS / kitchen monitor: order list should refresh or patch. */
  emitPosOrderUpdate(branchId: string, orderId: string) {
    this.server.to(`branch:${branchId}`).emit("pos.order.updated", {
      order_id: orderId,
      branch_id: branchId
    });
  }

  emitSyncAvailable(branchId: string) {
    this.server.to(`branch:${branchId}`).emit("sync.delta.available", {
      branch_id: branchId
    });
  }
}
