import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";
import type { Logger } from "nestjs-pino";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttpException
      ? exception.getResponse()
      : { message: "Internal server error" };

    if (!isHttpException) {
      this.logger.error(exception, `Unhandled exception on ${request.method} ${request.url}`, AllExceptionsFilter.name);
    }

    response.status(status).json(
      typeof body === "string"
        ? { statusCode: status, message: body }
        : { statusCode: status, ...body },
    );
  }
}
