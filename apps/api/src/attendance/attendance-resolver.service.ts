import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { PresentMember, ResolvePresenceParams, SessionSource } from "@meeting-system/contracts";
import { Attendance } from "./schemas/attendance.schema.js";
import { Meeting, type MeetingDocument } from "../meetings/schemas/meeting.schema.js";

interface MongoDuplicateKeyError {
  code: number;
}

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
      await this.meetingModel.updateOne({ _id: meetingId }, { lastActivityAt: observedAt });
    }
  }

  /**
   * A single user's departure only carries one ID — there's no roster to
   * diff against. We derive "everyone who should stay open" from our own
   * currently-open sessions (excluding the one who left) and delegate to
   * resolvePresence's FULL-scope closing, which then closes exactly that
   * one person without touching anyone else.
   */
  async resolveDeparture(meetingId: string, discordUserId: string, observedAt: Date, source: SessionSource): Promise<void> {
    const openDocs = await this.attendanceModel.find(
      { meeting: meetingId, "sessions.leftAt": null, discordUserId: { $ne: discordUserId } },
      "discordUserId usernameSnapshot displayNameSnapshot",
    );

    const presentMembers: PresentMember[] = openDocs.map((doc) => ({
      discordUserId: doc.discordUserId,
      usernameSnapshot: doc.usernameSnapshot,
      displayNameSnapshot: doc.displayNameSnapshot,
    }));

    await this.resolvePresence(meetingId, { presentMembers, observedAt, scope: "FULL", source });
  }

  /**
   * Used by pause/end/cancel: an authoritative, unconditional close of every
   * open session. Bypasses resolvePresence's "must be ACTIVE" guard on
   * purpose — the lifecycle transition itself is what's forcing this, not an
   * external event that should be ignored while paused.
   */
  async closeAllOpenSessions(meetingId: string, observedAt: Date): Promise<void> {
    await this.attendanceModel.updateMany(
      { meeting: meetingId, "sessions.leftAt": null },
      { $set: { "sessions.$[open].leftAt": observedAt } },
      { arrayFilters: [{ "open.leftAt": null }] },
    );
  }

  private async openSessionIfNone(
    meeting: MeetingDocument,
    member: PresentMember,
    observedAt: Date,
    source: SessionSource,
  ): Promise<void> {
    const expected = meeting.expectedMembers.some((expectedMember) => expectedMember.discordUserId === member.discordUserId);

    try {
      await this.attendanceModel.updateOne(
        { meeting: meeting._id, discordUserId: member.discordUserId },
        {
          $setOnInsert: {
            usernameSnapshot: member.usernameSnapshot,
            displayNameSnapshot: member.displayNameSnapshot,
            expected,
            sessions: [],
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
      // A concurrent open beat us to creating the document — fine, continue.
    }

    const doc = await this.attendanceModel.findOne({ meeting: meeting._id, discordUserId: member.discordUserId }, "sessions");
    if (!doc) {
      return;
    }

    if (doc.sessions.some((session) => session.leftAt === null)) {
      return;
    }

    const lastSession = doc.sessions[doc.sessions.length - 1];
    if (lastSession && lastSession.leftAt !== null && lastSession.leftAt > observedAt) {
      return;
    }

    await this.attendanceModel.updateOne(
      { _id: doc._id, sessions: { $not: { $elemMatch: { leftAt: null } } } },
      { $push: { sessions: { joinedAt: observedAt, leftAt: null, source } } },
    );
  }

  private async closeSessionsNotIn(meetingId: string, presentIds: Set<string>, observedAt: Date): Promise<void> {
    const openDocs = await this.attendanceModel.find({ meeting: meetingId, "sessions.leftAt": null }, "discordUserId sessions");

    for (const doc of openDocs) {
      if (presentIds.has(doc.discordUserId)) {
        continue;
      }

      const openSession = doc.sessions.find((session) => session.leftAt === null);
      if (!openSession || observedAt < openSession.joinedAt) {
        continue;
      }

      await this.attendanceModel.updateOne({ _id: doc._id, "sessions.leftAt": null }, { $set: { "sessions.$.leftAt": observedAt } });
    }
  }
}
