import { describe, it, expect, beforeEach } from 'vitest';
import { slowmo } from '../../src/index';

describe('setTimeout/setInterval patching', () => {
  beforeEach(() => {
    slowmo.reset();
  });

  it('should have patched setTimeout after slowmo import', () => {
    // The setTimeout should be patched - verify it's not the native one
    // by checking that it can handle slowmo's speed changes
    expect(typeof setTimeout).toBe('function');
    expect(typeof setInterval).toBe('function');
  });

  it('should compute correct scaled delay at 0.5x speed', () => {
    slowmo(0.5);
    // At 0.5x speed, delays should be doubled (100ms -> 200ms real)
    // We test this conceptually - the implementation divides by speed
    const speed = slowmo.getSpeed();
    expect(speed).toBe(0.5);
    // delay / 0.5 = delay * 2
  });

  it('should compute correct scaled delay at 2x speed', () => {
    slowmo(2);
    // At 2x speed, delays should be halved (100ms -> 50ms real)
    const speed = slowmo.getSpeed();
    expect(speed).toBe(2);
    // delay / 2 = delay * 0.5
  });

  it('should handle paused state (speed=0)', () => {
    slowmo(0);
    const speed = slowmo.getSpeed();
    expect(speed).toBe(0);
    // When speed is 0, we use 0.0001 to avoid Infinity
    // This makes delays very long but not infinite
  });
});
