import { Inject, Injectable } from "@nestjs/common";
import type { Meeting, VoiceEventDto } from "@meeting-system/contracts";
import { MeetingLifecycleService } from "../meetings/meeting-lifecycle.service.js";
import { AttendanceResolverService } from "../attendance/attendance-resolver.service.js";

@Injectable()
export class InternalService {
  constructor(
    @Inject(MeetingLifecycleService) private readonly meetingLifecycleService: MeetingLifecycleService,
    @Inject(AttendanceResolverService) private readonly attendanceResolver: AttendanceResolverService,
  ) {}

  /**
   * Translates a raw voice-state transition into resolver calls. A channel
   * move carries both `from` and `to` in one event — handled here as two
   * independent lookups so it's never split into separate leave/join calls
   * that could arrive out of order relative to each other.
   */
  async handleVoiceEvent(dto: VoiceEventDto): Promise<void> {
    if (dto.from) {
      const meetingId = await this.meetingLifecycleService.findActiveMeetingId(dto.guildId, dto.from);
      if (meetingId) {
        await this.attendanceResolver.resolveDeparture(meetingId, dto.discordUserId, dto.occurredAt, "EVENT");
      }
    }

    if (dto.to) {
      const meetingId = await this.meetingLifecycleService.findActiveMeetingId(dto.guildId, dto.to);
      if (meetingId) {
        await this.attendanceResolver.resolvePresence(meetingId, {
          presentMembers: [
            {
              discordUserId: dto.discordUserId,
              usernameSnapshot: dto.usernameSnapshot,
              displayNameSnapshot: dto.displayNameSnapshot,
            },
          ],
          observedAt: dto.occurredAt,
          scope: "PARTIAL",
          source: "EVENT",
        });
      }
    }
  }

  bootstrap(): Promise<Meeting[]> {
    return this.meetingLifecycleService.listAllLive();
  }
}
