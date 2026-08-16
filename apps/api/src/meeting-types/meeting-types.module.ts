import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MeetingType, MeetingTypeSchema } from "./schemas/meeting-type.schema.js";

@Module({
  imports: [MongooseModule.forFeature([{ name: MeetingType.name, schema: MeetingTypeSchema }])],
  exports: [MongooseModule],
})
export class MeetingTypesModule {}
