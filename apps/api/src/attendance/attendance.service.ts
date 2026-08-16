import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { Attendance as AttendanceDto } from "@meeting-system/contracts";
import { Attendance } from "./schemas/attendance.schema.js";
import { toAttendanceDto } from "./attendance.mapper.js";

@Injectable()
export class AttendanceService {
  constructor(@InjectModel(Attendance.name) private readonly attendanceModel: Model<Attendance>) {}

  async listForMeeting(meetingId: string): Promise<AttendanceDto[]> {
    const docs = await this.attendanceModel.find({ meeting: meetingId });
    return docs.map(toAttendanceDto);
  }
}
