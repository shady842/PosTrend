import { OrdersService } from "./orders.service";

describe("OrdersService", () => {
  const tenantCtx = {
    tenant_id: "t1",
    concept_id: "c1",
    branch_id: "b1",
    role: "tenant_owner",
    sub: "u1"
  };

  it("closes order in transaction and deducts inventory", async () => {
    const tx = {
      order: {
        update: jest.fn().mockResolvedValue(undefined)
      }
    };

    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: "o1",
          tenantId: "t1",
          conceptId: "c1",
          branchId: "b1",
          items: [{ menuItemId: "m1", qty: 2 }],
          payments: []
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: "o1",
          tenantId: "t1",
          conceptId: "c1",
          branchId: "b1",
          items: [{ menuItemId: "m1", qty: 2 }],
          payments: []
        })
      },
      $transaction: jest.fn().mockImplementation(async (cb: (client: any) => Promise<void>) => cb(tx))
    } as any;

    const inventoryService = {
      consumeForOrder: jest.fn().mockResolvedValue(undefined)
    } as any;

    const realtimeGateway = {
      emitSyncAvailable: jest.fn(),
      emitKdsUpdate: jest.fn(),
      emitPosOrderUpdate: jest.fn()
    } as any;

    const kdsService = {
      createTicket: jest.fn().mockResolvedValue(undefined)
    } as any;
    const shiftService = {
      ensureOpenShift: jest.fn().mockResolvedValue(undefined)
    } as any;

    const service = new OrdersService(prisma, inventoryService, kdsService, realtimeGateway, shiftService);
    await service.close("o1", tenantCtx);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { status: "closed" }
    });
    expect(inventoryService.consumeForOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        conceptId: "c1",
        branchId: "b1",
        orderId: "o1"
      }),
      tx
    );
    expect(realtimeGateway.emitSyncAvailable).toHaveBeenCalledWith("b1");
  });
});
