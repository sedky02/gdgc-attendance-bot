import { Controller, Get } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import type { Connection } from "mongoose";
import type { HealthResponseDto } from "@meeting-system/contracts";

@Controller("health")
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  check(): HealthResponseDto {
    return {
      status: "ok",
      mongo: this.connection.readyState === 1 ? "connected" : "disconnected",
      timestamp: new Date(),
    };
  }
}
