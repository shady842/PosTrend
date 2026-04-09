import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../app.module";

describe("Health endpoint", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.SKIP_DB_CONNECT = "true";
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("v1");
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("GET /v1/health returns ok", async () => {
    const res = await request(app.getHttpServer()).get("/v1/health").expect(200);
    expect(res.body.status).toBe("ok");
  });
});
