import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { ManualAttendanceDto, PresentMember, ResolvePresenceParams, Session, SessionSource } from "@meeting-system/contracts";
import { Attendance, type AttendanceDocument } from "./schemas/attendance.schema.js";
import { Meeting, type MeetingDocument } from "../meetings/schemas/meeting.schema.js";

interface MongoDuplicateKeyError {
  code: number;
}

const openSessionJoinedBy = (observedAt: Date) => ({ leftAt: null, joinedAt: { $lte: observedAt } });

function isDuplicateKeyError(error: unknown): error is MongoDuplicateKeyError {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000;
}

/**
 * The single writer for Attendance.sessions (CLAUDE.md rule #4). Every path
 * that touches a session — voice events, the periodic sync, pause/resume,
 * end/cancel — funnels through this service so the invariants (atomic opens,
 * FULL-scope-only closes, PAUSED meetings frozen, stale events discarded)
 * only have to be enforced in one place.
 */
@Injectable()
export class AttendanceResolverService {
  constructor(
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<Attendance>,
    @InjectModel(Meeting.name) private readonly meetingModel: Model<Meeting>,
  ) {}

  async resolvePresence(meetingId: string, params: ResolvePresenceParams): Promise<void> {
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting || meeting.status !== "ACTIVE") {
      return;
    }

    const { presentMembers, observedAt, scope, source } = params;

    for (const member of presentMembers) {
      await this.openSessionIfNone(meeting, member, observedAt, source);
    }

    if (scope === "FULL") {
      const presentIds = new Set(presentMembers.map((member) => member.discordUserId));
      await this.closeSessionsNotIn(meetingId, presentIds, observedAt);
    }

    if (presentMembers.length > 0) {
      await this.touchLastActivity(meetingId, observedAt);
    }
  }

  /**
   * Closes exactly one user's open session. Deliberately not derived from a
   * roster diff: a departure says nothing about anyone else, so it must not
   * be able to close a user whose join is being written at the same moment.
   */
  async resolveDeparture(meetingId: string, discordUserId: string, observedAt: Date): Promise<void> {
    const meeting = await this.meetingModel.findById(meetingId, "status");
    if (!meeting || meeting.status !== "ACTIVE") {
      return;
    }

    const result = await this.attendanceModel.updateOne(
      { meeting: meetingId, discordUserId, sessions: { $elemMatch: openSessionJoinedBy(observedAt) } },
      { $set: { "sessions.$[open].leftAt": observedAt } },
      { arrayFilters: [{ "open.leftAt": null }] },
    );

    if (result.modifiedCount > 0) {
      await this.touchLastActivity(meetingId, observedAt);
    }
  }

  /**
   * Used by pause/end/cancel: an authoritative, unconditional close of every
   * open session. Bypasses resolvePresence's "must be ACTIVE" guard on
   * purpose — the lifecycle transition itself is what's forcing this, not an
   * external event that should be ignored while paused.
   */
  async closeAllOpenSessions(meetingId: string, observedAt: Date): Promise<void> {
    // A session that opened after `observedAt` (a backdated sweeper end) closes
    // at its own joinedAt, so no duration can come out negative.
    await this.attendanceModel.updateMany({ meeting: meetingId, "sessions.leftAt": null }, [
      {
        $set: {
          sessions: {
            $map: {
              input: "$sessions",
              as: "session",
              in: {
                $cond: [
                  { $eq: ["$$session.leftAt", null] },
                  { $mergeObjects: ["$$session", { leftAt: { $max: ["$$session.joinedAt", observedAt] } }] },
                  "$$session",
                ],
              },
            },
          },
        },
      },
    ]);
  }

  /** A lead's correction replaces one attendee's session list wholesale, creating the record if the bot never saw them. */
  async applyManualCorrection(meeting: MeetingDocument, correction: ManualAttendanceDto): Promise<AttendanceDocument> {
    const expected = meeting.expectedMembers.some((member) => member.discordUserId === correction.discordUserId);

    return this.attendanceModel.findOneAndUpdate(
      { meeting: meeting._id, discordUserId: correction.discordUserId },
      {
        $set: {
          usernameSnapshot: correction.usernameSnapshot,
          displayNameSnapshot: correction.displayNameSnapshot,
          sessions: correction.sessions,
          manuallyEdited: true,
          editedBy: correction.editedBy,
        },
        $setOnInsert: { guildId: meeting.guildId, expected, stats: null },
      },
      { upsert: true, new: true },
    );
  }

  async replaceSessions(attendanceId: string, sessions: Session[], editedBy: string): Promise<AttendanceDocument | null> {
    return this.attendanceModel.findByIdAndUpdate(attendanceId, { sessions, manuallyEdited: true, editedBy }, { new: true });
  }

  /**
   * One atomic upsert. The filter only matches a document with no open
   * session and nothing recorded after `observedAt`; when the document exists
   * but fails that precondition, the upsert's insert attempt hits the unique
   * (meeting, discordUserId) index, and that duplicate-key error is the no-op.
   */
  private async openSessionIfNone(
    meeting: MeetingDocument,
    member: PresentMember,
    observedAt: Date,
    source: SessionSource,
  ): Promise<void> {
    const expected = meeting.expectedMembers.some((expectedMember) => expectedMember.discordUserId === member.discordUserId);

    try {
      await this.attendanceModel.updateOne(
        {
          meeting: meeting._id,
          discordUserId: member.discordUserId,
          sessions: {
            $not: {
              $elemMatch: { $or: [{ leftAt: null }, { leftAt: { $gt: observedAt } }, { joinedAt: { $gt: observedAt } }] },
            },
          },
        },
        {
          $push: { sessions: { joinedAt: observedAt, leftAt: null, source } },
          $setOnInsert: {
            guildId: meeting.guildId,
            usernameSnapshot: member.usernameSnapshot,
            displayNameSnapshot: member.displayNameSnapshot,
            expected,
            manuallyEdited: false,
            editedBy: null,
            stats: null,
          },
        },
        { upsert: true },
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
    }
  }

  private async closeSessionsNotIn(meetingId: string, presentIds: Set<string>, observedAt: Date): Promise<void> {
    await this.attendanceModel.updateMany(
      {
        meeting: meetingId,
        discordUserId: { $nin: [...presentIds] },
        sessions: { $elemMatch: openSessionJoinedBy(observedAt) },
      },
      { $set: { "sessions.$[open].leftAt": observedAt } },
      { arrayFilters: [{ "open.leftAt": null }] },
    );
  }

  // $max keeps a late-arriving older observation from moving the sweeper's clock backwards.
  private async touchLastActivity(meetingId: string, observedAt: Date): Promise<void> {
    await this.meetingModel.updateOne({ _id: meetingId }, { $max: { lastActivityAt: observedAt } });
  }
}
