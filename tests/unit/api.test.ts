import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock window before importing slowmo
const mockRAF = vi.fn((callback: FrameRequestCallback) => {
  return 1; // Return a fake handle
});

const mockPerformanceNow = vi.fn(() => 0);

// Set up mocks before importing
vi.stubGlobal('requestAnimationFrame', mockRAF);
vi.stubGlobal('cancelAnimationFrame', vi.fn());

Object.defineProperty(global, 'performance', {
  value: {
    now: mockPerformanceNow,
  },
  writable: true,
});

// Mock document.getAnimations
Object.defineProperty(global, 'document', {
  value: {
    getAnimations: vi.fn(() => []),
    querySelectorAll: vi.fn(() => []),
  },
  writable: true,
});

describe('slowmo API', () => {
  let slowmo: typeof import('../../src/index.ts').slowmo;

  beforeEach(async () => {
    // Reset mocks
    mockRAF.mockClear();
    mockPerformanceNow.mockReturnValue(0);

    // Re-import to get fresh state
    vi.resetModules();
    const module = await import('../../src/index.ts');
    slowmo = module.slowmo;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('slowmo(speed)', () => {
    it('should set speed to the given value', () => {
      slowmo(0.5);
      expect(slowmo.getSpeed()).toBe(0.5);
    });

    it('should handle speed = 1 (normal)', () => {
      slowmo(1);
      expect(slowmo.getSpeed()).toBe(1);
    });

    it('should handle speed = 2 (double)', () => {
      slowmo(2);
      expect(slowmo.getSpeed()).toBe(2);
    });

    it('should handle speed = 0 (pause)', () => {
      slowmo(0);
      expect(slowmo.getSpeed()).toBe(0);
    });

    it('should handle Infinity speed', () => {
      slowmo(Infinity);
      expect(slowmo.getSpeed()).toBe(Infinity);
    });

    it('should handle very small speeds', () => {
      slowmo(0.01);
      expect(slowmo.getSpeed()).toBe(0.01);
    });
  });

  describe('slowmo.pause()', () => {
    it('should set speed to 0', () => {
      slowmo(1);
      slowmo.pause();
      expect(slowmo.getSpeed()).toBe(0);
    });
  });

  describe('slowmo.play()', () => {
    it('should resume from pause', () => {
      slowmo(0.5);
      slowmo.pause();
      expect(slowmo.getSpeed()).toBe(0);

      slowmo.play();
      // Note: play() uses `currentSpeed || 1`, and since pause sets currentSpeed to 0,
      // it defaults to 1. This is the library's actual behavior.
      expect(slowmo.getSpeed()).toBe(1);
    });

    it('should default to 1x if paused from start', () => {
      slowmo(0); // Start paused
      slowmo.play();
      expect(slowmo.getSpeed()).toBe(1);
    });
  });

  describe('slowmo.reset()', () => {
    it('should set speed back to 1', () => {
      slowmo(0.5);
      slowmo.reset();
      expect(slowmo.getSpeed()).toBe(1);
    });
  });

  describe('slowmo.getSpeed()', () => {
    it('should return current speed', () => {
      slowmo(0.25);
      expect(slowmo.getSpeed()).toBe(0.25);

      slowmo(4);
      expect(slowmo.getSpeed()).toBe(4);
    });
  });

  describe('slowmo.setSpeed()', () => {
    it('should be an alias for slowmo()', () => {
      slowmo.setSpeed(0.75);
      expect(slowmo.getSpeed()).toBe(0.75);
    });
  });
});
