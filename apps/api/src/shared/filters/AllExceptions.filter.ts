import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { isAPIError } from 'better-auth/api';

import {
  AccountNotActivatedError,
  CareLinkExistsError,
  ConflictError,
  DatabaseOperationError,
  EmailNotVerifiedError,
  InputParseError,
  MealInFutureError,
  NotFoundError,
  OnboardingIncompleteError,
  PictureRetryRefusedError,
  PlanPausedError,
  PracticeFullError,
  ProfileConsentRequiredError,
  QuotaExceededError,
  ReauthenticationRequiredError,
  SafetyViolationError,
  UnauthorizedError,
  UnderMinimumAgeError
} from 'core/entities/Error';

import { ErrorReporter } from '../observability/ErrorReporter.js';

import type { ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

type ErrorBody = {
  readonly code: string;
  readonly fieldErrors?: Record<string, readonly string[]>;
  /** The client's own open link, named when it is what stands in the way of accepting another (`0059`). */
  readonly link?: { readonly professionalName: string; readonly since: string; readonly status: 'active' | 'paused' };
  readonly message: string;
  /** A full practice's number, and the ways up from it (`0061`, PRD 004 criterion 17). */
  readonly practice?: { readonly includedClients: number; readonly waysUp: readonly ('end_link' | 'larger_plan')[] };
  /** ISO date an exhausted allowance renews, when it renews on a date. */
  readonly retryAt?: string;
  readonly statusCode: number;
};

/**
 * What Express's body parsers refuse a request with, by the `type` they give
 * the error (`http-errors`). Each is the client's mistake — too big, not a
 * format read here, cut off halfway — and answering it as a 500 would log,
 * report and invite a retry of a request that can never succeed. Nest turns a
 * malformed JSON body (`entity.parse.failed`, a `SyntaxError`) into a 400
 * itself; these are the ones it lets through. The parser's own message is not
 * sent: it names limits and lengths nobody needs.
 */
const PARSER_REFUSALS: Readonly<Record<string, { readonly message: string; readonly statusCode: number }>> = {
  'charset.unsupported': { message: 'El formato de la petición no se admite.', statusCode: HttpStatus.UNSUPPORTED_MEDIA_TYPE },
  'encoding.unsupported': { message: 'El formato de la petición no se admite.', statusCode: HttpStatus.UNSUPPORTED_MEDIA_TYPE },
  'entity.parse.failed': { message: 'La petición no se puede leer.', statusCode: HttpStatus.BAD_REQUEST },
  'entity.too.large': { message: 'La petición es demasiado grande.', statusCode: HttpStatus.PAYLOAD_TOO_LARGE },
  'parameters.too.many': { message: 'La petición es demasiado grande.', statusCode: HttpStatus.PAYLOAD_TOO_LARGE },
  'request.aborted': { message: 'La petición no se puede leer.', statusCode: HttpStatus.BAD_REQUEST },
  'request.size.invalid': { message: 'La petición no se puede leer.', statusCode: HttpStatus.BAD_REQUEST }
};

function parserRefusal(exception: unknown): ErrorBody | null {
  const type = exception instanceof Error ? (exception as { type?: unknown }).type : undefined;
  const refusal = typeof type === 'string' && Object.hasOwn(PARSER_REFUSALS, type) ? PARSER_REFUSALS[type] : undefined;

  return refusal ? { code: 'REQUEST_ERROR', ...refusal } : null;
}

/**
 * The Better Auth codes sent on as `AUTH_<CODE>`: each is about the caller's own
 * account, which the caller already holds a session for, so none of them says
 * anything about anybody else. Every other code becomes `AUTH_ERROR`. That
 * matters for the day a new server-side caller reaches `auth.api.signUpEmail`
 * or `changeEmail`: `USER_ALREADY_EXISTS` passed through would tell a stranger
 * that an address has an account. A new code is added here only after that
 * question is asked of it.
 */
const AUTH_CODES: ReadonlySet<string> = new Set(['CREDENTIAL_ACCOUNT_NOT_FOUND', 'INVALID_PASSWORD', 'SESSION_EXPIRED']);

/**
 * A refusal Better Auth threw from one of *our* calls to `auth.api.*` (its own
 * routes under `/auth` answer through its handler and never reach this filter).
 *
 * This is the safety net, not the contract. A caller that expects a refusal
 * catches it itself and throws a domain error, as `UsersService.remove` does
 * with `SESSION_EXPIRED`. Unrecognised, it used to be a 500. Now it keeps its
 * status, with a stable code (`AUTH_<CODE>` for the codes in `AUTH_CODES`,
 * `AUTH_ERROR` otherwise), and never its message: that is English, written for
 * developers, and may name what it checked. Two exceptions, each an existing
 * rule: a 401, 403 or 404 is a denial and gets the same bytes as `SessionGuard`'s
 * own; a 5xx, or a status that is not an HTTP error, stays the generic 500 that
 * is logged and reported.
 */
function authRefusal(exception: unknown): ErrorBody | null {
  // `isAPIError` also accepts anything whose `name` is 'APIError'. Only better-call
  // throws that name in the installed tree (checked 2026-10-01). If a dependency ever
  // does too, its 4xx would land here, and a 4xx is neither logged nor reported.
  if (!isAPIError(exception)) {
    return null;
  }

  const status = (exception as { statusCode?: unknown }).statusCode;

  if (typeof status !== 'number' || status < HttpStatus.BAD_REQUEST || status >= HttpStatus.INTERNAL_SERVER_ERROR) {
    return null;
  }

  if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN || status === HttpStatus.NOT_FOUND) {
    // Word for word what `SessionGuard`'s `NotFoundException` answers: a session
    // that vanishes mid-request looks exactly like a request with no cookie.
    return { code: 'NOT_FOUND', message: 'Not Found', statusCode: HttpStatus.NOT_FOUND };
  }

  const code = (exception as { body?: { code?: unknown } }).body?.code;

  return {
    code: typeof code === 'string' && AUTH_CODES.has(code) ? `AUTH_${code}` : 'AUTH_ERROR',
    message: 'No se ha podido completar la operación.',
    statusCode: status
  };
}

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

  /** Optional so a test can stand the filter up without the reporter. */
  constructor(private readonly reporter?: ErrorReporter) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const body = this.toBody(exception);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
      // The route, not the URL: a path carries ids, and an id is a person.
      const request = http.getRequest<Request>();
      // express annotates the matched route on the request; its own types leave
      // it loose, and the pattern — not the URL — is the whole point: a path
      // carries ids, and an id is a person.
      const route = (request as { route?: { path?: string } }).route?.path ?? 'unmatched';

      this.reporter?.report(exception, `${request.method} ${route}`);
    }

    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof NotFoundError) {
      return { code: 'NOT_FOUND', message: exception.message, statusCode: HttpStatus.NOT_FOUND };
    }

    if (exception instanceof CareLinkExistsError) {
      // A state the client can act on: the link in the way is theirs, so it is
      // named — whose, where it stands, since when — and the screen offers to end it.
      return {
        code: 'CARE_LINK_EXISTS',
        link: { professionalName: exception.link.professionalName, since: exception.link.since, status: exception.link.status },
        message: 'Ya tienes un dietista vinculado.',
        statusCode: HttpStatus.CONFLICT
      };
    }

    if (exception instanceof PracticeFullError) {
      // A state the professional can act on: the number is theirs, and the two ways up are named so the
      // screen offers both — a larger plan through Stripe's portal, or ending a link.
      return {
        code: 'PRACTICE_FULL',
        message: 'Tu consulta ya tiene todos los pacientes que incluye tu plan.',
        practice: { includedClients: exception.includedClients, waysUp: ['larger_plan', 'end_link'] },
        statusCode: HttpStatus.CONFLICT
      };
    }

    if (exception instanceof PictureRetryRefusedError) {
      // What the owner asked of a dish's picture — a retry, the acceptance of a rejected one, the removal of an
      // accepted one — refused, and the code names why: `PICTURE_FLAG_OFF`, `PICTURE_UNAVAILABLE`,
      // `PICTURE_CAP_REACHED`, `PICTURE_DRAWING`, `PICTURE_NOT_RETRYABLE`, `PICTURE_NO_CANDIDATE`,
      // `PICTURE_ALLERGENS_MISMATCH`, `PICTURE_NOT_ACCEPTABLE`, `PICTURE_NOT_REMOVABLE`. One message for all,
      // and nothing of the picture in it: the console says which from the code.
      return {
        code: `PICTURE_${exception.reason.toUpperCase()}`,
        message: 'No se puede hacer eso con la imagen ahora.',
        statusCode: HttpStatus.CONFLICT
      };
    }

    if (exception instanceof ConflictError) {
      return { code: 'CONFLICT', message: exception.message, statusCode: HttpStatus.CONFLICT };
    }

    if (exception instanceof InputParseError) {
      return { code: 'INVALID_INPUT', fieldErrors: exception.fieldErrors, message: exception.message, statusCode: HttpStatus.UNPROCESSABLE_ENTITY };
    }

    if (exception instanceof AccountNotActivatedError) {
      // 409 like an unfinished profile: the account's state conflicts with the
      // request, and the person is meant to understand it and where to go.
      return { code: 'ACCOUNT_NOT_ACTIVATED', message: 'Tu cuenta todavía no está activada.', statusCode: HttpStatus.CONFLICT };
    }

    if (exception instanceof EmailNotVerifiedError) {
      // Same shape as an unopened account, different fix: this one is undone by
      // the person, from their own inbox.
      return { code: 'EMAIL_NOT_VERIFIED', message: 'Confirma tu correo para continuar.', statusCode: HttpStatus.CONFLICT };
    }

    if (exception instanceof ReauthenticationRequiredError) {
      // A state the person fixes themselves: sign out, sign in, and the same
      // request goes through. The only act that asks for it is deleting the account.
      return {
        code: 'REAUTHENTICATION_REQUIRED',
        message: 'Por seguridad, vuelve a iniciar sesión para borrar tu cuenta.',
        statusCode: HttpStatus.CONFLICT
      };
    }

    if (exception instanceof MealInFutureError) {
      return { code: 'MEAL_IN_FUTURE', message: 'Todavía no puedes marcar esta comida.', statusCode: HttpStatus.CONFLICT };
    }

    if (exception instanceof PlanPausedError) {
      return { code: 'PLAN_PAUSED', message: 'Tu plan está en pausa mientras estás de vacaciones.', statusCode: HttpStatus.CONFLICT };
    }

    if (exception instanceof OnboardingIncompleteError) {
      // 409, not 404: the account state conflicts with the request, and unlike
      // an authorisation denial this one is meant to be understood. The client
      // switches on `code` and sends the person back to their resume step.
      return { code: 'ONBOARDING_INCOMPLETE', message: 'Termina tu perfil antes de continuar.', statusCode: HttpStatus.CONFLICT };
    }

    if (exception instanceof ProfileConsentRequiredError) {
      // 409 like an unfinished profile: the caller owns the account, and the
      // answer is where to consent (RGPD art. 9.2.a), not a denial.
      return { code: 'PROFILE_CONSENT_REQUIRED', message: 'Necesitamos tu consentimiento para usar estos datos.', statusCode: HttpStatus.CONFLICT };
    }

    if (exception instanceof UnderMinimumAgeError) {
      // 422: the request is well formed, the birth date is refused.
      return { code: 'UNDER_MINIMUM_AGE', message: 'NutrIA es para mayores de 18 años.', statusCode: HttpStatus.UNPROCESSABLE_ENTITY };
    }

    if (exception instanceof QuotaExceededError) {
      // 429, the status for "not now": the request was fine, the allowance is
      // spent. `kind` in the message lets the client say which, `retryAt` when.
      return {
        code: 'QUOTA_EXCEEDED',
        message: exception.kind,
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        ...(exception.nextAt ? { retryAt: exception.nextAt } : {})
      };
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

    return (
      authRefusal(exception) ??
      parserRefusal(exception) ?? {
        code: 'INTERNAL_ERROR',
        message: 'Algo ha ido mal. Inténtalo de nuevo.',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      }
    );
  }
}
