import { describe, expect, it } from '@jest/globals';

import { providerErrorType } from './providerErrorType.js';

describe('providerErrorType', () => {
  it('reads Anthropic’s error type from a response body, and nothing of its message', () => {
    const body = JSON.stringify({ error: { message: 'Overloaded: your question about eggs', type: 'overloaded_error' }, type: 'error' });

    expect(providerErrorType(new Error('x'), body)).toBe('overloaded_error');
  });

  it('reads a stream’s error event, given as the chunk or as the cause of an Error', () => {
    const event = { error: { type: 'api_error' }, type: 'error' };

    expect(providerErrorType(event)).toBe('api_error');
    expect(providerErrorType(new Error('stream failed', { cause: event }))).toBe('api_error');
  });

  it('keeps nothing that is not a short code', () => {
    expect(providerErrorType(new Error('x'), JSON.stringify({ error: { type: 'Your key sk-ant-123 is bad' } }))).toBeNull();
    expect(providerErrorType(new Error('x'), '<html>Bad gateway</html>')).toBeNull();
    expect(providerErrorType(new Error('plain'))).toBeNull();
    expect(providerErrorType(null)).toBeNull();
  });
});
