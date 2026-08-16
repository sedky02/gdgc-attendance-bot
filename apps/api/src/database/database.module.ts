import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import type { Env } from "../config/env.validation.js";

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Env, true>) => ({
        uri: configService.get("MONGODB_URI", { infer: true }),
      }),
    }),
  ],
})
export class DatabaseModule {}
