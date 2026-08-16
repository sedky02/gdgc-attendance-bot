import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Attendance, AttendanceSchema } from "./schemas/attendance.schema.js";
import { Meeting, MeetingSchema } from "../meetings/schemas/meeting.schema.js";
import { AuthModule } from "../auth/auth.module.js";
import { GuildOwnershipModule } from "../common/guild-ownership.module.js";
import { AttendanceResolverService } from "./attendance-resolver.service.js";
import { AttendanceStatsService } from "./attendance-stats.service.js";
import { AttendanceService } from "./attendance.service.js";
import { AttendanceController } from "./attendance.controller.js";
import { AttendanceEditController } from "./attendance-edit.controller.js";

@Module({
  imports: [
    // Registers the Meeting model directly (rather than importing
    // MeetingsModule) so this module has no dependency on MeetingsModule —
    // MeetingsModule depends on this one for the resolver, and Mongoose
    // model registration is safe to duplicate across modules sharing one
    // connection.
    MongooseModule.forFeature([
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Meeting.name, schema: MeetingSchema },
    ]),
    AuthModule,
    GuildOwnershipModule,
  ],
  controllers: [AttendanceController, AttendanceEditController],
  providers: [AttendanceResolverService, AttendanceStatsService, AttendanceService],
  exports: [MongooseModule, AttendanceResolverService, AttendanceStatsService, AttendanceService],
})
export class AttendanceModule {}
