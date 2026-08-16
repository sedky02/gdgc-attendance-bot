import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Meeting, MeetingSchema } from "../meetings/schemas/meeting.schema.js";
import { Attendance, AttendanceSchema } from "../attendance/schemas/attendance.schema.js";
import { MeetingType, MeetingTypeSchema } from "../meeting-types/schemas/meeting-type.schema.js";
import { GuildOwnershipService } from "./guild-ownership.service.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Meeting.name, schema: MeetingSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: MeetingType.name, schema: MeetingTypeSchema },
    ]),
  ],
  providers: [GuildOwnershipService],
  exports: [GuildOwnershipService],
})
export class GuildOwnershipModule {}
