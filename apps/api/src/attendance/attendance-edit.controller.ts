import { Body, Controller, Inject, Param, Patch } from "@nestjs/common";
import { UpdateAttendanceDto } from "@meeting-system/contracts";
import { ServiceOnly } from "../common/decorators/service-only.decorator.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { AttendanceService } from "./attendance.service.js";

@Controller("attendance")
@ServiceOnly()
export class AttendanceEditController {
  constructor(@Inject(AttendanceService) private readonly attendanceService: AttendanceService) {}

  @Patch(":id")
  update(@Param("id") id: string, @Body(new ZodValidationPipe(UpdateAttendanceDto)) dto: UpdateAttendanceDto) {
    return this.attendanceService.updateSession(id, dto);
  }
}
