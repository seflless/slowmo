// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSlowmoToolbar,
  type ToolbarPersistence,
  type ToolbarPlacement,
  type ToolbarViewState,
} from '../../src/toolbar';

describe('shared toolbar host', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 1),
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      writable: true,
      value: vi.fn(),
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
    localStorage.clear();
  });

  afterEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('keeps toolbar visibility and timing activation in one lifecycle', () => {
    const nativeRAF = window.requestAnimationFrame;
    const toolbar = createSlowmoToolbar({ shortcut: false, persistence: false });

    expect(toolbar.isOpen()).toBe(true);
    expect(toolbar.controller.getSnapshot().status).toBe('active');
    expect(window.requestAnimationFrame).not.toBe(nativeRAF);

    toolbar.getElement()?.shadowRoot
      ?.querySelector<HTMLButtonElement>('.close-button')
      ?.click();

    expect(toolbar.isOpen()).toBe(false);
    expect(toolbar.controller.getSnapshot()).toEqual({
      status: 'inactive',
      speed: 1,
      paused: false,
    });
    expect(window.requestAnimationFrame).toBe(nativeRAF);

    toolbar.destroy();
  });

  it('reopens at 1x instead of restoring a previous speed', () => {
    const toolbar = createSlowmoToolbar({ shortcut: false, persistence: false });
    toolbar.controller.setSpeed(8);

    toolbar.close();
    toolbar.open();

    expect(toolbar.controller.getSpeed()).toBe(1);
    expect(
      toolbar.getElement()?.shadowRoot?.querySelector('.speed-half')?.textContent,
    ).toBe('1×');

    toolbar.destroy();
  });

  it('uses replaceable persistence for placement state only', () => {
    const saved: unknown[] = [];
    const persistence: ToolbarPersistence = {
      load: () => ({
        position: { xPct: 0, yPct: 1 },
        dockEdge: 'bottom-left',
        isVertical: false,
      }),
      save: (state) => saved.push(state),
    };
    const toolbar = createSlowmoToolbar({
      persistence,
      shortcut: false,
    });
    const shell = toolbar.getElement()?.shadowRoot
      ?.querySelector<HTMLElement>('.toolbar-shell');

    expect(shell?.style.left).toBe('55px');
    expect(shell?.style.top).toBe('734px');
    expect(saved).toEqual([]);

    toolbar.destroy();
  });

  it('can start relative to content and becomes floating when dragged', () => {
    const anchor = document.createElement('h2');
    document.body.appendChild(anchor);
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
      x: 400,
      y: 100,
      left: 400,
      top: 100,
      right: 600,
      bottom: 140,
      width: 200,
      height: 40,
      toJSON: () => ({}),
    });

    const toolbar = createSlowmoToolbar({
      anchor,
      anchorGap: 10,
      shortcut: false,
      persistence: false,
    });
    const shell = toolbar.getElement()?.shadowRoot
      ?.querySelector<HTMLElement>('.toolbar-shell');

    expect(shell?.style.left).toBe('500px');
    expect(shell?.style.top).toBe('184px');

    toolbar.destroy();
  });

  it('renders semantic side placements vertically and respects scrollbar width', () => {
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 1000,
    });
    const toolbar = createSlowmoToolbar({
      defaultPlacement: 'right',
      shortcut: false,
      persistence: false,
    });
    const pill = toolbar.getElement()?.shadowRoot
      ?.querySelector<HTMLElement>('.toolbar-pill');
    const shell = toolbar.getElement()?.shadowRoot
      ?.querySelector<HTMLElement>('.toolbar-shell');

    expect(pill?.classList).toContain('vertical');
    expect(shell?.style.left).toBe('966px');
    expect(shell?.style.top).toBe('384px');

    toolbar.destroy();
    Reflect.deleteProperty(document.documentElement, 'clientWidth');
  });

  it.each([
    ['top-left', '55px', '34px', false],
    ['top-center', '512px', '34px', false],
    ['top-right', '969px', '34px', false],
    ['left', '34px', '384px', true],
    ['center', '512px', '384px', false],
    ['right', '990px', '384px', true],
    ['bottom-left', '55px', '734px', false],
    ['bottom-center', '512px', '734px', false],
    ['bottom-right', '969px', '734px', false],
  ] satisfies Array<[ToolbarPlacement, string, string, boolean]>)(
    'renders the %s semantic placement',
    (defaultPlacement, left, top, vertical) => {
      const toolbar = createSlowmoToolbar({
        defaultPlacement,
        shortcut: false,
        persistence: false,
      });
      const root = toolbar.getElement()?.shadowRoot;
      const shell = root?.querySelector<HTMLElement>('.toolbar-shell');
      const pill = root?.querySelector<HTMLElement>('.toolbar-pill');

      expect(shell?.style.left).toBe(left);
      expect(shell?.style.top).toBe(top);
      expect(pill?.classList.contains('vertical')).toBe(vertical);
      toolbar.destroy();
    },
  );

  it('reclamps a docked toolbar when the viewport changes size', () => {
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 1000,
    });
    const toolbar = createSlowmoToolbar({
      defaultPlacement: 'right',
      shortcut: false,
      persistence: false,
    });
    const shell = toolbar.getElement()?.shadowRoot
      ?.querySelector<HTMLElement>('.toolbar-shell');
    expect(shell?.style.left).toBe('966px');

    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 800,
    });
    window.dispatchEvent(new Event('resize'));
    expect(shell?.style.left).toBe('766px');

    toolbar.destroy();
    Reflect.deleteProperty(document.documentElement, 'clientWidth');
  });

  it('drags from the divider, docks to a side, and rotates vertically', () => {
    const saved: ToolbarViewState[] = [];
    const toolbar = createSlowmoToolbar({
      shortcut: false,
      persistence: {
        load: () => null,
        save: (state) => saved.push(state),
      },
    });
    const root = toolbar.getElement()?.shadowRoot;
    const shell = root?.querySelector<HTMLElement>('.toolbar-shell');
    const pill = root?.querySelector<HTMLElement>('.toolbar-pill');
    const divider = root?.querySelector<HTMLElement>('.pill-divider');
    vi.spyOn(shell!, 'getBoundingClientRect').mockImplementation(() => {
      const vertical = pill?.classList.contains('vertical') ?? false;
      const width = vertical ? 68 : 110;
      const height = vertical ? 110 : 68;
      const centerX = Number.parseFloat(shell?.style.left || '0');
      const centerY = Number.parseFloat(shell?.style.top || '0');
      return new DOMRect(
        centerX - width / 2,
        centerY - height / 2,
        width,
        height,
      );
    });

    divider?.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      clientX: 969,
      clientY: 734,
    }));
    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 10,
      clientY: 384,
    }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(saved.at(-1)).toMatchObject({
      dockEdge: 'left',
      isVertical: true,
    });
    expect(pill?.classList).toContain('vertical');
    toolbar.destroy();
  });

  it('starts a drag when the visible outer ring is grabbed', () => {
    const toolbar = createSlowmoToolbar({
      shortcut: false,
      persistence: false,
    });
    const shell = toolbar.getElement()?.shadowRoot
      ?.querySelector<HTMLElement>('.toolbar-shell');

    shell?.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      clientX: 900,
      clientY: 700,
    }));

    expect(shell?.classList).toContain('dragging');
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(shell?.classList).not.toContain('dragging');
    toolbar.destroy();
  });

  it('ships light, dark, reduced-motion, and top-layer styles', () => {
    const toolbar = createSlowmoToolbar({ shortcut: false, persistence: false });
    const styles = toolbar.getElement()?.shadowRoot
      ?.querySelector('style')?.textContent;

    expect(styles).toContain('prefers-color-scheme: light');
    expect(styles).toContain('prefers-reduced-motion: reduce');
    expect(styles).toContain('z-index: 2147483647');
    toolbar.destroy();
  });

  it('supports a configurable keyboard shortcut without keeping timing active', () => {
    const toolbar = createSlowmoToolbar({
      defaultOpen: false,
      shortcut: 'Ctrl+Shift+K',
      persistence: false,
    });

    expect(toolbar.isOpen()).toBe(false);
    expect(toolbar.controller.getSnapshot().status).toBe('inactive');

    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'K',
      ctrlKey: true,
      shiftKey: true,
    }));
    expect(toolbar.isOpen()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'K',
      ctrlKey: true,
      shiftKey: true,
    }));
    expect(toolbar.isOpen()).toBe(false);
    expect(toolbar.controller.getSnapshot().status).toBe('inactive');

    toolbar.destroy();
  });

  it('supports keyboard speed selection', () => {
    const toolbar = createSlowmoToolbar({ shortcut: false, persistence: false });
    const speedButton = toolbar.getElement()?.shadowRoot
      ?.querySelector<HTMLButtonElement>('.speed-half');

    speedButton?.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
    }));
    expect(speedButton?.textContent).toBe('2×');
    expect(toolbar.controller.getSpeed()).toBe(2);

    speedButton?.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Home',
      bubbles: true,
    }));
    expect(speedButton?.textContent).toBe('1×');

    speedButton?.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'End',
      bubbles: true,
    }));
    expect(speedButton?.textContent).toBe('∞');

    toolbar.destroy();
  });

  it('keeps toolbar affordance timers on wall-clock time', async () => {
    const wallClockSetTimeout = globalThis.setTimeout.bind(globalThis);
    const toolbar = createSlowmoToolbar({ shortcut: false, persistence: false });
    toolbar.controller.setSpeed(1 / 64);
    const playButton = toolbar.getElement()?.shadowRoot
      ?.querySelector<HTMLButtonElement>('.play-half');

    playButton?.dispatchEvent(new MouseEvent('mouseenter'));
    await new Promise((resolve) => wallClockSetTimeout(resolve, 650));

    expect(
      toolbar.getElement()?.shadowRoot?.querySelector('.tooltip')?.textContent,
    ).toBe('Pause all animations');

    toolbar.destroy();
  });
});
