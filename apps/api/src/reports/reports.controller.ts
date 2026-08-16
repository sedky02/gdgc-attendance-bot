import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ServiceOnly } from "../common/decorators/service-only.decorator.js";
import { ReportsService } from "./reports.service.js";

@Controller("meetings")
@ServiceOnly()
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Get(":id/report")
  getReport(@Param("id") meetingId: string) {
    return this.reportsService.getReport(meetingId);
  }
}
