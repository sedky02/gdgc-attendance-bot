import { Logger } from "@nestjs/common";

// Service logs are asserted where they matter; everywhere else they are noise in test output.
Logger.overrideLogger(false);
