import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiConflictResponse, ApiNotFoundResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
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
import { ServiceOnly } from "../common/decorators/service-only.decorator.js";
import { ServiceOrDashboard } from "../common/decorators/service-or-dashboard.decorator.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import {
  ApiContractBody,
  ApiContractQuery,
  ApiContractResponse,
  ApiContractValidationResponse,
} from "../openapi/api-contract.decorator.js";
import { MeetingLifecycleService } from "./meeting-lifecycle.service.js";

@ApiTags("meetings")
@ApiContractValidationResponse()
@Controller("meetings")
export class MeetingsController {
  constructor(@Inject(MeetingLifecycleService) private readonly meetingLifecycleService: MeetingLifecycleService) {}

  // Mutations that change the meeting's live state are bot-only — the bot is
  // the only client that observes Discord voice state, so it's the only one
  // that can supply a trustworthy observedAt/presentMembers for these.
  @Post()
  @ServiceOnly()
  @ApiOperation({
    summary: "Start a meeting",
    description:
      "Snapshots `expectedMembers` and opens sessions for `presentMembers`. The single-live-meeting-per-channel " +
      "rule is enforced by a partial unique index, so a concurrent second call gets a 409 rather than a duplicate.",
  })
  @ApiContractBody("StartMeetingDto")
  @ApiContractResponse(201, "Meeting", { description: "The meeting, now ACTIVE" })
  @ApiNotFoundResponse({ description: "Meeting type not found" })
  @ApiConflictResponse({ description: "Meeting type is archived, or the channel already has a live meeting" })
  start(@Body(new ZodValidationPipe(StartMeetingDto)) dto: StartMeetingDto) {
    return this.meetingLifecycleService.start(dto);
  }

  @Get()
  @ServiceOrDashboard()
  @ApiOperation({ summary: "List meetings", description: "Newest first, 20 per page." })
  @ApiContractQuery("ListMeetingsQueryDto")
  @ApiContractResponse(200, "MeetingsPage")
  list(@Query(new ZodValidationPipe(ListMeetingsQueryDto)) query: ListMeetingsQueryDto) {
    return this.meetingLifecycleService.listMeetings(query);
  }

  @Get("active")
  @ServiceOrDashboard()
  @ApiOperation({ summary: "List live meetings", description: "Both ACTIVE and PAUSED." })
  @ApiContractQuery("ListActiveMeetingsQueryDto")
  @ApiContractResponse(200, "Meeting", { isArray: true })
  listActive(@Query(new ZodValidationPipe(ListActiveMeetingsQueryDto)) query: ListActiveMeetingsQueryDto) {
    return this.meetingLifecycleService.listActive(query.guildId);
  }

  @Get(":id")
  @ServiceOrDashboard()
  @ApiOperation({ summary: "Get one meeting" })
  @ApiParam({ name: "id", description: "Meeting id" })
  @ApiContractResponse(200, "Meeting")
  @ApiNotFoundResponse({ description: "Meeting not found" })
  getById(@Param("id") id: string) {
    return this.meetingLifecycleService.getById(id);
  }

  @Post(":id/pause")
  @ServiceOnly()
  @ApiOperation({ summary: "Pause a meeting", description: "ACTIVE → PAUSED. Closes every open session so none spans the pause." })
  @ApiParam({ name: "id", description: "Meeting id" })
  @ApiContractBody("PauseMeetingDto")
  @ApiContractResponse(201, "Meeting")
  @ApiNotFoundResponse({ description: "Meeting not found" })
  @ApiConflictResponse({ description: "Meeting is not ACTIVE" })
  pause(@Param("id") id: string, @Body(new ZodValidationPipe(PauseMeetingDto)) dto: PauseMeetingDto) {
    return this.meetingLifecycleService.pause(id, dto);
  }

  @Post(":id/resume")
  @ServiceOnly()
  @ApiOperation({ summary: "Resume a meeting", description: "PAUSED → ACTIVE. Opens fresh sessions for `presentMembers` only." })
  @ApiParam({ name: "id", description: "Meeting id" })
  @ApiContractBody("ResumeMeetingDto")
  @ApiContractResponse(201, "Meeting")
  @ApiNotFoundResponse({ description: "Meeting not found" })
  @ApiConflictResponse({ description: "Meeting is not PAUSED" })
  resume(@Param("id") id: string, @Body(new ZodValidationPipe(ResumeMeetingDto)) dto: ResumeMeetingDto) {
    return this.meetingLifecycleService.resume(id, dto);
  }

  @Post(":id/end")
  @ServiceOnly()
  @ApiOperation({ summary: "End a meeting", description: "Closes open sessions and freezes meeting and attendance stats." })
  @ApiParam({ name: "id", description: "Meeting id" })
  @ApiContractBody("EndMeetingDto")
  @ApiContractResponse(201, "Meeting", { description: "The meeting, now COMPLETED, with frozen stats" })
  @ApiNotFoundResponse({ description: "Meeting not found" })
  @ApiConflictResponse({ description: "Meeting is not ACTIVE or PAUSED" })
  end(@Param("id") id: string, @Body(new ZodValidationPipe(EndMeetingDto)) dto: EndMeetingDto) {
    return this.meetingLifecycleService.end(id, dto);
  }

  @Post(":id/cancel")
  @ServiceOnly()
  @ApiOperation({ summary: "Cancel a meeting", description: "Closes open sessions, records a reason, freezes no stats. The record is kept." })
  @ApiParam({ name: "id", description: "Meeting id" })
  @ApiContractBody("CancelMeetingDto")
  @ApiContractResponse(201, "Meeting")
  @ApiNotFoundResponse({ description: "Meeting not found" })
  @ApiConflictResponse({ description: "Meeting is not ACTIVE or PAUSED" })
  cancel(@Param("id") id: string, @Body(new ZodValidationPipe(CancelMeetingDto)) dto: CancelMeetingDto) {
    return this.meetingLifecycleService.cancel(id, dto);
  }

  // The dashboard's inline summary editor writes here directly.
  @Patch(":id/summary")
  @ServiceOrDashboard()
  @ApiOperation({ summary: "Set the meeting summary" })
  @ApiParam({ name: "id", description: "Meeting id" })
  @ApiContractBody("UpdateMeetingSummaryDto")
  @ApiContractResponse(200, "Meeting")
  @ApiNotFoundResponse({ description: "Meeting not found" })
  updateSummary(@Param("id") id: string, @Body(new ZodValidationPipe(UpdateMeetingSummaryDto)) dto: UpdateMeetingSummaryDto) {
    return this.meetingLifecycleService.updateSummary(id, dto);
  }
}
