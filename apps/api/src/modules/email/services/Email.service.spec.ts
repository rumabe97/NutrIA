import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';

import { AnalyticsController } from 'core/controllers/Analytics';

import type { Env } from '../../../config/index.js';

type SendMail = (message: Record<string, unknown>) => Promise<unknown>;

const sendMail = jest.fn<SendMail>();
const record = jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);
const createTransport = jest.fn<(options: Record<string, unknown>) => { sendMail: SendMail }>(() => ({ sendMail }));

jest.unstable_mockModule('nodemailer', () => ({ createTransport }));

const { EmailService } = await import('./Email.service.js');

const configured = {
  EMAIL_FROM: 'hola@nutria.example',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PASS: 'app-password',
  SMTP_PORT: 465,
  SMTP_USER: 'hola@nutria.example'
} as unknown as Env;

const message = { html: '<p>hi</p>', kind: 'verify-email' as const, subject: 'Hola de Ana Dietista', text: 'hi', to: 'ana@example.com' };

describe('EmailService', () => {
  beforeEach(() => {
    sendMail.mockReset();
    createTransport.mockClear();
    record.mockClear();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('is unconfigured without SMTP, and then sends nothing', async () => {
    const service = new EmailService({} as Env);

    expect(service.configured).toBe(false);
    await expect(service.send(message)).resolves.toBe(false);
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('refuses a half configuration rather than a transport with no sender', () => {
    const service = new EmailService({ ...configured, EMAIL_FROM: undefined } as unknown as Env);

    expect(service.configured).toBe(false);
  });

  it('builds one transport from the environment, implicit TLS on 465', () => {
    const service = new EmailService(configured);

    expect(service.configured).toBe(true);
    expect(createTransport).toHaveBeenCalledWith({
      auth: { pass: 'app-password', user: 'hola@nutria.example' },
      host: 'smtp.example.com',
      port: 465,
      requireTLS: false,
      secure: true
    });
  });

  it('defaults to 587 with STARTTLS when no port is given', () => {
    new EmailService({ ...configured, SMTP_PORT: undefined } as unknown as Env);

    expect(createTransport.mock.calls[0]?.[0]).toMatchObject({ port: 587, requireTLS: true, secure: false });
  });

  it('requires STARTTLS on every port that is not implicit TLS, rather than upgrading if offered', () => {
    new EmailService({ ...configured, SMTP_PORT: 2525 } as unknown as Env);

    expect(createTransport.mock.calls[0]?.[0]).toMatchObject({ port: 2525, requireTLS: true, secure: false });
  });

  it('sends from the product name and reports acceptance', async () => {
    sendMail.mockResolvedValue({});
    const service = new EmailService(configured);

    await expect(service.send(message)).resolves.toBe(true);
    expect(sendMail).toHaveBeenCalledWith({
      from: '"NutrIA" <hola@nutria.example>',
      html: '<p>hi</p>',
      subject: 'Hola de Ana Dietista',
      text: 'hi',
      to: 'ana@example.com'
    });
  });

  it('reports a refusal as false, logged as the message’s kind and the error’s code — never its subject or the server’s words', async () => {
    // What SMTP servers really answer: the rejected recipient, quoted in the message.
    sendMail.mockRejectedValue(
      Object.assign(new Error("Can't send mail - all recipients were rejected: 550 5.1.1 <ana@example.com>: Recipient address rejected"), {
        code: 'EENVELOPE',
        responseCode: 550
      })
    );
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const service = new EmailService(configured);

    await expect(service.send(message)).resolves.toBe(false);
    const line = String(error.mock.calls[0]?.[0]);

    expect(line).toBe('mail not sent (verify-email): EENVELOPE 550');
    expect(line).not.toContain('ana@example.com');
    expect(line).not.toContain('Ana Dietista');
  });

  /* 0071: what left and what did not, per template — never to whom. */
  it('records each mail handed to the provider as its template and whether it left, with no user', async () => {
    sendMail.mockResolvedValueOnce({});
    sendMail.mockRejectedValueOnce(Object.assign(new Error('Invalid login: ana@example.com'), { code: 'EAUTH' }));
    const service = new EmailService(configured);

    await service.send(message);
    await service.send({ ...message, kind: 'check-in-reminder' });

    expect(record.mock.calls).toEqual([
      ['mail_sent', null, { kind: 'verify-email', ok: true }],
      ['mail_sent', null, { kind: 'check-in-reminder', ok: false }]
    ]);
    expect(JSON.stringify(record.mock.calls)).not.toMatch(/ana@example\.com|Ana Dietista|Invalid login/);
  });

  it('records nothing while unconfigured: no mail was tried', async () => {
    await new EmailService({} as Env).send(message);

    expect(record).not.toHaveBeenCalled();
  });

  it('logs a failure with no code as unknown, and nothing of its message', async () => {
    sendMail.mockRejectedValue(new Error('connect ECONNREFUSED ana@example.com'));
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const service = new EmailService(configured);

    await expect(service.send({ ...message, kind: 'care-invitation' })).resolves.toBe(false);
    expect(String(error.mock.calls.at(-1)?.[0])).toBe('mail not sent (care-invitation): unknown');
  });
});
