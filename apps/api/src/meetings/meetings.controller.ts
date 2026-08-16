import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  CancelMeetingDto,
  EndMeetingDto,
  ListActiveMeetingsQueryDto,
  ListMeetingsQueryDto,
  PauseMeetingDto,
  ResumeMeetingDto,
  StartMeetingDto,
  UpdateMeetingSummaryDto,
} from "@meeting-system/contracts";
import { ServiceTokenGuard } from "../common/guards/service-token.guard.js";
import { ServiceOrJwtGuard } from "../common/guards/service-or-jwt.guard.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { MeetingLifecycleService } from "./meeting-lifecycle.service.js";

@Controller("meetings")
export class MeetingsController {
  constructor(@Inject(MeetingLifecycleService) private readonly meetingLifecycleService: MeetingLifecycleService) {}

  // Mutations that change the meeting's live state are bot-only — the bot is
  // the only client that observes Discord voice state, so it's the only one
  // that can supply a trustworthy observedAt/presentMembers for these.
  @Post()
  @UseGuards(ServiceTokenGuard)
  start(@Body(new ZodValidationPipe(StartMeetingDto)) dto: StartMeetingDto) {
    return this.meetingLifecycleService.start(dto);
  }

  @Get()
  @UseGuards(ServiceOrJwtGuard)
  list(@Query(new ZodValidationPipe(ListMeetingsQueryDto)) query: ListMeetingsQueryDto) {
    return this.meetingLifecycleService.listMeetings(query);
  }

  @Get("active")
  @UseGuards(ServiceOrJwtGuard)
  listActive(@Query(new ZodValidationPipe(ListActiveMeetingsQueryDto)) query: ListActiveMeetingsQueryDto) {
    return this.meetingLifecycleService.listActive(query.guildId);
  }

  @Get(":id")
  @UseGuards(ServiceOrJwtGuard)
  getById(@Param("id") id: string) {
    return this.meetingLifecycleService.getById(id);
  }

  @Post(":id/pause")
  @UseGuards(ServiceTokenGuard)
  pause(@Param("id") id: string, @Body(new ZodValidationPipe(PauseMeetingDto)) dto: PauseMeetingDto) {
    return this.meetingLifecycleService.pause(id, dto);
  }

  @Post(":id/resume")
  @UseGuards(ServiceTokenGuard)
  resume(@Param("id") id: string, @Body(new ZodValidationPipe(ResumeMeetingDto)) dto: ResumeMeetingDto) {
    return this.meetingLifecycleService.resume(id, dto);
  }

  @Post(":id/end")
  @UseGuards(ServiceTokenGuard)
  end(@Param("id") id: string, @Body(new ZodValidationPipe(EndMeetingDto)) dto: EndMeetingDto) {
    return this.meetingLifecycleService.end(id, dto);
  }

  @Post(":id/cancel")
  @UseGuards(ServiceTokenGuard)
  cancel(@Param("id") id: string, @Body(new ZodValidationPipe(CancelMeetingDto)) dto: CancelMeetingDto) {
    return this.meetingLifecycleService.cancel(id, dto);
  }

  // The dashboard's inline summary editor writes here directly.
  @Patch(":id/summary")
  @UseGuards(ServiceOrJwtGuard)
  updateSummary(@Param("id") id: string, @Body(new ZodValidationPipe(UpdateMeetingSummaryDto)) dto: UpdateMeetingSummaryDto) {
    return this.meetingLifecycleService.updateSummary(id, dto);
  }
}
