/**
 * Main-world runtime bridge. The background service worker injects this file
 * into every eligible frame only after the user invokes Slowmo.
 */

import { createSlowmoController, type SlowmoController } from '../index';
import {
  COMMAND_EVENT,
  FRAME_MESSAGE,
  READY_MESSAGE,
  type ExtensionCommand,
  type FrameMessage,
} from './protocol';

interface ExtensionRuntime {
  controller: SlowmoController;
  sessionToken: string;
  setSpeed(speed: number): void;
  deactivate(): void;
}

declare global {
  interface Window {
    __slowmoExtensionRuntimeV1?: ExtensionRuntime;
    __slowmoExtensionSessionTokenV1?: string;
  }
}

const isTopFrame = window === window.top;

function sendToChildren(command: ExtensionCommand): void {
  const message: FrameMessage = { type: FRAME_MESSAGE, command };
  for (let index = 0; index < window.frames.length; index += 1) {
    window.frames[index].postMessage(message, '*');
  }
}

function createRuntime(sessionToken: string): ExtensionRuntime {
  const controller = createSlowmoController();
  let currentSpeed = 1;
  let deactivated = false;

  function apply(command: ExtensionCommand, broadcast = true): void {
    if (deactivated) return;

    if (command.command === 'set-speed') {
      currentSpeed = command.speed;
      controller.setSpeed(command.speed);
      if (broadcast) sendToChildren(command);
      return;
    }

    if (broadcast) sendToChildren(command);
    deactivated = true;
    controller.destroy();
    document.removeEventListener(COMMAND_EVENT, handleToolbarCommand);
    window.removeEventListener('message', handleFrameMessage);
    delete window.__slowmoExtensionRuntimeV1;
  }

  function handleToolbarCommand(event: Event): void {
    if (!isTopFrame || !(event instanceof CustomEvent)) return;
    const detail = event.detail as ExtensionCommand | null;
    if (!detail || typeof detail !== 'object') return;
    if (detail.command === 'deactivate') apply(detail);
    if (
      detail.command === 'set-speed'
      && typeof detail.speed === 'number'
      && detail.speed >= 0
    ) {
      apply(detail);
    }
  }

  function handleFrameMessage(event: MessageEvent): void {
    const message = event.data as FrameMessage | {
      type?: unknown;
    } | null;
    if (!message || typeof message !== 'object') return;

    if (message.type === FRAME_MESSAGE && !isTopFrame && 'command' in message) {
      const command = message.command;
      if (
        command.command === 'deactivate'
        || (
          command.command === 'set-speed'
          && typeof command.speed === 'number'
          && command.speed >= 0
        )
      ) {
        apply(command, true);
      }
      return;
    }

    if (message.type === READY_MESSAGE && event.source) {
      (event.source as Window).postMessage({
        type: FRAME_MESSAGE,
        command: { command: 'set-speed', speed: currentSpeed },
      } satisfies FrameMessage, { targetOrigin: '*' });
    }
  }

  document.addEventListener(COMMAND_EVENT, handleToolbarCommand);
  window.addEventListener('message', handleFrameMessage);
  controller.reset();

  if (!isTopFrame) {
    window.parent.postMessage({ type: READY_MESSAGE }, '*');
  }

  return {
    controller,
    sessionToken,
    setSpeed(speed) {
      apply({ command: 'set-speed', speed });
    },
    deactivate() {
      apply({ command: 'deactivate' });
    },
  };
}

const sessionToken = window.__slowmoExtensionSessionTokenV1;
if (!sessionToken) {
  // Runtime and token injection are separate Chrome operations. If a
  // navigation lands between them, never activate in the new document.
  window.__slowmoExtensionRuntimeV1?.deactivate();
} else if (
  window.__slowmoExtensionRuntimeV1
  && window.__slowmoExtensionRuntimeV1.sessionToken === sessionToken
) {
  window.__slowmoExtensionRuntimeV1.setSpeed(1);
} else {
  window.__slowmoExtensionRuntimeV1?.deactivate();
  window.__slowmoExtensionRuntimeV1 = createRuntime(sessionToken);
}
