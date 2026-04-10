import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./modules/app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const isProd = process.env.NODE_ENV === "production";
  const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:3001")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    // Dev: allow admin from any host (LAN IP + localhost) so phones and tablets can reach the API.
    // Prod: set NODE_ENV=production and CORS_ORIGINS to your real admin URL(s).
    origin: isProd ? corsOrigins : true,
    credentials: true
  });
  app.setGlobalPrefix("v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "0.0.0.0";
  // Friendly root so browsers / quick connectivity checks are not confused by 404.
  const expressApp = app.getHttpAdapter().getInstance() as {
    get?: (path: string, handler: (req: unknown, res: { json: (b: unknown) => void }) => void) => void;
  };
  expressApp.get?.("/", (_req, res) => {
    res.json({
      service: "postrend-api",
      status: "ok",
      message: "API is running. All HTTP routes are under /v1.",
      health: "/v1/health"
    });
  });
  await app.listen(port, host);
}

bootstrap();
