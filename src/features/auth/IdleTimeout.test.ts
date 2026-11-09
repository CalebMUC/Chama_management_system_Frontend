import { describe, expect, it } from 'vitest';
import { idleTimeoutMinutes } from './IdleTimeout';

describe('idle timeout setting', () => {
  it('is off when unset, zero or invalid', () => {
    expect(idleTimeoutMinutes('')).toBe(0);
    expect(idleTimeoutMinutes(undefined)).toBe(0);
    expect(idleTimeoutMinutes('0')).toBe(0);
    expect(idleTimeoutMinutes('-5')).toBe(0);
    expect(idleTimeoutMinutes('soon')).toBe(0);
  });

  it('reads whole and fractional minutes', () => {
    expect(idleTimeoutMinutes('15')).toBe(15);
    expect(idleTimeoutMinutes('0.5')).toBe(0.5);
  });
});
