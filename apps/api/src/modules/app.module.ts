import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AccountingModule } from "./accounting/accounting.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AiModule } from "./ai/ai.module";
import { AuthModule } from "./auth/auth.module";
import { AssetsModule } from "./assets/assets.module";
import { BankModule } from "./bank/bank.module";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { HrModule } from "./hr/hr.module";
import { InventoryModule } from "./inventory/inventory.module";
import { KdsModule } from "./kds/kds.module";
import { MenuModule } from "./menu/menu.module";
import { OrdersModule } from "./orders/orders.module";
import { OcrModule } from "./ocr/ocr.module";
import { OrgModule } from "./org/org.module";
import { PaymentsModule } from "./payments/payments.module";
import { PromotionsModule } from "./promotions/promotions.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { ReportsModule } from "./reports/reports.module";
import { PostingModule } from "./posting/posting.module";
import { SaasModule } from "./saas/saas.module";
import { ShiftModule } from "./shift/shift.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { SyncModule } from "./sync/sync.module";
import { TenantModule } from "./tenant/tenant.module";
import { CustomersModule } from "./customers/customers.module";
import { SuperAdminModule } from "./super-admin/super-admin.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AiModule,
    AnalyticsModule,
    AccountingModule,
    HrModule,
    HealthModule,
    TenantModule,
    SaasModule,
    AuthModule,
    AssetsModule,
    BankModule,
    CustomersModule,
    OrgModule,
    MenuModule,
    OcrModule,
    OrdersModule,
    PaymentsModule,
    RealtimeModule,
    KdsModule,
    PostingModule,
    InventoryModule,
    SuppliersModule,
    ShiftModule,
    SyncModule,
    ReportsModule
    ,
    PromotionsModule,
    SuperAdminModule
  ]
})
export class AppModule {}
