import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CreateMeetingTypeDto, ListMeetingTypesQueryDto, UpdateMeetingTypeDto } from "@meeting-system/contracts";
import { ServiceOnly } from "../common/decorators/service-only.decorator.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { MeetingTypesService } from "./meeting-types.service.js";

@Controller("meeting-types")
@ServiceOnly()
export class MeetingTypesController {
  constructor(private readonly meetingTypesService: MeetingTypesService) {}

  @Get()
  list(@Query(new ZodValidationPipe(ListMeetingTypesQueryDto)) query: ListMeetingTypesQueryDto) {
    return this.meetingTypesService.list(query);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.meetingTypesService.get(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateMeetingTypeDto)) dto: CreateMeetingTypeDto) {
    return this.meetingTypesService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body(new ZodValidationPipe(UpdateMeetingTypeDto)) dto: UpdateMeetingTypeDto) {
    return this.meetingTypesService.update(id, dto);
  }

  @Delete(":id")
  archive(@Param("id") id: string) {
    return this.meetingTypesService.archive(id);
  }
}
