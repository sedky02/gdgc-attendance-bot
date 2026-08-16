import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { LoggerModule } from "nestjs-pino";
import { ConfigModule } from "./config/config.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { HealthModule } from "./health/health.module.js";
import { InternalModule } from "./internal/internal.module.js";
import { MeetingTypesModule } from "./meeting-types/meeting-types.module.js";
import { MeetingsModule } from "./meetings/meetings.module.js";
import { AttendanceModule } from "./attendance/attendance.module.js";

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === "development"
            ? { target: "pino-pretty", options: { singleLine: true } }
            : undefined,
        autoLogging: true,
      },
    }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    InternalModule,
    MeetingTypesModule,
    MeetingsModule,
    AttendanceModule,
  ],
})
export class AppModule {}
