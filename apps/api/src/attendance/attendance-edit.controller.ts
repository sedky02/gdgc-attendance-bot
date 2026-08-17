import { Body, Controller, Inject, Param, Patch } from "@nestjs/common";
import { ApiNotFoundResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { UpdateAttendanceDto } from "@meeting-system/contracts";
import { ServiceOrDashboard } from "../common/decorators/service-or-dashboard.decorator.js";
import { ResourceType } from "../common/decorators/resource-type.decorator.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import {
  ApiContractBody,
  ApiContractResponse,
  ApiContractValidationResponse,
} from "../openapi/api-contract.decorator.js";
import { AttendanceService } from "./attendance.service.js";

@ApiTags("attendance")
@ApiContractValidationResponse()
@Controller("attendance")
@ServiceOrDashboard()
@ResourceType("attendance")
export class AttendanceEditController {
  constructor(@Inject(AttendanceService) private readonly attendanceService: AttendanceService) {}

  @Patch(":id")
  @ApiOperation({
    summary: "Edit an attendance record's sessions",
    description:
      "Replaces the session list wholesale and marks the record `manuallyEdited`. Send the attendee's complete " +
      "session list, not just the one being changed — anything omitted is dropped.",
  })
  @ApiParam({ name: "id", description: "Attendance id (not the meeting id)" })
  @ApiContractBody("UpdateAttendanceDto")
  @ApiContractResponse(200, "Attendance")
  @ApiNotFoundResponse({ description: "Attendance record not found" })
  update(@Param("id") id: string, @Body(new ZodValidationPipe(UpdateAttendanceDto)) dto: UpdateAttendanceDto) {
    return this.attendanceService.updateSession(id, dto);
  }
}
