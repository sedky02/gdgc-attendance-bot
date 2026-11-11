// Fixed identifiers for the Discord-free demo: the API seed script writes
// them, and the dashboard's demo sign-in scopes its token to them.
export const DEMO_GUILD = { id: "111111111111111111", name: "Demo Club" } as const;
export const DEMO_USER = { discordUserId: "444444444444444444", username: "demo-lead" } as const;
