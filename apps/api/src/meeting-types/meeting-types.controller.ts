import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { CreateMeetingTypeDto, ListMeetingTypesQueryDto, UpdateMeetingTypeDto } from "@meeting-system/contracts";
import { ServiceOrDashboard } from "../common/decorators/service-or-dashboard.decorator.js";
import { ResourceType } from "../common/decorators/resource-type.decorator.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { MeetingTypesService } from "./meeting-types.service.js";

@Controller("meeting-types")
@ServiceOrDashboard()
@ResourceType("meetingType")
export class MeetingTypesController {
  constructor(@Inject(MeetingTypesService) private readonly meetingTypesService: MeetingTypesService) {}

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
