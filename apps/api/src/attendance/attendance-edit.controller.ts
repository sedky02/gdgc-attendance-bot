import { Body, Controller, Inject, Param, Patch, UseGuards } from "@nestjs/common";
import { UpdateAttendanceDto } from "@meeting-system/contracts";
import { ServiceOrJwtGuard } from "../common/guards/service-or-jwt.guard.js";
import { ResourceType } from "../common/decorators/resource-type.decorator.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { AttendanceService } from "./attendance.service.js";

@Controller("attendance")
@UseGuards(ServiceOrJwtGuard)
@ResourceType("attendance")
export class AttendanceEditController {
  constructor(@Inject(AttendanceService) private readonly attendanceService: AttendanceService) {}

  @Patch(":id")
  update(@Param("id") id: string, @Body(new ZodValidationPipe(UpdateAttendanceDto)) dto: UpdateAttendanceDto) {
    return this.attendanceService.updateSession(id, dto);
  }
}
