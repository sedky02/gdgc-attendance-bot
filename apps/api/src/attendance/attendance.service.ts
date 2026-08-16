import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { Attendance as AttendanceDto, ManualAttendanceDto, UpdateAttendanceDto } from "@meeting-system/contracts";
import { Attendance } from "./schemas/attendance.schema.js";
import { Meeting } from "../meetings/schemas/meeting.schema.js";
import { toAttendanceDto } from "./attendance.mapper.js";
import { AttendanceStatsService } from "./attendance-stats.service.js";

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<Attendance>,
    @InjectModel(Meeting.name) private readonly meetingModel: Model<Meeting>,
    @Inject(AttendanceStatsService) private readonly attendanceStatsService: AttendanceStatsService,
  ) {}

  async listForMeeting(meetingId: string): Promise<AttendanceDto[]> {
    const docs = await this.attendanceModel.find({ meeting: meetingId });
    return docs.map(toAttendanceDto);
  }

  /** Adds or corrects one attendee's record — the escape hatch for a bot outage. */
  async manualCorrection(meetingId: string, dto: ManualAttendanceDto): Promise<AttendanceDto> {
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException(`Meeting ${meetingId} not found`);
    }

    const expected = meeting.expectedMembers.some((member) => member.discordUserId === dto.discordUserId);

    const doc = await this.attendanceModel.findOneAndUpdate(
      { meeting: meetingId, discordUserId: dto.discordUserId },
      {
        $set: {
          usernameSnapshot: dto.usernameSnapshot,
          displayNameSnapshot: dto.displayNameSnapshot,
          sessions: dto.sessions,
          manuallyEdited: true,
          editedBy: dto.editedBy,
        },
        $setOnInsert: { meeting: meetingId, discordUserId: dto.discordUserId, expected, stats: null },
      },
      { upsert: true, new: true },
    );

    await this.refreezeIfCompleted(meeting);
    return toAttendanceDto(doc);
  }

  async updateSession(attendanceId: string, dto: UpdateAttendanceDto): Promise<AttendanceDto> {
    const doc = await this.attendanceModel.findByIdAndUpdate(
      attendanceId,
      { sessions: dto.sessions, manuallyEdited: true, editedBy: dto.editedBy },
      { new: true },
    );
    if (!doc) {
      throw new NotFoundException(`Attendance ${attendanceId} not found`);
    }

    const meeting = await this.meetingModel.findById(doc.meeting);
    if (meeting) {
      await this.refreezeIfCompleted(meeting);
    }

    return toAttendanceDto(doc);
  }

  /**
   * A manual edit on an already-completed meeting must re-freeze stats —
   * otherwise the frozen numbers silently drift out of sync with the
   * sessions they're supposed to summarize.
   */
  private async refreezeIfCompleted(meeting: { _id: unknown; status: string; endedAt: Date | null }): Promise<void> {
    if (meeting.status !== "COMPLETED" || !meeting.endedAt) {
      return;
    }
    await this.attendanceStatsService.freezeStats(String(meeting._id), meeting.endedAt);
  }
}
