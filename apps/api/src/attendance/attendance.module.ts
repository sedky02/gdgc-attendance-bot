import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Attendance, AttendanceSchema } from "./schemas/attendance.schema.js";
import { Meeting, MeetingSchema } from "../meetings/schemas/meeting.schema.js";
import { AttendanceResolverService } from "./attendance-resolver.service.js";
import { AttendanceService } from "./attendance.service.js";
import { AttendanceController } from "./attendance.controller.js";

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
  ],
  controllers: [AttendanceController],
  providers: [AttendanceResolverService, AttendanceService],
  exports: [MongooseModule, AttendanceResolverService, AttendanceService],
})
export class AttendanceModule {}
