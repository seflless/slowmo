import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests for animation and media element tracking.
 * These verify the WeakMap tracking logic works correctly.
 */

let mockTime = 0;
const mockRAF = vi.fn((callback: FrameRequestCallback) => {
  // Store the callback so we can invoke it manually
  return 1;
});
const mockPerformanceNow = vi.fn(() => mockTime);

vi.stubGlobal('requestAnimationFrame', mockRAF);
vi.stubGlobal('cancelAnimationFrame', vi.fn());

Object.defineProperty(global, 'performance', {
  value: { now: mockPerformanceNow },
  writable: true,
  configurable: true,
});

// Mock animations array that we can control
let mockAnimations: any[] = [];

// Mock media elements array
let mockMediaElements: any[] = [];

Object.defineProperty(global, 'document', {
  value: {
    getAnimations: vi.fn(() => mockAnimations),
    querySelectorAll: vi.fn((selector: string) => {
      if (selector === 'video, audio') {
        return mockMediaElements;
      }
      return [];
    }),
  },
  writable: true,
});

describe('Animation Tracking', () => {
  let slowmo: typeof import('../../src/index.ts').slowmo;

  beforeEach(async () => {
    mockTime = 0;
    mockAnimations = [];
    mockMediaElements = [];
    mockRAF.mockClear();
    vi.resetModules();

    const module = await import('../../src/index.ts');
    slowmo = module.slowmo;
  });

  describe('Web Animations API tracking', () => {
    it('should modify playbackRate of new animations', () => {
      const mockAnim = createMockAnimation(1);
      mockAnimations = [mockAnim];

      slowmo(0.5);

      // Trigger polling by calling setSpeed again (which calls updateWebAnimations)
      slowmo(0.5);

      expect(mockAnim.playbackRate).toBe(0.5);
    });

    it('should preserve developer playbackRate changes', () => {
      const mockAnim = createMockAnimation(2); // Developer set 2x
      mockAnimations = [mockAnim];

      slowmo(0.5);

      // Should be 2 (original) * 0.5 (slowmo) = 1
      expect(mockAnim.playbackRate).toBe(1);
    });

    it('should update when speed changes', () => {
      const mockAnim = createMockAnimation(1);
      mockAnimations = [mockAnim];

      slowmo(0.5);
      expect(mockAnim.playbackRate).toBe(0.5);

      slowmo(2);
      expect(mockAnim.playbackRate).toBe(2);

      slowmo(0.25);
      expect(mockAnim.playbackRate).toBe(0.25);
    });

    // Note: Exclusion logic (data-slowmo-exclude) is tested in E2E tests
    // because it requires `target instanceof Element` which is hard to mock.
    it.skip('should skip excluded elements (tested in E2E)', () => {
      // This test is skipped - exclusion requires real DOM elements
    });

    it('should pause animations when speed is 0', () => {
      const mockAnim = createMockAnimation(1);
      mockAnim.pause = vi.fn();
      mockAnim.play = vi.fn();
      mockAnimations = [mockAnim];

      slowmo(0.5);
      slowmo(0); // Pause

      expect(mockAnim.pause).toHaveBeenCalled();
    });

    it('should resume animations when unpausing', () => {
      const mockAnim = createMockAnimation(1);
      mockAnim.pause = vi.fn();
      mockAnim.play = vi.fn();
      mockAnim.playState = 'paused';
      mockAnimations = [mockAnim];

      slowmo(0); // Pause
      slowmo.play(); // Resume

      expect(mockAnim.play).toHaveBeenCalled();
    });

    it('should finish animations at Infinity speed', () => {
      const mockAnim = createMockAnimation(1);
      mockAnim.finish = vi.fn();
      mockAnimations = [mockAnim];

      slowmo(Infinity);

      expect(mockAnim.finish).toHaveBeenCalled();
    });

    it('should set max rate if animation cannot be finished', () => {
      const mockAnim = createMockAnimation(1);
      mockAnim.finish = vi.fn().mockImplementation(() => {
        throw new Error('Cannot finish infinite animation');
      });
      mockAnimations = [mockAnim];

      slowmo(Infinity);

      expect(mockAnim.playbackRate).toBe(16);
    });
  });

  describe('Media element tracking', () => {
    it('should modify playbackRate of media elements', () => {
      const mockVideo = createMockMediaElement(1);
      mockMediaElements = [mockVideo];

      slowmo(0.5);

      expect(mockVideo.playbackRate).toBe(0.5);
    });

    it('should clamp playbackRate to browser limits', () => {
      const mockVideo = createMockMediaElement(1);
      mockMediaElements = [mockVideo];

      // Very slow - should clamp to 0.0625
      slowmo(0.01);
      expect(mockVideo.playbackRate).toBe(0.0625);
    });

    it('should clamp high playbackRate', () => {
      const mockVideo = createMockMediaElement(1);
      mockMediaElements = [mockVideo];

      // Very fast - should clamp to 16
      slowmo(100);
      expect(mockVideo.playbackRate).toBe(16);
    });

    it('should skip excluded media elements', () => {
      const mockVideo = createMockMediaElement(1);
      mockVideo.closest = vi.fn().mockReturnValue(true); // Excluded
      mockMediaElements = [mockVideo];

      slowmo(0.5);

      // Should not modify excluded media
      expect(mockVideo.playbackRate).toBe(1);
    });

    it('should pause media when speed is 0', () => {
      const mockVideo = createMockMediaElement(1);
      mockVideo.pause = vi.fn();
      mockVideo.play = vi.fn();
      mockVideo.paused = false;
      mockMediaElements = [mockVideo];

      slowmo(0.5);
      slowmo(0); // Pause

      expect(mockVideo.pause).toHaveBeenCalled();
    });

    it('should jump to end at Infinity speed', () => {
      const mockVideo = createMockMediaElement(1);
      mockVideo.duration = 60;
      mockVideo.currentTime = 10;
      mockVideo.pause = vi.fn();
      mockMediaElements = [mockVideo];

      slowmo(Infinity);

      expect(mockVideo.currentTime).toBe(60);
      expect(mockVideo.pause).toHaveBeenCalled();
    });
  });
});

// Helper to create a mock Animation object
function createMockAnimation(initialRate: number) {
  return {
    playbackRate: initialRate,
    playState: 'running' as PlayState,
    effect: {
      target: {
        closest: vi.fn().mockReturnValue(null), // Not excluded
      },
    },
    pause: vi.fn(),
    play: vi.fn(),
    finish: vi.fn(),
  };
}

// Helper to create a mock HTMLMediaElement
function createMockMediaElement(initialRate: number) {
  return {
    playbackRate: initialRate,
    paused: true,
    duration: 60,
    currentTime: 0,
    closest: vi.fn().mockReturnValue(null), // Not excluded
    pause: vi.fn(),
    play: vi.fn(),
  };
}

type PlayState = 'idle' | 'running' | 'paused' | 'finished';
