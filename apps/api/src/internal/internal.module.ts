import { Module } from "@nestjs/common";
import { InternalController } from "./internal.controller.js";

@Module({
  controllers: [InternalController],
})
export class InternalModule {}
