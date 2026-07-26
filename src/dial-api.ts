/**
 * slowmo Toolbar API
 *
 * Simple vanilla JS API for adding the slowmo toolbar to any page.
 *
 * @example
 * import { setupDial, shutdownDial } from 'slowmo/dial';
 * setupDial();     // Mounts the floating toolbar
 * shutdownDial();  // Removes it and cleans up
 */

import { createDial } from './dial';
import { slowmo } from './index';

// Singleton instance. The legacy "dial" naming remains part of the public API.
let dialInstance: HTMLElement | null = null;

/**
 * Set up the slowmo toolbar component.
 *
 * Creates a draggable toolbar fixed to the viewport that controls slowmo speed.
 * Only one toolbar can exist at a time (singleton pattern).
 *
 * @returns The toolbar element, or null if already set up
 */
export function setupDial(): HTMLElement | null {
  if (dialInstance) {
    return null;
  }

  if (typeof document === 'undefined') {
    return null;
  }

  const toolbar = createDial({
    onSpeedChange: (speed) => {
      slowmo(speed);
    },
    onClose: () => {
      if (dialInstance === toolbar) {
        dialInstance = null;
      }
    },
    initialSpeed: slowmo.getSpeed() || 1,
    initialPaused: slowmo.getSpeed() === 0,
  });
  dialInstance = toolbar;

  document.body.appendChild(dialInstance);

  return dialInstance;
}

/**
 * Remove the toolbar and clean up event listeners.
 */
export function shutdownDial(): void {
  if (!dialInstance) {
    return;
  }

  // Call destroy to clean up event listeners
  if (typeof (dialInstance as any).destroy === 'function') {
    (dialInstance as any).destroy();
  }

  // Remove from DOM
  dialInstance.remove();
  dialInstance = null;
}

/**
 * Check if the toolbar is currently active.
 */
export function isDialActive(): boolean {
  return dialInstance !== null;
}
