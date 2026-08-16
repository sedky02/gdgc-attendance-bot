import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { SyncAttendanceDto } from "@meeting-system/contracts";
import { ServiceOnly } from "../common/decorators/service-only.decorator.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { AttendanceService } from "./attendance.service.js";
import { AttendanceResolverService } from "./attendance-resolver.service.js";

@Controller("meetings")
@ServiceOnly()
export class AttendanceController {
  constructor(
    @Inject(AttendanceService) private readonly attendanceService: AttendanceService,
    @Inject(AttendanceResolverService) private readonly attendanceResolver: AttendanceResolverService,
  ) {}

  @Get(":id/attendance")
  list(@Param("id") meetingId: string) {
    return this.attendanceService.listForMeeting(meetingId);
  }

  @Post(":id/attendance/sync")
  async sync(@Param("id") meetingId: string, @Body(new ZodValidationPipe(SyncAttendanceDto)) dto: SyncAttendanceDto) {
    await this.attendanceResolver.resolvePresence(meetingId, {
      presentMembers: dto.presentMembers,
      observedAt: dto.observedAt,
      scope: "FULL",
      source: "SYNC",
    });
    return { acknowledged: true };
  }
}
