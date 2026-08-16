import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import {
  CancelMeetingDto,
  EndMeetingDto,
  ListActiveMeetingsQueryDto,
  PauseMeetingDto,
  ResumeMeetingDto,
  StartMeetingDto,
  UpdateMeetingSummaryDto,
} from "@meeting-system/contracts";
import { ServiceOnly } from "../common/decorators/service-only.decorator.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { MeetingLifecycleService } from "./meeting-lifecycle.service.js";

@Controller("meetings")
@ServiceOnly()
export class MeetingsController {
  constructor(@Inject(MeetingLifecycleService) private readonly meetingLifecycleService: MeetingLifecycleService) {}

  @Post()
  start(@Body(new ZodValidationPipe(StartMeetingDto)) dto: StartMeetingDto) {
    return this.meetingLifecycleService.start(dto);
  }

  @Get("active")
  listActive(@Query(new ZodValidationPipe(ListActiveMeetingsQueryDto)) query: ListActiveMeetingsQueryDto) {
    return this.meetingLifecycleService.listActive(query.guildId);
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.meetingLifecycleService.getById(id);
  }

  @Post(":id/pause")
  pause(@Param("id") id: string, @Body(new ZodValidationPipe(PauseMeetingDto)) dto: PauseMeetingDto) {
    return this.meetingLifecycleService.pause(id, dto);
  }

  @Post(":id/resume")
  resume(@Param("id") id: string, @Body(new ZodValidationPipe(ResumeMeetingDto)) dto: ResumeMeetingDto) {
    return this.meetingLifecycleService.resume(id, dto);
  }

  @Post(":id/end")
  end(@Param("id") id: string, @Body(new ZodValidationPipe(EndMeetingDto)) dto: EndMeetingDto) {
    return this.meetingLifecycleService.end(id, dto);
  }

  @Post(":id/cancel")
  cancel(@Param("id") id: string, @Body(new ZodValidationPipe(CancelMeetingDto)) dto: CancelMeetingDto) {
    return this.meetingLifecycleService.cancel(id, dto);
  }

  @Patch(":id/summary")
  updateSummary(@Param("id") id: string, @Body(new ZodValidationPipe(UpdateMeetingSummaryDto)) dto: UpdateMeetingSummaryDto) {
    return this.meetingLifecycleService.updateSummary(id, dto);
  }
}
