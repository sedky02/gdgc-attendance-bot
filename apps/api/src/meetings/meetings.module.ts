import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MeetingTypesModule } from "../meeting-types/meeting-types.module.js";
import { AttendanceModule } from "../attendance/attendance.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { GuildOwnershipModule } from "../common/guild-ownership.module.js";
import { Meeting, MeetingSchema } from "./schemas/meeting.schema.js";
import { MeetingLifecycleService } from "./meeting-lifecycle.service.js";
import { MeetingSweeperService } from "./meeting-sweeper.service.js";
import { MeetingsController } from "./meetings.controller.js";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Meeting.name, schema: MeetingSchema }]),
    MeetingTypesModule,
    AttendanceModule,
    AuthModule,
    GuildOwnershipModule,
  ],
  controllers: [MeetingsController],
  providers: [MeetingLifecycleService, MeetingSweeperService],
  exports: [MongooseModule, MeetingLifecycleService],
})
export class MeetingsModule {}
