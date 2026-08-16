import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Meeting, MeetingSchema } from "./schemas/meeting.schema.js";

@Module({
  imports: [MongooseModule.forFeature([{ name: Meeting.name, schema: MeetingSchema }])],
  exports: [MongooseModule],
})
export class MeetingsModule {}
