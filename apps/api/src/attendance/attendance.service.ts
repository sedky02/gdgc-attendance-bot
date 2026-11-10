import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { Attendance as AttendanceDto, ManualAttendanceDto, UpdateAttendanceDto } from "@meeting-system/contracts";
import { Attendance } from "./schemas/attendance.schema.js";
import { Meeting } from "../meetings/schemas/meeting.schema.js";
import { toAttendanceDto } from "./attendance.mapper.js";
import { AttendanceStatsService } from "./attendance-stats.service.js";
import { AttendanceResolverService } from "./attendance-resolver.service.js";

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<Attendance>,
    @InjectModel(Meeting.name) private readonly meetingModel: Model<Meeting>,
    @Inject(AttendanceStatsService) private readonly attendanceStatsService: AttendanceStatsService,
    @Inject(AttendanceResolverService) private readonly attendanceResolver: AttendanceResolverService,
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

    const doc = await this.attendanceResolver.applyManualCorrection(meeting, dto);

    await this.refreezeIfCompleted(meeting);
    return toAttendanceDto(doc);
  }

  async updateSession(attendanceId: string, dto: UpdateAttendanceDto): Promise<AttendanceDto> {
    const doc = await this.attendanceResolver.replaceSessions(attendanceId, dto.sessions, dto.editedBy);
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
