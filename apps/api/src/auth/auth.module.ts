import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import type { Env } from "../config/env.validation.js";

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Env, true>) => ({
        secret: configService.get("JWT_SECRET", { infer: true }),
        signOptions: { expiresIn: "7d" },
      }),
    }),
  ],
  exports: [JwtModule],
})
export class AuthModule {}
