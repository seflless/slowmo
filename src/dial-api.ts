/**
 * Compatibility API for the original `slowmo/dial` entry point.
 *
 * Prefer `slowmo/toolbar` and `createSlowmoToolbar()` for new integrations.
 */

import {
  createSlowmoToolbar,
  type SlowmoToolbarHost,
  type SlowmoToolbarOptions,
} from './toolbar';

export * from './toolbar';

let toolbarHost: SlowmoToolbarHost | null = null;

export function setupDial(
  options: SlowmoToolbarOptions = {},
): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  if (toolbarHost) {
    if (toolbarHost.isOpen()) return null;
    return toolbarHost.open();
  }

  toolbarHost = createSlowmoToolbar(options);
  return toolbarHost.getElement();
}

export function shutdownDial(): void {
  toolbarHost?.destroy();
  toolbarHost = null;
}

export function isDialActive(): boolean {
  return toolbarHost?.isOpen() ?? false;
}
