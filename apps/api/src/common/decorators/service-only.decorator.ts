import { UseGuards, applyDecorators } from "@nestjs/common";
import { ServiceTokenGuard } from "../guards/service-token.guard.js";

export const ServiceOnly = () => applyDecorators(UseGuards(ServiceTokenGuard));
