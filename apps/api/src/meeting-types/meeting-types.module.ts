import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MeetingType, MeetingTypeSchema } from "./schemas/meeting-type.schema.js";
import { MeetingTypesService } from "./meeting-types.service.js";
import { MeetingTypesController } from "./meeting-types.controller.js";

@Module({
  imports: [MongooseModule.forFeature([{ name: MeetingType.name, schema: MeetingTypeSchema }])],
  controllers: [MeetingTypesController],
  providers: [MeetingTypesService],
  exports: [MongooseModule, MeetingTypesService],
})
export class MeetingTypesModule {}
