import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { Attendance as AttendanceDto, MeetingReport } from "@meeting-system/contracts";
import { Attendance } from "../attendance/schemas/attendance.schema.js";
import { Meeting } from "../meetings/schemas/meeting.schema.js";
import { toAttendanceDto } from "../attendance/attendance.mapper.js";
import { toMeetingDto } from "../meetings/meetings.mapper.js";
import { AttendanceStatsService } from "../attendance/attendance-stats.service.js";

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<Attendance>,
    @InjectModel(Meeting.name) private readonly meetingModel: Model<Meeting>,
    @Inject(AttendanceStatsService) private readonly attendanceStatsService: AttendanceStatsService,
  ) {}

  /**
   * Frozen stats are used as-is for a COMPLETED meeting; anything still live
   * gets stats computed on the fly, as of right now — matching README's
   * "computed on read while live, written once on completion."
   */
  async getReport(meetingId: string): Promise<MeetingReport> {
    const meetingDoc = await this.meetingModel.findById(meetingId);
    if (!meetingDoc) {
      throw new NotFoundException(`Meeting ${meetingId} not found`);
    }

    const attendanceDocs = await this.attendanceModel.find({ meeting: meetingId });
    const asOf = meetingDoc.endedAt ?? new Date();

    const attendance: AttendanceDto[] = attendanceDocs.map((doc) => {
      const dto = toAttendanceDto(doc);
      return {
        ...dto,
        stats: dto.stats ?? this.attendanceStatsService.computeAttendanceStats(doc.sessions, meetingDoc.startedAt, asOf),
      };
    });

    const meetingDto = toMeetingDto(meetingDoc);
    const meetingStats = meetingDto.stats ?? this.attendanceStatsService.computeMeetingStats(meetingDoc, attendanceDocs, asOf);

    const presentIds = new Set(attendanceDocs.map((doc) => doc.discordUserId));
    const absentees = meetingDoc.expectedMembers
      .filter((member) => !presentIds.has(member.discordUserId))
      .map((member) => ({
        discordUserId: member.discordUserId,
        usernameSnapshot: member.usernameSnapshot,
        roleIds: member.roleIds,
      }));

    return {
      meeting: { ...meetingDto, stats: meetingStats },
      attendance,
      absentees,
    };
  }
}
