import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

@Schema({ _id: false })
export class MeetingTypeRole {
  @Prop({ type: String, required: true })
  roleId: string;

  @Prop({ type: String, required: true })
  nameSnapshot: string;
}
export const MeetingTypeRoleSchema = SchemaFactory.createForClass(MeetingTypeRole);

@Schema({ timestamps: { createdAt: true, updatedAt: true } })
export class MeetingType {
  @Prop({ type: String, required: true })
  guildId: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: [MeetingTypeRoleSchema], default: [] })
  roles: MeetingTypeRole[];

  @Prop({ type: String, required: true })
  createdBy: string;

  @Prop({ type: Boolean, default: false })
  archived: boolean;

  // Populated by Mongoose via the `timestamps` schema option above, not by @Prop.
  declare createdAt: Date;
  declare updatedAt: Date;
}

export type MeetingTypeDocument = HydratedDocument<MeetingType>;
export const MeetingTypeSchema = SchemaFactory.createForClass(MeetingType);

// History/list queries: meeting types for a guild, filtered by archived state.
MeetingTypeSchema.index({ guildId: 1, archived: 1 });
