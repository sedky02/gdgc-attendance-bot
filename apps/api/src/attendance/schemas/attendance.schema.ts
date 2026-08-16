import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { SessionSource } from "@meeting-system/contracts";
import { Schema as MongooseSchema, Types, type HydratedDocument } from "mongoose";

@Schema({ _id: false })
export class Session {
  @Prop({ type: Date, required: true })
  joinedAt: Date;

  @Prop({ type: Date, default: null })
  leftAt: Date | null;

  @Prop({ type: String, enum: SessionSource.options, required: true })
  source: (typeof SessionSource.options)[number];
}
export const SessionSchema = SchemaFactory.createForClass(Session);

@Schema({ _id: false })
export class AttendanceStats {
  @Prop({ type: Date, required: true })
  firstJoinedAt: Date;

  @Prop({ type: Number, required: true })
  latenessMs: number;

  @Prop({ type: Number, required: true })
  totalDurationMs: number;

  @Prop({ type: Number, required: true })
  sessionCount: number;
}
export const AttendanceStatsSchema = SchemaFactory.createForClass(AttendanceStats);

@Schema()
export class Attendance {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Meeting", required: true })
  meeting: Types.ObjectId;

  @Prop({ type: String, required: true })
  discordUserId: string;

  @Prop({ type: String, required: true })
  usernameSnapshot: string;

  @Prop({ type: String, required: true })
  displayNameSnapshot: string;

  @Prop({ type: Boolean, required: true })
  expected: boolean;

  @Prop({ type: [SessionSchema], default: [] })
  sessions: Session[];

  @Prop({ type: Boolean, default: false })
  manuallyEdited: boolean;

  @Prop({ type: String, default: null })
  editedBy: string | null;

  @Prop({ type: AttendanceStatsSchema, default: null })
  stats: AttendanceStats | null;
}

export type AttendanceDocument = HydratedDocument<Attendance>;
export const AttendanceSchema = SchemaFactory.createForClass(Attendance);

// At most one attendance document per user per meeting.
AttendanceSchema.index({ meeting: 1, discordUserId: 1 }, { unique: true });
