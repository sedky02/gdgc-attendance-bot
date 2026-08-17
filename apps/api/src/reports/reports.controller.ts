import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ApiNotFoundResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { ServiceOrDashboard } from "../common/decorators/service-or-dashboard.decorator.js";
import { ApiContractResponse } from "../openapi/api-contract.decorator.js";
import { ReportsService } from "./reports.service.js";

@ApiTags("reports")
@Controller("meetings")
@ServiceOrDashboard()
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Get(":id/report")
  @ApiOperation({
    summary: "Get the assembled meeting report",
    description:
      "Meeting, attendance, and absentees in one payload. Absentees come from the `expectedMembers` snapshot taken " +
      "at start, not from current role membership. Stats are the frozen values for a COMPLETED meeting and computed " +
      "as-of-now for one still live.",
  })
  @ApiParam({ name: "id", description: "Meeting id" })
  @ApiContractResponse(200, "MeetingReport")
  @ApiNotFoundResponse({ description: "Meeting not found" })
  getReport(@Param("id") meetingId: string) {
    return this.reportsService.getReport(meetingId);
  }
}
