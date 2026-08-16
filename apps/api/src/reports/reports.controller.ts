import { Controller, Get, Inject, Param, UseGuards } from "@nestjs/common";
import { ServiceOrJwtGuard } from "../common/guards/service-or-jwt.guard.js";
import { ReportsService } from "./reports.service.js";

@Controller("meetings")
@UseGuards(ServiceOrJwtGuard)
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Get(":id/report")
  getReport(@Param("id") meetingId: string) {
    return this.reportsService.getReport(meetingId);
  }
}
