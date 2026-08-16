import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { CreateMeetingTypeDto, ListMeetingTypesQueryDto, MeetingType as MeetingTypeDto, UpdateMeetingTypeDto } from "@meeting-system/contracts";
import { translateMongoWriteError } from "../common/utils/mongo-error.util.js";
import { MeetingType, type MeetingTypeDocument } from "./schemas/meeting-type.schema.js";
import { toMeetingTypeDto } from "./meeting-types.mapper.js";

@Injectable()
export class MeetingTypesService {
  constructor(@InjectModel(MeetingType.name) private readonly meetingTypeModel: Model<MeetingType>) {}

  async list(query: ListMeetingTypesQueryDto): Promise<MeetingTypeDto[]> {
    const filter: Record<string, unknown> = { guildId: query.guildId };
    if (query.archived !== undefined) {
      filter.archived = query.archived;
    }
    const docs = await this.meetingTypeModel.find(filter).sort({ createdAt: -1 });
    return docs.map(toMeetingTypeDto);
  }

  async get(id: string): Promise<MeetingTypeDto> {
    const doc = await this.findOrThrow(id);
    return toMeetingTypeDto(doc);
  }

  async create(dto: CreateMeetingTypeDto): Promise<MeetingTypeDto> {
    try {
      const doc = await this.meetingTypeModel.create({
        guildId: dto.guildId,
        name: dto.name,
        roles: dto.roles,
        createdBy: dto.createdBy,
        archived: false,
      });
      return toMeetingTypeDto(doc);
    } catch (error) {
      translateMongoWriteError(error);
    }
  }

  async update(id: string, dto: UpdateMeetingTypeDto): Promise<MeetingTypeDto> {
    await this.findOrThrow(id);

    try {
      const doc = await this.meetingTypeModel.findByIdAndUpdate(
        id,
        {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.roles !== undefined && { roles: dto.roles }),
        },
        { new: true },
      );
      if (!doc) {
        throw new NotFoundException(`Meeting type ${id} not found`);
      }
      return toMeetingTypeDto(doc);
    } catch (error) {
      translateMongoWriteError(error);
    }
  }

  async archive(id: string): Promise<MeetingTypeDto> {
    await this.findOrThrow(id);
    const doc = await this.meetingTypeModel.findByIdAndUpdate(id, { archived: true }, { new: true });
    if (!doc) {
      throw new NotFoundException(`Meeting type ${id} not found`);
    }
    return toMeetingTypeDto(doc);
  }

  private async findOrThrow(id: string): Promise<MeetingTypeDocument> {
    const doc = await this.meetingTypeModel.findById(id);
    if (!doc) {
      throw new NotFoundException(`Meeting type ${id} not found`);
    }
    return doc;
  }
}
