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
  await app.listen(port, host);
}

bootstrap();
