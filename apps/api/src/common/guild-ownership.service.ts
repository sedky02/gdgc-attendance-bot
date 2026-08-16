import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { Meeting } from "../meetings/schemas/meeting.schema.js";
import { Attendance } from "../attendance/schemas/attendance.schema.js";
import { MeetingType } from "../meeting-types/schemas/meeting-type.schema.js";
import type { ResourceTypeValue } from "./decorators/resource-type.decorator.js";

/**
 * Resolves which guild owns a given resource id — the piece ServiceOrJwtGuard
 * needs to enforce guild scoping on routes that carry no guildId directly
 * (`/meetings/:id/...`, `/attendance/:id`, `/meeting-types/:id`). Centralized
 * here (rather than in the guard itself) so every module using the guard
 * only needs to import this one module, instead of registering all three
 * underlying schemas themselves.
 */
@Injectable()
export class GuildOwnershipService {
  constructor(
    @InjectModel(Meeting.name) private readonly meetingModel: Model<Meeting>,
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<Attendance>,
    @InjectModel(MeetingType.name) private readonly meetingTypeModel: Model<MeetingType>,
  ) {}

  async resolveOwnerGuildId(resourceType: ResourceTypeValue, id: string): Promise<string | undefined> {
    if (resourceType === "attendance") {
      const attendance = await this.attendanceModel.findById(id, "meeting").catch(() => null);
      if (!attendance) {
        return undefined;
      }
      const meeting = await this.meetingModel.findById(attendance.meeting, "guildId").catch(() => null);
      return meeting?.guildId;
    }

    if (resourceType === "meetingType") {
      const meetingType = await this.meetingTypeModel.findById(id, "guildId").catch(() => null);
      return meetingType?.guildId;
    }

    const meeting = await this.meetingModel.findById(id, "guildId").catch(() => null);
    return meeting?.guildId;
  }
}
