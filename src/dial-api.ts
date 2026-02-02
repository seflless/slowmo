/**
 * slowmo Dial API
 *
 * Simple vanilla JS API for adding the slowmo dial to any page.
 *
 * @example
 * import { setupDial, shutdownDial } from 'slowmo/dial';
 * setupDial();     // Fixed position, mounted to body, draggable
 * shutdownDial();  // Removes dial and cleans up
 */

import { createDial } from './dial';
import { slowmo } from './index';

// Singleton instance
let dialInstance: HTMLElement | null = null;

/**
 * Set up the slowmo dial component.
 *
 * Creates a draggable dial fixed to the viewport that controls slowmo speed.
 * Only one dial can exist at a time (singleton pattern).
 *
 * @returns The dial element, or null if already set up
 */
export function setupDial(): HTMLElement | null {
  if (dialInstance) {
    return null;
  }

  if (typeof document === 'undefined') {
    return null;
  }

  dialInstance = createDial({
    onSpeedChange: (speed) => {
      slowmo(speed);
    },
    initialSpeed: slowmo.getSpeed() || 1,
    initialPaused: slowmo.getSpeed() === 0,
  });

  document.body.appendChild(dialInstance);

  return dialInstance;
}

/**
 * Remove the dial and clean up event listeners.
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
 * Check if the dial is currently active.
 */
export function isDialActive(): boolean {
  return dialInstance !== null;
}
