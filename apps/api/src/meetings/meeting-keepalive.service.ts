import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { Logger } from "nestjs-pino";
import { Meeting } from "./schemas/meeting.schema.js";

const LIVE_STATUSES = ["ACTIVE", "PAUSED"] as const;
const PING_TIMEOUT_MS = 10_000;

/**
 * Render's free tier suspends a web service after ~15 minutes without inbound
 * HTTP traffic. The bot's work (a Discord gateway WebSocket) generates none,
 * so while a meeting is live this service sends that traffic itself — to the
 * bot and to the API's own public URL (internal timers don't count; the
 * request has to go through Render's proxy).
 *
 * With no live meeting it does nothing, so the services are free to sleep.
 * It can't wake a sleeping service by itself: the API has to be awake for
 * the timer to run, which is why it pings itself too.
 */
@Injectable()
export class MeetingKeepAliveService {
  constructor(
    @InjectModel(Meeting.name) private readonly meetingModel: Model<Meeting>,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(Logger) private readonly logger: Logger,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async keepAlive(): Promise<void> {
    const targets = [this.config.get<string>("BOT_HEALTH_URL"), this.config.get<string>("API_PUBLIC_URL")].filter(
      (url): url is string => Boolean(url),
    );
    if (targets.length === 0) return;

    const live = await this.meetingModel.exists({ status: { $in: LIVE_STATUSES } });
    if (!live) return;

    await Promise.all(targets.map((url) => this.ping(url)));
  }

  private async ping(url: string): Promise<void> {
    try {
      await fetch(url, { signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
    } catch (error) {
      this.logger.warn({ url, err: error }, "Keep-alive ping failed");
    }
  }
}
