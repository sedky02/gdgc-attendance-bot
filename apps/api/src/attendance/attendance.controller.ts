import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiNotFoundResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { ManualAttendanceDto, SyncAttendanceDto } from "@meeting-system/contracts";
import { ServiceOnly } from "../common/decorators/service-only.decorator.js";
import { ServiceOrDashboard } from "../common/decorators/service-or-dashboard.decorator.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import {
  ApiContractBody,
  ApiContractResponse,
  ApiContractValidationResponse,
} from "../openapi/api-contract.decorator.js";
import { AttendanceService } from "./attendance.service.js";
import { AttendanceResolverService } from "./attendance-resolver.service.js";

@ApiTags("attendance")
@ApiContractValidationResponse()
@Controller("meetings")
export class AttendanceController {
  constructor(
    @Inject(AttendanceService) private readonly attendanceService: AttendanceService,
    @Inject(AttendanceResolverService) private readonly attendanceResolver: AttendanceResolverService,
  ) {}

  @Get(":id/attendance")
  @ServiceOrDashboard()
  @ApiOperation({
    summary: "List attendance for a meeting",
    description: "`stats` is null while the meeting is live and frozen at `/end`. A session with `leftAt: null` is still open.",
  })
  @ApiParam({ name: "id", description: "Meeting id" })
  @ApiContractResponse(200, "Attendance", { isArray: true })
  list(@Param("id") meetingId: string) {
    return this.attendanceService.listForMeeting(meetingId);
  }

  // Only the bot observes live voice state, so only the bot may sync it.
  @Post(":id/attendance/sync")
  @ServiceOnly()
  @ApiOperation({
    summary: "Reconcile the full roster",
    description:
      "The 60-second reconciliation path. `presentMembers` is the complete roster: sessions open for newcomers and " +
      "close for anyone absent. Idempotent — a replay with an older `observedAt` changes nothing, and the call is a " +
      "no-op unless the meeting is ACTIVE.",
  })
  @ApiParam({ name: "id", description: "Meeting id" })
  @ApiContractBody("SyncAttendanceDto")
  @ApiContractResponse(201, "AcknowledgedResponseDto", { description: "Sync applied, or ignored because the meeting is not ACTIVE" })
  async sync(@Param("id") meetingId: string, @Body(new ZodValidationPipe(SyncAttendanceDto)) dto: SyncAttendanceDto) {
    await this.attendanceResolver.resolvePresence(meetingId, {
      presentMembers: dto.presentMembers,
      observedAt: dto.observedAt,
      scope: "FULL",
      source: "SYNC",
    });
    return { acknowledged: true };
  }

  // The dashboard's manual-correction UI writes here.
  @Post(":id/attendance/manual")
  @ServiceOrDashboard()
  @ApiOperation({
    summary: "Manually correct one attendee",
    description:
      "The escape hatch for a bot outage. Replaces that attendee's session list wholesale, sets `manuallyEdited`, " +
      "and re-freezes stats if the meeting is already COMPLETED.",
  })
  @ApiParam({ name: "id", description: "Meeting id" })
  @ApiContractBody("ManualAttendanceDto")
  @ApiContractResponse(201, "Attendance")
  @ApiNotFoundResponse({ description: "Meeting not found" })
  manual(@Param("id") meetingId: string, @Body(new ZodValidationPipe(ManualAttendanceDto)) dto: ManualAttendanceDto) {
    return this.attendanceService.manualCorrection(meetingId, dto);
  }
}
