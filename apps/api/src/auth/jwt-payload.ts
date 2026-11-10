export interface JwtPayload {
  discordUserId: string;
  username: string;
  guildId: string;
  canManage?: boolean;
}
