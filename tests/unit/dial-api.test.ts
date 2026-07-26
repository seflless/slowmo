// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

describe('dial-api', () => {
  let setupDial: typeof import('../../src/dial-api').setupDial;
  let shutdownDial: typeof import('../../src/dial-api').shutdownDial;
  let isDialActive: typeof import('../../src/dial-api').isDialActive;

  beforeAll(async () => {
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 1),
    });
    Object.defineProperty(document, 'getAnimations', {
      configurable: true,
      value: vi.fn(() => []),
    });
    Object.defineProperty(HTMLElement.prototype, 'requestPointerLock', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(document, 'exitPointerLock', {
      configurable: true,
      value: vi.fn(),
    });

    const module = await import('../../src/dial-api');
    setupDial = module.setupDial;
    shutdownDial = module.shutdownDial;
    isDialActive = module.isDialActive;
  });

  afterEach(() => {
    shutdownDial();
    document.body.replaceChildren();
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('setupDial()', () => {
    it('creates and appends the toolbar to the body', () => {
      const result = setupDial();

      expect(result).not.toBeNull();
      expect(result?.className).toBe('slowmo-toolbar');
      expect(result?.shadowRoot?.querySelector('[role="toolbar"]')).not.toBeNull();
      expect(document.body.contains(result)).toBe(true);
    });

    it('returns null on the second call', () => {
      const first = setupDial();
      const second = setupDial();

      expect(first).not.toBeNull();
      expect(second).toBeNull();
      expect(document.querySelectorAll('.slowmo-toolbar')).toHaveLength(1);
    });

    it('marks the toolbar as active', () => {
      expect(isDialActive()).toBe(false);
      setupDial();
      expect(isDialActive()).toBe(true);
    });

    it('positions the scrub cursor in the viewport instead of the toolbar shadow root', () => {
      const toolbar = setupDial();
      const speedButton = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>('.speed-half');

      speedButton?.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        button: 0,
        clientX: 321,
        clientY: 123,
      }));

      const cursor = document.querySelector<HTMLElement>('.slowmo-fake-cursor');
      expect(cursor?.parentElement).toBe(document.documentElement);
      expect(cursor?.style.left).toBe('321px');
      expect(cursor?.style.top).toBe('123px');

      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      expect(document.querySelector('.slowmo-fake-cursor')).toBeNull();
    });

    it('scrubs through power-of-two speed presets', () => {
      const toolbar = setupDial();
      const speedButton = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>('.speed-half');
      const displayedSpeed = () => speedButton?.textContent;
      const scrubOnePreset = (movementX: number) => {
        const event = new MouseEvent('mousemove', { bubbles: true });
        Object.defineProperty(event, 'movementX', { value: movementX });
        document.dispatchEvent(event);
      };

      expect(displayedSpeed()).toBe('1×');
      speedButton?.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        button: 0,
        clientX: 100,
        clientY: 20,
      }));

      for (const expected of ['2×', '4×', '8×', '16×', '32×', '∞']) {
        scrubOnePreset(18);
        expect(displayedSpeed()).toBe(expected);
      }

      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
  });

  describe('shutdownDial()', () => {
    it('does nothing if the toolbar is not active', () => {
      expect(() => shutdownDial()).not.toThrow();
      expect(isDialActive()).toBe(false);
    });

    it('removes the toolbar from the DOM', () => {
      const toolbar = setupDial();
      shutdownDial();

      expect(toolbar?.isConnected).toBe(false);
      expect(isDialActive()).toBe(false);
    });

    it('allows setup after shutdown', () => {
      const first = setupDial();
      shutdownDial();
      const second = setupDial();

      expect(second).not.toBeNull();
      expect(second).not.toBe(first);
    });

    it('allows setup again after the toolbar close control is used', async () => {
      const first = setupDial();
      const closeButton = first?.shadowRoot?.querySelector<HTMLButtonElement>('.close-button');

      closeButton?.click();
      await new Promise((resolve) => globalThis.setTimeout(resolve, 200));

      expect(isDialActive()).toBe(false);
      expect(setupDial()).not.toBeNull();
    });
  });

  describe('isDialActive()', () => {
    it('is false initially', () => {
      expect(isDialActive()).toBe(false);
    });

    it('is true after setup', () => {
      setupDial();
      expect(isDialActive()).toBe(true);
    });

    it('is false after shutdown', () => {
      setupDial();
      shutdownDial();
      expect(isDialActive()).toBe(false);
    });
  });
});
