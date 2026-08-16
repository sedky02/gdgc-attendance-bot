import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter.js";
import type { Env } from "./config/env.validation.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix("api/v1", { exclude: ["health"] });

  const configService = app.get(ConfigService<Env, true>);
  app.enableCors({ origin: configService.get("CORS_ORIGIN", { infer: true }) });

  app.useGlobalFilters(new AllExceptionsFilter(app.get(Logger)));

  const port = configService.get("PORT", { infer: true });
  await app.listen(port);
}

bootstrap();
