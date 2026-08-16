import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { ManualAttendanceDto, SyncAttendanceDto } from "@meeting-system/contracts";
import { ServiceTokenGuard } from "../common/guards/service-token.guard.js";
import { ServiceOrJwtGuard } from "../common/guards/service-or-jwt.guard.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { AttendanceService } from "./attendance.service.js";
import { AttendanceResolverService } from "./attendance-resolver.service.js";

@Controller("meetings")
export class AttendanceController {
  constructor(
    @Inject(AttendanceService) private readonly attendanceService: AttendanceService,
    @Inject(AttendanceResolverService) private readonly attendanceResolver: AttendanceResolverService,
  ) {}

  @Get(":id/attendance")
  @UseGuards(ServiceOrJwtGuard)
  list(@Param("id") meetingId: string) {
    return this.attendanceService.listForMeeting(meetingId);
  }

  // Only the bot observes live voice state, so only the bot may sync it.
  @Post(":id/attendance/sync")
  @UseGuards(ServiceTokenGuard)
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
  @UseGuards(ServiceOrJwtGuard)
  manual(@Param("id") meetingId: string, @Body(new ZodValidationPipe(ManualAttendanceDto)) dto: ManualAttendanceDto) {
    return this.attendanceService.manualCorrection(meetingId, dto);
  }
}
