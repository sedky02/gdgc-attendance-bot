import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { MeetingStatus } from "@meeting-system/contracts";
import { Schema as MongooseSchema, Types, type HydratedDocument } from "mongoose";

@Schema({ _id: false })
export class MeetingPause {
  @Prop({ type: Date, required: true })
  pausedAt: Date;

  @Prop({ type: Date, default: null })
  resumedAt: Date | null;
}
export const MeetingPauseSchema = SchemaFactory.createForClass(MeetingPause);

@Schema({ _id: false })
export class ExpectedMember {
  @Prop({ type: String, required: true })
  discordUserId: string;

  @Prop({ type: String, required: true })
  usernameSnapshot: string;

  @Prop({ type: [String], default: [] })
  roleIds: string[];
}
export const ExpectedMemberSchema = SchemaFactory.createForClass(ExpectedMember);

@Schema({ _id: false })
export class MeetingStats {
  @Prop({ type: Number, required: true })
  presentCount: number;

  @Prop({ type: Number, required: true })
  expectedCount: number;

  @Prop({ type: Number, required: true })
  unexpectedCount: number;

  @Prop({ type: Number, required: true })
  durationMs: number;
}
export const MeetingStatsSchema = SchemaFactory.createForClass(MeetingStats);

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Meeting {
  @Prop({ type: String, required: true })
  guildId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "MeetingType", required: true })
  meetingType: Types.ObjectId;

  @Prop({ type: [String], required: true })
  voiceChannelIds: string[];

  @Prop({ type: String, enum: MeetingStatus.options, required: true })
  status: (typeof MeetingStatus.options)[number];

  @Prop({ type: String, required: true })
  startedBy: string;

  @Prop({ type: Date, required: true })
  startedAt: Date;

  @Prop({ type: String, default: null })
  endedBy: string | null;

  @Prop({ type: Date, default: null })
  endedAt: Date | null;

  @Prop({ type: String, default: null })
  cancelReason: string | null;

  @Prop({ type: [MeetingPauseSchema], default: [] })
  pauses: MeetingPause[];

  @Prop({ type: [ExpectedMemberSchema], default: [] })
  expectedMembers: ExpectedMember[];

  @Prop({ type: String, default: null })
  summary: string | null;

  @Prop({ type: String, default: null })
  summaryUpdatedBy: string | null;

  @Prop({ type: Date, default: null })
  summaryUpdatedAt: Date | null;

  @Prop({ type: MeetingStatsSchema, default: null })
  stats: MeetingStats | null;
}

export type MeetingDocument = HydratedDocument<Meeting>;
export const MeetingSchema = SchemaFactory.createForClass(Meeting);

// At most one live meeting per channel — the invariant the sweeper exists to protect.
MeetingSchema.index(
  { guildId: 1, voiceChannelIds: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["ACTIVE", "PAUSED"] } } },
);

// History and active-meeting list queries.
MeetingSchema.index({ guildId: 1, status: 1, startedAt: -1 });
