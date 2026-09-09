import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';

import type { Env } from '../../config/index.js';

type SendMail = (message: Record<string, unknown>) => Promise<unknown>;

const sendMail = jest.fn<SendMail>();
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

const message = { html: '<p>hi</p>', subject: 'Hola', text: 'hi', to: 'ana@example.com' };

describe('EmailService', () => {
  beforeEach(() => {
    sendMail.mockReset();
    createTransport.mockClear();
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
      secure: true
    });
  });

  it('defaults to 587 with STARTTLS when no port is given', () => {
    new EmailService({ ...configured, SMTP_PORT: undefined } as unknown as Env);

    expect(createTransport.mock.calls[0]?.[0]).toMatchObject({ port: 587, secure: false });
  });

  it('sends from the product name and reports acceptance', async () => {
    sendMail.mockResolvedValue({});
    const service = new EmailService(configured);

    await expect(service.send(message)).resolves.toBe(true);
    expect(sendMail).toHaveBeenCalledWith({ from: '"NutrIA" <hola@nutria.example>', html: '<p>hi</p>', subject: 'Hola', text: 'hi', to: 'ana@example.com' });
  });

  it('reports a refusal as false and keeps the address out of the log', async () => {
    sendMail.mockRejectedValue(new Error('535 bad credentials'));
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const service = new EmailService(configured);

    await expect(service.send(message)).resolves.toBe(false);
    expect(String(error.mock.calls[0]?.[0])).toContain('535 bad credentials');
    expect(String(error.mock.calls[0]?.[0])).not.toContain('ana@example.com');
  });
});
