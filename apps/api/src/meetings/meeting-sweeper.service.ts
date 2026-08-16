import { Inject, Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { Logger } from "nestjs-pino";
import { Meeting } from "./schemas/meeting.schema.js";

const LIVE_STATUSES = ["ACTIVE", "PAUSED"] as const;
const HARD_CAP_MS = 12 * 60 * 60 * 1000;
const EMPTY_TIMEOUT_MS = 15 * 60 * 1000;

@Injectable()
export class MeetingSweeperService {
  constructor(
    @InjectModel(Meeting.name) private readonly meetingModel: Model<Meeting>,
    @Inject(Logger) private readonly logger: Logger,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweep(): Promise<void> {
    const now = new Date();
    await this.sweepHardCap(now);
    await this.sweepEmptyChannels(now);
  }

  private async sweepHardCap(now: Date): Promise<void> {
    const cutoff = new Date(now.getTime() - HARD_CAP_MS);
    const candidates = await this.meetingModel.find({
      status: { $in: LIVE_STATUSES },
      startedAt: { $lte: cutoff },
    });

    for (const meeting of candidates) {
      const endedAt = new Date(meeting.startedAt.getTime() + HARD_CAP_MS);
      const result = await this.meetingModel.updateOne(
        { _id: meeting._id, status: meeting.status },
        { status: "COMPLETED", endedBy: "SYSTEM", endedAt },
      );
      if (result.modifiedCount > 0) {
        this.logger.log(
          { meetingId: meeting._id.toString() },
          "Sweeper ended meeting: 12-hour hard cap reached",
        );
      }
    }
  }

  private async sweepEmptyChannels(now: Date): Promise<void> {
    const cutoff = new Date(now.getTime() - EMPTY_TIMEOUT_MS);
    const candidates = await this.meetingModel.find({
      status: "ACTIVE",
      lastActivityAt: { $lte: cutoff },
    });

    for (const meeting of candidates) {
      const result = await this.meetingModel.updateOne(
        { _id: meeting._id, status: "ACTIVE" },
        { status: "COMPLETED", endedBy: "SYSTEM", endedAt: meeting.lastActivityAt },
      );
      if (result.modifiedCount > 0) {
        this.logger.log(
          { meetingId: meeting._id.toString() },
          "Sweeper ended meeting: channel empty for 15+ minutes",
        );
      }
    }
  }
}
