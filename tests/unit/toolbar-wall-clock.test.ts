// @vitest-environment jsdom

import { expect, it, vi } from 'vitest';

it('uses native toolbar timers even when imported after Slowmo activation', async () => {
  vi.resetModules();
  const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
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

  const { createSlowmoController } = await import('../../src/index');
  const existingController = createSlowmoController();
  existingController.setSpeed(1 / 64);

  const { createSlowmoToolbar } = await import('../../src/toolbar');
  const toolbar = createSlowmoToolbar({ shortcut: false, persistence: false });
  try {
    toolbar.controller.setSpeed(1 / 64);
    const playButton = toolbar.getElement()?.shadowRoot
      ?.querySelector<HTMLButtonElement>('.play-half');

    playButton?.dispatchEvent(new MouseEvent('mouseenter'));
    await new Promise((resolve) => nativeSetTimeout(resolve, 650));

    expect(
      toolbar.getElement()?.shadowRoot?.querySelector('.tooltip')?.textContent,
    ).toBe('Pause all animations');
  } finally {
    toolbar.destroy();
    existingController.destroy();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  }
});
