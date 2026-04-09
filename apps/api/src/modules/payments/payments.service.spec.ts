import { PaymentsService } from "./payments.service";

describe("PaymentsService", () => {
  const tenantCtx = {
    tenant_id: "t1",
    concept_id: "c1",
    branch_id: "b1",
    role: "tenant_owner",
    sub: "u1"
  };

  it("creates payment and posts accounting in one transaction", async () => {
    const tx = {
      payment: {
        create: jest.fn().mockResolvedValue({
          id: "p1",
          paymentMethod: "cash",
          amount: 20,
          status: "paid"
        })
      },
      paymentAuditLog: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };

    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: "o1",
          customerId: null,
          total: 20
        })
      },
      payment: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([])
      },
      $transaction: jest.fn().mockImplementation(async (cb: (client: any) => Promise<any>) => cb(tx))
    } as any;

    const ordersService = {
      getForTenant: jest.fn().mockResolvedValue({
        id: "o1",
        tenantId: "t1",
        conceptId: "c1",
        branchId: "b1",
        total: 20,
        tax: 2
      })
    } as any;

    const accountingService = {
      postOrderPayment: jest.fn().mockResolvedValue(undefined)
    } as any;
    const inventoryService = {
      consumeForOrder: jest.fn().mockResolvedValue(undefined)
    } as any;

    const realtimeGateway = {
      broadcastPaymentAdded: jest.fn(),
      broadcastOrderUpdated: jest.fn()
    } as any;

    const posting = {
      post: jest.fn().mockResolvedValue({ status: "ok" })
    } as any;

    const service = new PaymentsService(
      prisma,
      ordersService,
      accountingService,
      inventoryService,
      realtimeGateway,
      posting
    );
    const result = await service.pay("o1", { method: "cash", amount: 20 }, tenantCtx);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.payment.create).toHaveBeenCalled();
    expect(accountingService.postOrderPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        conceptId: "c1",
        branchId: "b1",
        orderId: "o1",
        total: 20,
        tax: 2
      }),
      tx
    );
    expect(result).toBeDefined();
  });
});
