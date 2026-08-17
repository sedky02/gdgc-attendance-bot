import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { VoiceEventDto, type PingResponseDto } from "@meeting-system/contracts";
import { ServiceOnly } from "../common/decorators/service-only.decorator.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import {
  ApiContractBody,
  ApiContractResponse,
  ApiContractValidationResponse,
} from "../openapi/api-contract.decorator.js";
import { InternalService } from "./internal.service.js";

@ApiTags("internal")
@ApiContractValidationResponse()
@Controller("internal")
@ServiceOnly()
export class InternalController {
  constructor(@Inject(InternalService) private readonly internalService: InternalService) {}

  @Get("ping")
  @ApiOperation({ summary: "Round-trip check", description: "Backs the bot's `/ping` command." })
  @ApiContractResponse(200, "PingResponseDto")
  ping(): PingResponseDto {
    return {
      message: "pong",
      timestamp: new Date(),
    };
  }

  @Post("voice-events")
  @ApiOperation({
    summary: "Report a voice-state transition",
    description:
      "One event carries both `from` and `to`, so a channel move is never split into a leave and a join that " +
      "could arrive out of order. Either side may be null (a plain join, a plain leave, or an AFK-channel move, " +
      "which counts as leaving). Events for channels with no ACTIVE meeting are acknowledged and dropped.",
  })
  @ApiContractBody("VoiceEventDto")
  @ApiContractResponse(201, "AcknowledgedResponseDto")
  async voiceEvents(@Body(new ZodValidationPipe(VoiceEventDto)) dto: VoiceEventDto) {
    await this.internalService.handleVoiceEvent(dto);
    return { acknowledged: true };
  }

  @Post("bootstrap")
  @ApiOperation({
    summary: "List every live meeting, across all guilds",
    description: "Called by the bot on startup and shard resume to rediscover what it should be reconciling.",
  })
  @ApiContractResponse(201, "Meeting", { isArray: true })
  bootstrap() {
    return this.internalService.bootstrap();
  }
}
