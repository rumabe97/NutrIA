import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { APIError } from 'better-auth/api';

import {
  AccountNotActivatedError,
  CareLinkExistsError,
  ConflictError,
  DatabaseOperationError,
  InputParseError,
  NotFoundError,
  PasswordChangeRequiredError,
  PictureRetryRefusedError,
  ProfileConsentRequiredError,
  QuotaExceededError,
  ReauthenticationRequiredError,
  SafetyViolationError,
  TwoFactorRemovalRefusedError,
  UnauthorizedError,
  UnderMinimumAgeError
} from 'core/entities/Error';

import { AllExceptionsFilter } from './AllExceptions.filter.js';

import type { ArgumentsHost } from '@nestjs/common';

function capture(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const request = { method: 'GET', route: { path: '/api/v1/thing' } };
  const host = { switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ status }) }) } as unknown as ArgumentsHost;

  const filter = new AllExceptionsFilter();

  // The filter logs the real error on purpose; silence it so a suite that
  // deliberately throws does not fill the output with expected stack traces.
  Object.assign(filter, { logger: { error: jest.fn() } });
  filter.catch(exception, host);

  return { body: json.mock.calls[0]?.[0] as { code: string; message: string; statusCode: number }, status };
}

describe('AllExceptionsFilter', () => {
  it('maps NotFoundError to 404', () => {
    expect(capture(new NotFoundError('Profile not found')).body).toMatchObject({ code: 'NOT_FOUND', statusCode: HttpStatus.NOT_FOUND });
  });

  it('maps ConflictError to 409', () => {
    expect(capture(new ConflictError()).body).toMatchObject({ code: 'CONFLICT', statusCode: HttpStatus.CONFLICT });
  });

  it('maps a link in the way to 409, naming it and nothing more', () => {
    const link = { professionalName: 'Ana Dietista', since: '2026-09-23T10:00:00.000Z', status: 'active' as const };
    const { body } = capture(new CareLinkExistsError(link));

    expect(body).toMatchObject({ code: 'CARE_LINK_EXISTS', link, statusCode: HttpStatus.CONFLICT });
    expect(Object.keys((body as unknown as { link: object }).link).sort()).toEqual(['professionalName', 'since', 'status']);
  });

  it('maps an unactivated account to 409 with the code the screen routes on', () => {
    expect(capture(new AccountNotActivatedError()).body).toMatchObject({ code: 'ACCOUNT_NOT_ACTIVATED', statusCode: HttpStatus.CONFLICT });
  });

  it('maps a missing profile consent to 409 with its own code, like an unfinished profile', () => {
    expect(capture(new ProfileConsentRequiredError()).body).toMatchObject({ code: 'PROFILE_CONSENT_REQUIRED', statusCode: HttpStatus.CONFLICT });
  });

  /* Project 009: the retry, the acceptance and the removal of a dish's picture share one refusal, told apart by its code. */
  it.each([
    ['flag_off', 'PICTURE_FLAG_OFF'],
    ['unavailable', 'PICTURE_UNAVAILABLE'],
    ['cap_reached', 'PICTURE_CAP_REACHED'],
    ['drawing', 'PICTURE_DRAWING'],
    ['not_retryable', 'PICTURE_NOT_RETRYABLE'],
    ['no_candidate', 'PICTURE_NO_CANDIDATE'],
    ['allergens_mismatch', 'PICTURE_ALLERGENS_MISMATCH'],
    ['not_acceptable', 'PICTURE_NOT_ACCEPTABLE'],
    ['not_removable', 'PICTURE_NOT_REMOVABLE']
  ] as const)('maps a refused picture request (%s) to 409 %s, with words that fit a retry, an acceptance and a removal alike', (reason, code) => {
    const { body } = capture(new PictureRetryRefusedError(reason));

    expect(body).toEqual({ code, message: 'No se puede hacer eso con la imagen ahora.', statusCode: HttpStatus.CONFLICT });
    expect(body.message).not.toMatch(/reintentar/i);
  });

  /* PLAN 011 phase 4: the owner's removal of a lost second factor, refused with the code the console switches on. */
  it.each([
    ['not_enabled', 'TWO_FACTOR_NOT_ENABLED'],
    ['pending', 'TWO_FACTOR_REMOVAL_PENDING']
  ] as const)('maps a refused two-factor removal (%s) to 409 %s', (reason, code) => {
    expect(capture(new TwoFactorRemovalRefusedError(reason)).body).toEqual({
      code,
      message: 'No se puede pedir eso para esta cuenta ahora.',
      statusCode: HttpStatus.CONFLICT
    });
  });

  it('maps a birth date under the minimum age to 422 with a stable code', () => {
    expect(capture(new UnderMinimumAgeError()).body).toMatchObject({ code: 'UNDER_MINIMUM_AGE', statusCode: HttpStatus.UNPROCESSABLE_ENTITY });
  });

  it('maps a spent allowance to 429, naming which one and when it renews', () => {
    expect(capture(new QuotaExceededError('plan_redo', '2026-09-21')).body).toMatchObject({
      code: 'QUOTA_EXCEEDED',
      message: 'plan_redo',
      retryAt: '2026-09-21',
      statusCode: HttpStatus.TOO_MANY_REQUESTS
    });
    expect(capture(new QuotaExceededError('meal_swap')).body).not.toHaveProperty('retryAt');
  });

  it('maps InputParseError to 422 and keeps the field errors', () => {
    const body = capture(new InputParseError('Datos no válidos', { heightCm: ['fuera de rango'] })).body as unknown as {
      fieldErrors: Record<string, string[]>;
      statusCode: number;
    };

    expect(body.statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(body.fieldErrors.heightCm).toEqual(['fuera de rango']);
  });

  it('maps a safety violation to 422 with a stable code', () => {
    expect(capture(new SafetyViolationError('blocked', [{ ingredientName: 'Pan', kind: 'allergy' }])).body).toMatchObject({
      code: 'UNSAFE_CONTENT',
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY
    });
  });

  it('turns an authorisation failure into 404, never 403', () => {
    expect(capture(new UnauthorizedError()).body).toMatchObject({ code: 'NOT_FOUND', statusCode: HttpStatus.NOT_FOUND });
  });

  it('never leaks a database error message to the client', () => {
    const body = capture(new DatabaseOperationError('connection to postgres://user:hunter2@db failed')).body;

    expect(body.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body.message).not.toContain('hunter2');
    expect(body.message).not.toContain('postgres');
  });

  it('never leaks an unrecognised error, stack included', () => {
    const body = capture(new Error('ENOENT: /srv/data/secret/path')).body;

    expect(body).toEqual({ code: 'INTERNAL_ERROR', message: 'Algo ha ido mal. Inténtalo de nuevo.', statusCode: 500 });
  });

  /* What `express.raw` / `express.json` throw: `http-errors` with a status and a `type`. */
  function parserError(message: string, status: number, type: string): Error {
    return Object.assign(new Error(message), { expose: true, status, statusCode: status, type });
  }

  it('answers a body the parsers refused with the client status, not a 500', () => {
    expect(capture(parserError('request entity too large', 413, 'entity.too.large')).body).toEqual({
      code: 'REQUEST_ERROR',
      message: 'La petición es demasiado grande.',
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE
    });
    expect(capture(parserError('unsupported content encoding "br"', 415, 'encoding.unsupported')).body.statusCode).toBe(
      HttpStatus.UNSUPPORTED_MEDIA_TYPE
    );
    expect(capture(parserError('request aborted', 400, 'request.aborted')).body.statusCode).toBe(HttpStatus.BAD_REQUEST);
  });

  it('does not log or report a refused body as a server failure', () => {
    const report = jest.fn();
    const filter = new AllExceptionsFilter({ report } as never);
    const json = jest.fn();
    const host = {
      switchToHttp: () => ({ getRequest: () => ({ method: 'POST' }), getResponse: () => ({ status: () => ({ json }) }) })
    } as unknown as ArgumentsHost;

    filter.catch(parserError('request entity too large', 413, 'entity.too.large'), host);
    expect(report).not.toHaveBeenCalled();
  });

  it('still hides an unknown error that merely carries a `type`', () => {
    expect(capture(Object.assign(new Error('boom'), { type: 'StripeConnectionError' })).body.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('passes through a Nest HttpException status', () => {
    expect(capture(new BadRequestException('bad')).body.statusCode).toBe(HttpStatus.BAD_REQUEST);
  });

  it('labels a Nest 404 with the same code as a domain 404', () => {
    expect(capture(new NotFoundException()).body.code).toBe('NOT_FOUND');
  });

  /*
   * Account deletion from a session older than a day (production, 2026-09-30):
   * Better Auth's `SESSION_EXPIRED`, turned into this by `UsersService.remove`,
   * was a 500. It is a state the person fixes by signing in again.
   */
  it('maps a session too old to delete the account to 409 REAUTHENTICATION_REQUIRED, with the words for it', () => {
    expect(capture(new ReauthenticationRequiredError()).body).toEqual({
      code: 'REAUTHENTICATION_REQUIRED',
      message: 'Por seguridad, vuelve a iniciar sesión para borrar tu cuenta.',
      statusCode: HttpStatus.CONFLICT
    });
  });

  /* PLAN 011 phase 2: a breached password is a state the person fixes by changing it. */
  it('maps a password that must be changed to 409 PASSWORD_CHANGE_REQUIRED', () => {
    expect(capture(new PasswordChangeRequiredError()).body).toEqual({
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'Cambia tu contraseña para continuar.',
      statusCode: HttpStatus.CONFLICT
    });
  });

  /* Any other refusal Better Auth throws from one of our own `auth.api.*` calls. */
  describe('a Better Auth refusal', () => {
    it('keeps its 4xx status and its code, prefixed, but never its message', () => {
      const { body } = capture(APIError.from('BAD_REQUEST', { code: 'INVALID_PASSWORD', message: 'Invalid password' }));

      expect(body).toEqual({ code: 'AUTH_INVALID_PASSWORD', message: 'No se ha podido completar la operación.', statusCode: HttpStatus.BAD_REQUEST });
    });

    it('is not logged or reported as a server failure', () => {
      const report = jest.fn();
      const filter = new AllExceptionsFilter({ report } as never);
      const error = jest.fn();
      const host = {
        switchToHttp: () => ({ getRequest: () => ({ method: 'DELETE' }), getResponse: () => ({ status: () => ({ json: jest.fn() }) }) })
      } as unknown as ArgumentsHost;

      Object.assign(filter, { logger: { error } });
      filter.catch(APIError.from('BAD_REQUEST', { code: 'SESSION_EXPIRED', message: 'Session expired.' }), host);
      expect(report).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });

    it.each([
      ['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 422],
      ['USER_NOT_FOUND', 400],
      ['postgres://user:hunter2@db', 400]
    ] as const)(
      'answers a code not on the list (%s) as AUTH_ERROR, never echoing it — no answer may say an address has an account',
      (code, statusCode) => {
        expect(capture(new APIError(statusCode, { code, message: 'x' })).body).toEqual({
          code: 'AUTH_ERROR',
          message: 'No se ha podido completar la operación.',
          statusCode
        });
      }
    );

    it.each(['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND'] as const)(
      'turns %s into the one denial there is, byte for byte what SessionGuard answers without a cookie',
      status => {
        const denial = capture(new APIError(status, { code: 'FAILED_TO_GET_SESSION', message: 'Unauthorized' })).body;
        const noCookie = capture(new NotFoundException()).body;

        expect(denial).toEqual({ code: 'NOT_FOUND', message: 'Not Found', statusCode: HttpStatus.NOT_FOUND });
        expect(JSON.stringify(denial)).toBe(JSON.stringify(noCookie));
      }
    );

    it('stays the generic 500 when Better Auth itself failed', () => {
      expect(capture(APIError.from('INTERNAL_SERVER_ERROR', { code: 'FAILED_TO_GET_SESSION', message: 'db down at 10.0.0.3' })).body).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'Algo ha ido mal. Inténtalo de nuevo.',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      });
    });

    it('does not mistake an ordinary error that carries a 4xx statusCode for one', () => {
      expect(capture(Object.assign(new Error('card declined'), { statusCode: 402 })).body.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
