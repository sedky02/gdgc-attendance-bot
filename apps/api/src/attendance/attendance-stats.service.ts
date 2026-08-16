import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AttendanceStats, MeetingStats } from "@meeting-system/contracts";
import { Attendance } from "./schemas/attendance.schema.js";
import type { Session } from "./schemas/attendance.schema.js";
import { Meeting, type MeetingDocument } from "../meetings/schemas/meeting.schema.js";

/**
 * Pure computation plus the one place that freezes stats at /end-meeting.
 * Live reads (report, attendance list) call the compute* methods directly
 * with `asOf: new Date()` — that's a display concern, not a mutation, so it
 * doesn't fall under the resolver's "no Date.now()" write-path discipline.
 */
@Injectable()
export class AttendanceStatsService {
  constructor(
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<Attendance>,
    @InjectModel(Meeting.name) private readonly meetingModel: Model<Meeting>,
  ) {}

  computeAttendanceStats(sessions: Session[], meetingStartedAt: Date, asOf: Date): AttendanceStats | null {
    if (sessions.length === 0) {
      return null;
    }

    const firstJoinedAt = sessions[0].joinedAt;
    const latenessMs = Math.max(0, firstJoinedAt.getTime() - meetingStartedAt.getTime());
    const totalDurationMs = sessions.reduce(
      (sum, session) => sum + ((session.leftAt ?? asOf).getTime() - session.joinedAt.getTime()),
      0,
    );

    return { firstJoinedAt, latenessMs, totalDurationMs, sessionCount: sessions.length };
  }

  computePausedDurationMs(pauses: { pausedAt: Date; resumedAt: Date | null }[], asOf: Date): number {
    return pauses.reduce((sum, pause) => sum + ((pause.resumedAt ?? asOf).getTime() - pause.pausedAt.getTime()), 0);
  }

  computeMeetingDurationMs(meeting: Pick<MeetingDocument, "startedAt" | "endedAt" | "pauses">, asOf: Date): number {
    const end = meeting.endedAt ?? asOf;
    const wallClockMs = end.getTime() - meeting.startedAt.getTime();
    const pausedMs = this.computePausedDurationMs(meeting.pauses, end);
    return Math.max(0, wallClockMs - pausedMs);
  }

  computeMeetingStats(
    meeting: Pick<MeetingDocument, "startedAt" | "endedAt" | "pauses" | "expectedMembers">,
    attendanceDocs: { expected: boolean }[],
    asOf: Date,
  ): MeetingStats {
    return {
      presentCount: attendanceDocs.length,
      expectedCount: meeting.expectedMembers.length,
      unexpectedCount: attendanceDocs.filter((doc) => !doc.expected).length,
      durationMs: this.computeMeetingDurationMs(meeting, asOf),
    };
  }

  /** Called once, from MeetingLifecycleService.end() — freezes stats forever. */
  async freezeStats(meetingId: string, endedAt: Date): Promise<void> {
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      return;
    }

    const attendanceDocs = await this.attendanceModel.find({ meeting: meetingId });

    for (const doc of attendanceDocs) {
      const stats = this.computeAttendanceStats(doc.sessions, meeting.startedAt, endedAt);
      await this.attendanceModel.updateOne({ _id: doc._id }, { stats });
    }

    const meetingStats = this.computeMeetingStats(meeting, attendanceDocs, endedAt);
    await this.meetingModel.updateOne({ _id: meetingId }, { stats: meetingStats });
  }
}
