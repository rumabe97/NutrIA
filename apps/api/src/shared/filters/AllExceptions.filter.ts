import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';

import {
  ConflictError,
  DatabaseOperationError,
  InputParseError,
  NotFoundError,
  OnboardingIncompleteError,
  SafetyViolationError,
  UnauthorizedError
} from 'core/entities/Error';

import type { ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

type ErrorBody = {
  readonly code: string;
  readonly fieldErrors?: Record<string, readonly string[]>;
  readonly message: string;
  readonly statusCode: number;
};

/**
 * The single translation point from domain errors to HTTP.
 *
 * Two rules it exists to enforce:
 *
 *  1. **Nothing internal escapes.** Driver errors carry connection strings,
 *     Zod issues carry the shape of the database, and stack traces carry paths.
 *     An unrecognised error becomes a bare 500 with a generic message; the real
 *     one goes to the log.
 *
 *  2. **`code` is stable, `message` is not.** The frontend switches on `code` to
 *     pick the copy it shows, so messages can be reworded without breaking it.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof NotFoundError) {
      return { code: 'NOT_FOUND', message: exception.message, statusCode: HttpStatus.NOT_FOUND };
    }

    if (exception instanceof ConflictError) {
      return { code: 'CONFLICT', message: exception.message, statusCode: HttpStatus.CONFLICT };
    }

    if (exception instanceof InputParseError) {
      return { code: 'INVALID_INPUT', fieldErrors: exception.fieldErrors, message: exception.message, statusCode: HttpStatus.UNPROCESSABLE_ENTITY };
    }

    if (exception instanceof OnboardingIncompleteError) {
      // 409, not 404: the account state conflicts with the request, and unlike
      // an authorisation denial this one is meant to be understood. The client
      // switches on `code` and sends the person back to their resume step.
      return { code: 'ONBOARDING_INCOMPLETE', message: 'Termina tu perfil antes de continuar.', statusCode: HttpStatus.CONFLICT };
    }

    if (exception instanceof SafetyViolationError) {
      // 422, not 500: the request was well-formed, the *content* was refused.
      // Logged at error level regardless — unsafe content reaching this point
      // means an upstream check let it through.
      this.logger.error(`Safety violation blocked: ${exception.violations.map(v => v.ingredientName).join(', ')}`);

      return { code: 'UNSAFE_CONTENT', message: exception.message, statusCode: HttpStatus.UNPROCESSABLE_ENTITY };
    }

    // Both of these deliberately become 404. See the denial rule in AGENTS.md.
    if (exception instanceof UnauthorizedError) {
      return { code: 'NOT_FOUND', message: 'Not found', statusCode: HttpStatus.NOT_FOUND };
    }

    if (exception instanceof DatabaseOperationError) {
      this.logger.error(exception.message);

      return { code: 'INTERNAL_ERROR', message: 'Algo ha ido mal. Inténtalo de nuevo.', statusCode: HttpStatus.INTERNAL_SERVER_ERROR };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message = typeof payload === 'string' ? payload : ((payload as { message?: string | string[] }).message ?? exception.message);

      return {
        code: status === HttpStatus.NOT_FOUND ? 'NOT_FOUND' : 'REQUEST_ERROR',
        message: Array.isArray(message) ? message.join(', ') : message,
        statusCode: status
      };
    }

    return { code: 'INTERNAL_ERROR', message: 'Algo ha ido mal. Inténtalo de nuevo.', statusCode: HttpStatus.INTERNAL_SERVER_ERROR };
  }
}
