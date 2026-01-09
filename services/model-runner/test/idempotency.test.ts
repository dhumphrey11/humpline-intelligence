import { describe, expect, it } from 'vitest';
import { resolveIdempotencyStatus } from '../src/idempotency.js';

describe('resolveIdempotencyStatus', () => {
  it('returns NOOP for SUCCESS', () => {
    expect(resolveIdempotencyStatus('SUCCESS')).toBe('NOOP');
  });

  it('returns CONFLICT for FAILED', () => {
    expect(resolveIdempotencyStatus('FAILED')).toBe('CONFLICT');
  });

  it('returns RUN for other statuses', () => {
    expect(resolveIdempotencyStatus('PENDING')).toBe('RUN');
  });
});
