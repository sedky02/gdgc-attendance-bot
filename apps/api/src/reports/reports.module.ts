import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Attendance, AttendanceSchema } from "../attendance/schemas/attendance.schema.js";
import { Meeting, MeetingSchema } from "../meetings/schemas/meeting.schema.js";
import { AttendanceModule } from "../attendance/attendance.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { GuildOwnershipModule } from "../common/guild-ownership.module.js";
import { ReportsService } from "./reports.service.js";
import { ReportsController } from "./reports.controller.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Meeting.name, schema: MeetingSchema },
    ]),
    AttendanceModule,
    AuthModule,
    GuildOwnershipModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
