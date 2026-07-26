/**
 * slowmo Chrome Extension - Content Script
 *
 * Built from TypeScript source. Injects slowmo into every frame and creates one
 * top-level toolbar that controls the full frame tree.
 */

import { slowmo } from '../index';
import { createDial } from '../dial';

// Extend Window interface for our flag
declare global {
  interface Window {
    __slowmoExtensionLoaded?: boolean;
    __slowmoShowToolbar?: () => void;
  }
}

const SYNC_MESSAGE = 'slowmo-extension-sync';
const READY_MESSAGE = 'slowmo-extension-ready';
const TRIGGER_EVENT = 'slowmo-extension-trigger';
const isTopFrame = window === window.top;

if (window.__slowmoExtensionLoaded) {
  // An extension-action click can execute the entry point again.
  window.__slowmoShowToolbar?.();
} else {
  window.__slowmoExtensionLoaded = true;
  let currentSpeed = 1;
  let toolbar: HTMLElement | null = null;

  function broadcastSpeed(speed: number) {
    currentSpeed = speed;
    slowmo(speed);

    for (let index = 0; index < window.frames.length; index += 1) {
      window.frames[index].postMessage({ type: SYNC_MESSAGE, speed }, '*');
    }
  }

  window.addEventListener('message', (event) => {
    const message = event.data as { type?: unknown; speed?: unknown } | null;
    if (!message || typeof message !== 'object') return;

    if (
      message.type === SYNC_MESSAGE
      && event.source === window.parent
      && typeof message.speed === 'number'
    ) {
      broadcastSpeed(message.speed);
      return;
    }

    if (message.type === READY_MESSAGE && event.source) {
      (event.source as Window).postMessage(
        { type: SYNC_MESSAGE, speed: currentSpeed },
        { targetOrigin: '*' },
      );
    }
  });

  if (!isTopFrame) {
    window.parent.postMessage({ type: READY_MESSAGE }, '*');
  }

  function showToolbar() {
    if (!isTopFrame || toolbar?.isConnected) return;
    if (!document.body) {
      setTimeout(showToolbar, 50);
      return;
    }

    toolbar = createDial({
      onSpeedChange: (speed) => {
        broadcastSpeed(speed);
      },
      onPauseToggle: (_paused) => {
        // Handled via onSpeedChange(0) for pause
      },
      onClose: () => {
        toolbar = null;
      },
      initialSpeed: 1,
      initialPaused: false,
    });

    document.body.appendChild(toolbar);
  }

  window.__slowmoShowToolbar = showToolbar;

  if (isTopFrame) {
    window.addEventListener(TRIGGER_EVENT, showToolbar);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showToolbar, { once: true });
    } else {
      showToolbar();
    }
  }
}
