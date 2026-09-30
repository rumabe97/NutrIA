import { describe, expect, it } from 'vitest';

import { AUDIT_ACTIONS, auditQuerySchema } from './Audit';

describe('auditQuerySchema', () => {
  it('defaults to no filter and the console’s own page size', () => {
    expect(auditQuerySchema.parse({})).toEqual({ offset: 0, size: 25 });
  });

  it('accepts every closed action and refuses anything else', () => {
    for (const action of AUDIT_ACTIONS) {
      expect(auditQuerySchema.parse({ action }).action).toBe(action);
    }

    expect(() => auditQuerySchema.parse({ action: 'account.deleted' })).toThrow();
  });

  it('names the owner’s picture retry', () => {
    expect(AUDIT_ACTIONS).toContain('picture.retried');
  });

  /* 0072: discarding, accepting and removing a picture by hand are admin mutations, each with its own name. */
  it('names the owner’s discard and acceptance of a candidate, and the removal of a published one', () => {
    expect(AUDIT_ACTIONS).toContain('picture.discarded');
    expect(AUDIT_ACTIONS).toContain('picture.accepted');
    expect(AUDIT_ACTIONS).toContain('picture.removed');
  });

  it('coerces and bounds offset and size', () => {
    expect(auditQuerySchema.parse({ offset: '50', size: '100' })).toEqual({ offset: 50, size: 100 });
    expect(() => auditQuerySchema.parse({ size: '0' })).toThrow();
    expect(() => auditQuerySchema.parse({ size: '101' })).toThrow();
  });
});
