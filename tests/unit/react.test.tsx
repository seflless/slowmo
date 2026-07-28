// @vitest-environment jsdom

import React, { StrictMode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SlowmoToolbar,
  useSlowmo,
} from '../../src/react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('React adapter', () => {
  let container: HTMLDivElement;
  let root: Root;

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
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('mounts one shared toolbar in Strict Mode and fully cleans it up', () => {
    const nativeRAF = window.requestAnimationFrame;

    act(() => {
      root.render(
        <StrictMode>
          <SlowmoToolbar shortcut={false} persistence={false} />
        </StrictMode>,
      );
    });

    expect(document.querySelectorAll('.slowmo-toolbar')).toHaveLength(1);
    expect(window.requestAnimationFrame).not.toBe(nativeRAF);

    act(() => root.unmount());
    expect(document.querySelectorAll('.slowmo-toolbar')).toHaveLength(0);
    expect(window.requestAnimationFrame).toBe(nativeRAF);

    root = createRoot(container);
  });

  it('provides hooks for a custom React playback component', () => {
    function CustomControls() {
      const slowmo = useSlowmo();
      return (
        <div>
          <output>{slowmo.status}:{slowmo.speed}</output>
          <button type="button" onClick={() => slowmo.setSpeed(0.5)}>
            Half speed
          </button>
          <button type="button" onClick={slowmo.reset}>
            Reset
          </button>
        </div>
      );
    }

    act(() => root.render(<CustomControls />));
    expect(container.querySelector('output')?.textContent).toBe('inactive:1');

    act(() => {
      container.querySelectorAll('button')[0].click();
    });
    expect(container.querySelector('output')?.textContent).toBe('active:0.5');

    act(() => {
      container.querySelectorAll('button')[1].click();
    });
    expect(container.querySelector('output')?.textContent).toBe('active:1');
  });

  it('updates callback props without remounting or resetting the toolbar', () => {
    const firstCallback = vi.fn();
    const latestCallback = vi.fn();
    act(() => {
      root.render(
        <SlowmoToolbar
          defaultOpen
          shortcut={false}
          persistence={false}
          onOpenChange={firstCallback}
        />,
      );
    });
    const toolbar = document.querySelector<HTMLElement>('.slowmo-toolbar');
    const speedButton = toolbar?.shadowRoot
      ?.querySelector<HTMLButtonElement>('.speed-half');
    act(() => {
      speedButton?.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
      }));
    });

    act(() => {
      root.render(
        <SlowmoToolbar
          defaultOpen
          shortcut={false}
          persistence={false}
          onOpenChange={latestCallback}
        />,
      );
    });

    expect(document.querySelector('.slowmo-toolbar')).toBe(toolbar);
    expect(speedButton?.textContent).toBe('2×');
    act(() => {
      toolbar?.shadowRoot
        ?.querySelector<HTMLButtonElement>('.close-button')
        ?.click();
    });
    expect(latestCallback).toHaveBeenCalledWith(false);

    act(() => {
      root.render(
        <SlowmoToolbar
          defaultOpen
          shortcut={false}
          persistence={false}
          onOpenChange={() => undefined}
        />,
      );
    });
    expect(document.querySelector('.slowmo-toolbar')).toBe(toolbar);
    expect(
      toolbar?.shadowRoot?.querySelector('.toolbar-frame')?.classList,
    ).toContain('leaving');
  });

  it('keeps shortcut-opened state across rerenders when defaultOpen is false', () => {
    act(() => {
      root.render(
        <SlowmoToolbar
          defaultOpen={false}
          shortcut="Ctrl+Shift+K"
          persistence={false}
        />,
      );
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'K',
        ctrlKey: true,
        shiftKey: true,
      }));
    });
    expect(document.querySelectorAll('.slowmo-toolbar')).toHaveLength(1);

    act(() => {
      root.render(
        <SlowmoToolbar
          defaultOpen={false}
          shortcut="Ctrl+Shift+K"
          persistence={false}
          onOpenChange={() => undefined}
        />,
      );
    });
    expect(document.querySelectorAll('.slowmo-toolbar')).toHaveLength(1);
  });

  it('keeps the shared runtime active until the last React toolbar closes', () => {
    const nativeRAF = window.requestAnimationFrame;
    act(() => {
      root.render(
        <>
          <SlowmoToolbar shortcut={false} persistence={false} />
          <SlowmoToolbar shortcut={false} persistence={false} />
        </>,
      );
    });

    const toolbars = [...document.querySelectorAll<HTMLElement>('.slowmo-toolbar')];
    expect(toolbars).toHaveLength(2);
    act(() => {
      toolbars[0].shadowRoot
        ?.querySelector<HTMLButtonElement>('.close-button')
        ?.click();
    });
    expect(window.requestAnimationFrame).not.toBe(nativeRAF);

    act(() => {
      toolbars[1].shadowRoot
        ?.querySelector<HTMLButtonElement>('.close-button')
        ?.click();
    });
    expect(window.requestAnimationFrame).toBe(nativeRAF);
  });
});
