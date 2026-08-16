import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { VoiceEventDto, type PingResponseDto } from "@meeting-system/contracts";
import { ServiceOnly } from "../common/decorators/service-only.decorator.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { InternalService } from "./internal.service.js";

@Controller("internal")
@ServiceOnly()
export class InternalController {
  constructor(@Inject(InternalService) private readonly internalService: InternalService) {}

  @Get("ping")
  ping(): PingResponseDto {
    return {
      message: "pong",
      timestamp: new Date(),
    };
  }

  @Post("voice-events")
  async voiceEvents(@Body(new ZodValidationPipe(VoiceEventDto)) dto: VoiceEventDto) {
    await this.internalService.handleVoiceEvent(dto);
    return { acknowledged: true };
  }

  @Post("bootstrap")
  bootstrap() {
    return this.internalService.bootstrap();
  }
}
