/**
 * slowmo Chrome Extension - Content Script
 *
 * Built from TypeScript source. Injects slowmo library and creates the dial controller.
 */

import { slowmo } from '../index';
import { createDial } from '../dial';

// Extend Window interface for our flag
declare global {
  interface Window {
    __slowmoExtensionLoaded?: boolean;
  }
}

// Avoid double injection (extension loaded twice)
if (window.__slowmoExtensionLoaded) {
  // Already loaded, skip
} else {
  window.__slowmoExtensionLoaded = true;

  // Wait for DOM to be ready
  function init() {
    if (!document.body) {
      setTimeout(init, 50);
      return;
    }

    // Create the dial controller
    const dial = createDial({
      onSpeedChange: (speed) => {
        slowmo(speed);
      },
      onPauseToggle: (_paused) => {
        // Handled via onSpeedChange(0) for pause
      },
      initialSpeed: 1,
      initialPaused: false,
    });

    document.body.appendChild(dial);
  }

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
