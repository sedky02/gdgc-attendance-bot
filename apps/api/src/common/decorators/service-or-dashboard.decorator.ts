import { UseGuards, applyDecorators } from "@nestjs/common";
import { ServiceOrJwtGuard } from "../guards/service-or-jwt.guard.js";

export const ServiceOrDashboard = () => applyDecorators(UseGuards(ServiceOrJwtGuard));
