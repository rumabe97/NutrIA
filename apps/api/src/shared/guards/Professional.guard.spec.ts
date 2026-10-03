import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ProfessionalController } from 'core/controllers/Professional';
import { UserController } from 'core/controllers/User';

import { BeforePractice } from '../decorators/BeforePractice.decorator.js';
import { ProfessionalGuard } from './Professional.guard.js';

import type { ExecutionContext } from '@nestjs/common';

const PRACTISING = {
  agreementRequired: false,
  collegiateNumber: '28/12345',
  grantedAt: '2026-09-01T00:00:00.000Z',
  includedClients: 30,
  practiceOpen: true
};

/** A workspace page marked to open before the practice is paid for. */
@BeforePractice()
class WorkspacePage {}

function makeContext(user?: { id: string; twoFactorEnabled?: boolean }, page: new () => object = class {}): ExecutionContext {
  return {
    getClass: () => page,
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) })
  } as unknown as ExecutionContext;
}

/**
 * The door to the workspace (`0059`). Both halves — the switch and the grant —
 * are `ProfessionalController.hasAccess`'s to weigh; what is pinned here is
 * that the guard asks about the session's user and nobody else, and that every
 * refusal is the same 404.
 */
describe('ProfessionalGuard', () => {
  beforeEach(() => {
    jest.spyOn(ProfessionalController, 'find').mockResolvedValue(PRACTISING);
    jest.spyOn(UserController, 'needsSecondFactor').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lets a granted account through while the switch is on', async () => {
    jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);

    await expect(new ProfessionalGuard(new Reflector()).canActivate(makeContext({ id: 'usr-dietitian' }))).resolves.toBe(true);
  });

  it('denies an account without access, with 404 — a 403 would say the workspace is real', async () => {
    jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(false);

    await expect(new ProfessionalGuard(new Reflector()).canActivate(makeContext({ id: 'usr-plain' }))).rejects.toThrow(
      expect.objectContaining({ status: 404 }) as unknown as Error
    );
  });

  it('asks about the session user, never an id from the request', async () => {
    const hasAccess = jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);

    await new ProfessionalGuard(new Reflector()).canActivate(makeContext({ id: 'usr-alice' }));

    expect(hasAccess).toHaveBeenCalledWith('usr-alice');
  });

  it('denies a request carrying no user at all, and does not even ask', async () => {
    const hasAccess = jest.spyOn(ProfessionalController, 'hasAccess');

    await expect(new ProfessionalGuard(new Reflector()).canActivate(makeContext())).rejects.toThrow(NotFoundException);
    expect(hasAccess).not.toHaveBeenCalled();
  });

  /* `0061`: every client route needs a practice paid for; the workspace's own page does not. */
  it('denies a professional whose practice is not paid for, with the same 404', async () => {
    jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
    jest.spyOn(ProfessionalController, 'find').mockResolvedValue({ ...PRACTISING, practiceOpen: false });

    await expect(new ProfessionalGuard(new Reflector()).canActivate(makeContext({ id: 'usr-lapsed' }))).rejects.toThrow(NotFoundException);
  });

  it('lets that professional reach a page marked to open before the practice is paid for', async () => {
    jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
    jest.spyOn(ProfessionalController, 'find').mockResolvedValue({ ...PRACTISING, practiceOpen: false });

    await expect(new ProfessionalGuard(new Reflector()).canActivate(makeContext({ id: 'usr-lapsed' }, WorkspacePage))).resolves.toBe(true);
  });

  /* `docs/legal/textos/01`: no client route before the current agreement is accepted. */
  it('denies a professional who has not accepted the agreement, with the same 404, even with the practice paid for', async () => {
    jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
    jest.spyOn(ProfessionalController, 'find').mockResolvedValue({ ...PRACTISING, agreementRequired: true });

    await expect(new ProfessionalGuard(new Reflector()).canActivate(makeContext({ id: 'usr-new' }))).rejects.toThrow(NotFoundException);
  });

  it('lets that professional reach a page marked to open before the practice — where the agreement is shown and accepted', async () => {
    jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
    jest.spyOn(ProfessionalController, 'find').mockResolvedValue({ ...PRACTISING, agreementRequired: true, practiceOpen: false });

    await expect(new ProfessionalGuard(new Reflector()).canActivate(makeContext({ id: 'usr-new' }, WorkspacePage))).resolves.toBe(true);
  });

  /* PLAN 011 phase 6: a client route reads somebody's health data, so a password needs the authenticator app on. */
  it('denies a professional who still needs a second factor, with the same 404, even with everything else in order', async () => {
    jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
    jest.spyOn(UserController, 'needsSecondFactor').mockResolvedValue(true);

    await expect(new ProfessionalGuard(new Reflector()).canActivate(makeContext({ id: 'usr-no-totp' }))).rejects.toThrow(
      expect.objectContaining({ status: 404 }) as unknown as Error
    );
  });

  it('asks about the session’s own user and its flag, never an id from the request', async () => {
    jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
    const needs = jest.spyOn(UserController, 'needsSecondFactor').mockResolvedValue(false);

    await new ProfessionalGuard(new Reflector()).canActivate(makeContext({ id: 'usr-alice', twoFactorEnabled: true }));

    expect(needs).toHaveBeenCalledWith({ id: 'usr-alice', twoFactorEnabled: true });
  });

  it('lets that professional reach the workspace’s page — where they are told to turn it on', async () => {
    jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
    const needs = jest.spyOn(UserController, 'needsSecondFactor').mockResolvedValue(true);

    await expect(new ProfessionalGuard(new Reflector()).canActivate(makeContext({ id: 'usr-no-totp' }, WorkspacePage))).resolves.toBe(true);
    expect(needs).not.toHaveBeenCalled();
  });

  it('never asks about the second factor of an account that is not a professional', async () => {
    jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(false);
    const needs = jest.spyOn(UserController, 'needsSecondFactor');

    await expect(new ProfessionalGuard(new Reflector()).canActivate(makeContext({ id: 'usr-plain' }))).rejects.toThrow(NotFoundException);
    expect(needs).not.toHaveBeenCalled();
  });

  it('still asks for the grant on that page', async () => {
    jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(false);

    await expect(new ProfessionalGuard(new Reflector()).canActivate(makeContext({ id: 'usr-plain' }, WorkspacePage))).rejects.toThrow(
      NotFoundException
    );
  });
});
