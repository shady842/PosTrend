import { INestApplication, Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    if (process.env.SKIP_DB_CONNECT === "true") {
      return;
    }
    await this.$connect();
  }

  async enableShutdownHooks(_app: INestApplication) {
    return Promise.resolve();
  }
}
