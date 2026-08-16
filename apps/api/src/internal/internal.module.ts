import { Module } from "@nestjs/common";
import { MeetingsModule } from "../meetings/meetings.module.js";
import { AttendanceModule } from "../attendance/attendance.module.js";
import { InternalController } from "./internal.controller.js";
import { InternalService } from "./internal.service.js";

@Module({
  imports: [MeetingsModule, AttendanceModule],
  controllers: [InternalController],
  providers: [InternalService],
})
export class InternalModule {}
