import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiConflictResponse, ApiNotFoundResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { CreateMeetingTypeDto, ListMeetingTypesQueryDto, UpdateMeetingTypeDto } from "@meeting-system/contracts";
import { ServiceOrDashboard } from "../common/decorators/service-or-dashboard.decorator.js";
import { ResourceType } from "../common/decorators/resource-type.decorator.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import {
  ApiContractBody,
  ApiContractQuery,
  ApiContractResponse,
  ApiContractValidationResponse,
} from "../openapi/api-contract.decorator.js";
import { MeetingTypesService } from "./meeting-types.service.js";

@ApiTags("meeting-types")
@ApiContractValidationResponse()
@Controller("meeting-types")
@ServiceOrDashboard()
@ResourceType("meetingType")
export class MeetingTypesController {
  constructor(@Inject(MeetingTypesService) private readonly meetingTypesService: MeetingTypesService) {}

  @Get()
  @ApiOperation({ summary: "List meeting types", description: "Newest first. Omit `archived` to get both archived and active." })
  @ApiContractQuery("ListMeetingTypesQueryDto")
  @ApiContractResponse(200, "MeetingType", { isArray: true })
  list(@Query(new ZodValidationPipe(ListMeetingTypesQueryDto)) query: ListMeetingTypesQueryDto) {
    return this.meetingTypesService.list(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one meeting type" })
  @ApiParam({ name: "id", description: "Meeting type id" })
  @ApiContractResponse(200, "MeetingType")
  @ApiNotFoundResponse({ description: "Meeting type not found" })
  get(@Param("id") id: string) {
    return this.meetingTypesService.get(id);
  }

  @Post()
  @ApiOperation({
    summary: "Create a meeting type",
    description: "Roles are stored by id; `nameSnapshot` is display-only and refreshed on every edit.",
  })
  @ApiContractBody("CreateMeetingTypeDto")
  @ApiContractResponse(201, "MeetingType")
  @ApiConflictResponse({ description: "Violates a uniqueness constraint" })
  create(@Body(new ZodValidationPipe(CreateMeetingTypeDto)) dto: CreateMeetingTypeDto) {
    return this.meetingTypesService.create(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edit a meeting type", description: "Affects future meetings only — meetings already started keep their snapshot." })
  @ApiParam({ name: "id", description: "Meeting type id" })
  @ApiContractBody("UpdateMeetingTypeDto")
  @ApiContractResponse(200, "MeetingType")
  @ApiNotFoundResponse({ description: "Meeting type not found" })
  update(@Param("id") id: string, @Body(new ZodValidationPipe(UpdateMeetingTypeDto)) dto: UpdateMeetingTypeDto) {
    return this.meetingTypesService.update(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Archive a meeting type", description: "Soft delete — sets `archived: true`. Nothing is removed." })
  @ApiParam({ name: "id", description: "Meeting type id" })
  @ApiContractResponse(200, "MeetingType")
  @ApiNotFoundResponse({ description: "Meeting type not found" })
  archive(@Param("id") id: string) {
    return this.meetingTypesService.archive(id);
  }
}
