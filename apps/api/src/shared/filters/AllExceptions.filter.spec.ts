import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';

import { AccountNotActivatedError, ConflictError, DatabaseOperationError, InputParseError, NotFoundError, QuotaExceededError, SafetyViolationError, UnauthorizedError } from 'core/entities/Error';

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

  it('maps an unactivated account to 409 with the code the screen routes on', () => {
    expect(capture(new AccountNotActivatedError()).body).toMatchObject({ code: 'ACCOUNT_NOT_ACTIVATED', statusCode: HttpStatus.CONFLICT });
  });

  it('maps a spent allowance to 429, naming which one and when it renews', () => {
    expect(capture(new QuotaExceededError('plan_redo', '2026-09-21')).body).toMatchObject({ code: 'QUOTA_EXCEEDED', message: 'plan_redo', retryAt: '2026-09-21', statusCode: HttpStatus.TOO_MANY_REQUESTS });
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

  it('passes through a Nest HttpException status', () => {
    expect(capture(new BadRequestException('bad')).body.statusCode).toBe(HttpStatus.BAD_REQUEST);
  });

  it('labels a Nest 404 with the same code as a domain 404', () => {
    expect(capture(new NotFoundException()).body.code).toBe('NOT_FOUND');
  });
});
