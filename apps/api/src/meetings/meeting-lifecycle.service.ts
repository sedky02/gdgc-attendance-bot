import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type {
  CancelMeetingDto,
  EndMeetingDto,
  Meeting as MeetingDto,
  MeetingHeartbeatDto,
  PauseMeetingDto,
  ResumeMeetingDto,
  StartMeetingDto,
} from "@meeting-system/contracts";
import { translateMongoWriteError } from "../common/utils/mongo-error.util.js";
import { MeetingTypesService } from "../meeting-types/meeting-types.service.js";
import { Meeting } from "./schemas/meeting.schema.js";
import { toMeetingDto } from "./meetings.mapper.js";

const LIVE_STATUSES = ["ACTIVE", "PAUSED"] as const;

@Injectable()
export class MeetingLifecycleService {
  constructor(
    @InjectModel(Meeting.name) private readonly meetingModel: Model<Meeting>,
    @Inject(MeetingTypesService) private readonly meetingTypesService: MeetingTypesService,
  ) {}

  async start(dto: StartMeetingDto): Promise<MeetingDto> {
    const meetingType = await this.meetingTypesService.get(dto.meetingTypeId);
    if (meetingType.archived) {
      throw new ConflictException("This meeting type is archived and can't be used to start new meetings");
    }

    try {
      const doc = await this.meetingModel.create({
        guildId: dto.guildId,
        meetingType: dto.meetingTypeId,
        voiceChannelIds: dto.voiceChannelIds,
        status: "ACTIVE",
        startedBy: dto.startedBy,
        startedAt: dto.observedAt,
        endedBy: null,
        endedAt: null,
        cancelReason: null,
        pauses: [],
        expectedMembers: dto.expectedMembers,
        summary: null,
        summaryUpdatedBy: null,
        summaryUpdatedAt: null,
        stats: null,
        lastActivityAt: dto.observedAt,
      });
      return toMeetingDto(doc);
    } catch (error) {
      translateMongoWriteError(error);
    }
  }

  async pause(id: string, dto: PauseMeetingDto): Promise<MeetingDto> {
    const updated = await this.meetingModel.findOneAndUpdate(
      { _id: id, status: "ACTIVE" },
      {
        status: "PAUSED",
        $push: { pauses: { pausedAt: dto.observedAt, resumedAt: null } },
      },
      { new: true },
    );
    if (!updated) {
      return this.throwIllegalTransition(id, "pause", ["ACTIVE"]);
    }
    return toMeetingDto(updated);
  }

  async resume(id: string, dto: ResumeMeetingDto): Promise<MeetingDto> {
    const updated = await this.meetingModel.findOneAndUpdate(
      { _id: id, status: "PAUSED" },
      {
        status: "ACTIVE",
        lastActivityAt: dto.observedAt,
        $set: { "pauses.$[openPause].resumedAt": dto.observedAt },
      },
      { new: true, arrayFilters: [{ "openPause.resumedAt": null }] },
    );
    if (!updated) {
      return this.throwIllegalTransition(id, "resume", ["PAUSED"]);
    }
    return toMeetingDto(updated);
  }

  async end(id: string, dto: EndMeetingDto): Promise<MeetingDto> {
    const updated = await this.meetingModel.findOneAndUpdate(
      { _id: id, status: { $in: LIVE_STATUSES } },
      { status: "COMPLETED", endedBy: dto.endedBy, endedAt: dto.observedAt },
      { new: true },
    );
    if (!updated) {
      return this.throwIllegalTransition(id, "end", LIVE_STATUSES);
    }
    return toMeetingDto(updated);
  }

  async cancel(id: string, dto: CancelMeetingDto): Promise<MeetingDto> {
    const updated = await this.meetingModel.findOneAndUpdate(
      { _id: id, status: { $in: LIVE_STATUSES } },
      {
        status: "CANCELLED",
        endedBy: dto.cancelledBy,
        endedAt: dto.observedAt,
        cancelReason: dto.cancelReason,
      },
      { new: true },
    );
    if (!updated) {
      return this.throwIllegalTransition(id, "cancel", LIVE_STATUSES);
    }
    return toMeetingDto(updated);
  }

  /**
   * Interim occupancy signal (Phase 3 stopgap — see MeetingSweeperService).
   * Best-effort: an unmatched or now-completed meeting is silently ignored,
   * since this is background polling, not a user-facing action.
   */
  async heartbeat(id: string, dto: MeetingHeartbeatDto): Promise<void> {
    if (dto.isEmpty) {
      return;
    }
    await this.meetingModel.updateOne({ _id: id, status: { $in: LIVE_STATUSES } }, { lastActivityAt: dto.observedAt });
  }

  async getById(id: string): Promise<MeetingDto> {
    const doc = await this.meetingModel.findById(id);
    if (!doc) {
      throw new NotFoundException(`Meeting ${id} not found`);
    }
    return toMeetingDto(doc);
  }

  async listActive(guildId: string): Promise<MeetingDto[]> {
    const docs = await this.meetingModel.find({ guildId, status: { $in: LIVE_STATUSES } });
    return docs.map(toMeetingDto);
  }

  /**
   * The atomic update already failed the transition; this just distinguishes
   * "doesn't exist" from "wrong status" so the bot can show a readable error
   * instead of a generic one.
   */
  private async throwIllegalTransition(id: string, action: string, requiredStatuses: readonly string[]): Promise<never> {
    const existing = await this.meetingModel.findById(id);
    if (!existing) {
      throw new NotFoundException(`Meeting ${id} not found`);
    }
    throw new ConflictException(
      `Cannot ${action} a meeting that is ${existing.status} (must be ${requiredStatuses.join(" or ")})`,
    );
  }
}
