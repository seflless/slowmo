import { describe, it, expect, vi } from 'vitest';

/**
 * Virtual time math is complex to test in isolation due to global function patching.
 * These tests verify basic observable behavior. Detailed timing accuracy is
 * thoroughly tested in E2E tests with a real browser environment.
 */

// Set up minimal mocks for the module to load
vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
vi.stubGlobal('cancelAnimationFrame', vi.fn());

Object.defineProperty(global, 'performance', {
  value: { now: vi.fn(() => 0) },
  writable: true,
  configurable: true,
});

Object.defineProperty(global, 'document', {
  value: {
    getAnimations: vi.fn(() => []),
    querySelectorAll: vi.fn(() => []),
  },
  writable: true,
});

describe('Virtual Time Concepts', () => {
  it('getSpeed reflects the current speed setting', async () => {
    const { slowmo } = await import('../../src/index.ts');

    slowmo(0.5);
    expect(slowmo.getSpeed()).toBe(0.5);

    slowmo(2);
    expect(slowmo.getSpeed()).toBe(2);

    slowmo(Infinity);
    expect(slowmo.getSpeed()).toBe(Infinity);
  });

  it('pause sets speed to 0', async () => {
    vi.resetModules();
    const { slowmo } = await import('../../src/index.ts');

    slowmo(0.5);
    slowmo.pause();
    expect(slowmo.getSpeed()).toBe(0);
  });

  it('reset returns speed to 1', async () => {
    vi.resetModules();
    const { slowmo } = await import('../../src/index.ts');

    slowmo(0.5);
    slowmo.reset();
    expect(slowmo.getSpeed()).toBe(1);
  });

  // Note: Detailed timing verification (e.g., "at 0.5x, 1s real = 0.5s virtual")
  // is done in E2E tests where we have a real browser and proper timing APIs.
  // Unit testing the patched performance.now() is complex due to module patching
  // that persists across test isolation boundaries.
});
