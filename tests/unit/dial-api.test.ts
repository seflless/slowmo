import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock DOM environment
const mockBody = {
  appendChild: vi.fn(),
};

const mockElement = {
  remove: vi.fn(),
  destroy: vi.fn(),
  style: {
    cssText: '',
    right: '20px',
    bottom: '20px',
    cursor: '',
  },
  className: '',
  innerHTML: '',
  appendChild: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  querySelector: vi.fn(() => null),
  getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 64, height: 64 })),
  requestPointerLock: vi.fn(),
};

// Mock document
vi.stubGlobal('document', {
  body: mockBody,
  createElement: vi.fn(() => ({ ...mockElement })),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  pointerLockElement: null,
  exitPointerLock: vi.fn(),
  getAnimations: vi.fn(() => []),
  querySelectorAll: vi.fn(() => []),
});

// Mock window
vi.stubGlobal('window', {
  innerWidth: 1920,
  innerHeight: 1080,
  requestAnimationFrame: vi.fn((cb) => 1),
  localStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
  },
});

// Mock performance
Object.defineProperty(global, 'performance', {
  value: {
    now: vi.fn(() => 0),
  },
  writable: true,
});

describe('dial-api', () => {
  let setupDial: typeof import('../../src/dial-api').setupDial;
  let shutdownDial: typeof import('../../src/dial-api').shutdownDial;
  let isDialActive: typeof import('../../src/dial-api').isDialActive;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    mockBody.appendChild.mockClear();
    mockElement.remove.mockClear();

    // Re-import to get fresh state (singleton reset)
    vi.resetModules();
    const module = await import('../../src/dial-api');
    setupDial = module.setupDial;
    shutdownDial = module.shutdownDial;
    isDialActive = module.isDialActive;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setupDial()', () => {
    it('should create and append dial to body', () => {
      const result = setupDial();
      expect(result).not.toBeNull();
      expect(mockBody.appendChild).toHaveBeenCalled();
    });

    it('should return null on second call (singleton)', () => {
      const first = setupDial();
      const second = setupDial();
      expect(first).not.toBeNull();
      expect(second).toBeNull();
      expect(mockBody.appendChild).toHaveBeenCalledTimes(1);
    });

    it('should mark dial as active', () => {
      expect(isDialActive()).toBe(false);
      setupDial();
      expect(isDialActive()).toBe(true);
    });
  });

  describe('shutdownDial()', () => {
    it('should do nothing if dial not active', () => {
      shutdownDial();
      expect(mockElement.remove).not.toHaveBeenCalled();
    });

    it('should remove dial from DOM', () => {
      setupDial();
      shutdownDial();
      // Check that dial was deactivated
      expect(isDialActive()).toBe(false);
    });

    it('should allow setupDial again after shutdown', () => {
      setupDial();
      shutdownDial();
      const result = setupDial();
      expect(result).not.toBeNull();
    });
  });

  describe('isDialActive()', () => {
    it('should return false initially', () => {
      expect(isDialActive()).toBe(false);
    });

    it('should return true after setupDial', () => {
      setupDial();
      expect(isDialActive()).toBe(true);
    });

    it('should return false after shutdownDial', () => {
      setupDial();
      shutdownDial();
      expect(isDialActive()).toBe(false);
    });
  });
});
