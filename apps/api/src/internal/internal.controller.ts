import { Controller, Get } from "@nestjs/common";
import type { PingResponseDto } from "@meeting-system/contracts";
import { ServiceOnly } from "../common/decorators/service-only.decorator.js";

@Controller("internal")
@ServiceOnly()
export class InternalController {
  @Get("ping")
  ping(): PingResponseDto {
    return {
      message: "pong",
      timestamp: new Date(),
    };
  }
}
