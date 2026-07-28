/**
 * Isolated-world toolbar host. It can use extension storage and messaging,
 * while the actual timing runtime lives in the page's main world.
 */

import type {
  SlowmoController,
  SlowmoSnapshot,
  SlowmoSubscriber,
} from '../index';
import {
  createSlowmoToolbarHost,
  type SlowmoToolbarHost,
  type ToolbarPersistence,
  type ToolbarViewState,
} from '../toolbar-core';
import {
  COMMAND_EVENT,
  COMMAND_MESSAGE,
  SESSION_ENDED_MESSAGE,
  type ExtensionCommand,
} from './protocol';

declare const chrome: {
  storage: {
    local: {
      get(key: string): Promise<Record<string, unknown>>;
      set(value: Record<string, unknown>): Promise<void>;
    };
  };
  runtime: {
    sendMessage(message: unknown): Promise<unknown>;
  };
};

declare global {
  interface Window {
    __slowmoExtensionToolbarHostV1?: SlowmoToolbarHost;
    __slowmoExtensionSessionTokenV1?: string;
  }
}

const STORAGE_KEY = 'toolbarPlacementV1';

function dispatchCommand(command: ExtensionCommand): void {
  document.dispatchEvent(new CustomEvent(COMMAND_EVENT, { detail: command }));
  void chrome.runtime.sendMessage({
    type: COMMAND_MESSAGE,
    sessionToken: window.__slowmoExtensionSessionTokenV1,
    command: command.command,
    ...(command.command === 'set-speed'
      ? {
          speed: Number.isFinite(command.speed)
            ? command.speed
            : 'infinity',
        }
      : {}),
  });
}

function createBridgeController(): SlowmoController {
  let snapshot: SlowmoSnapshot = {
    status: 'inactive',
    speed: 1,
    paused: false,
  };
  const subscribers = new Set<SlowmoSubscriber>();

  function emit(): void {
    for (const subscriber of subscribers) subscriber(snapshot);
  }

  const controller: SlowmoController = {
    activate() {
      if (snapshot.status === 'active') return;
      snapshot = { status: 'active', speed: 1, paused: false };
      dispatchCommand({ command: 'set-speed', speed: 1 });
      emit();
    },
    setSpeed(speed) {
      controller.activate();
      snapshot = {
        status: 'active',
        speed,
        paused: speed === 0,
      };
      dispatchCommand({ command: 'set-speed', speed });
      emit();
    },
    pause() {
      controller.setSpeed(0);
    },
    play() {
      controller.setSpeed(snapshot.speed > 0 ? snapshot.speed : 1);
    },
    reset() {
      controller.setSpeed(1);
    },
    destroy() {
      if (snapshot.status === 'inactive') return;
      dispatchCommand({ command: 'deactivate' });
      snapshot = { status: 'inactive', speed: 1, paused: false };
      emit();
      void chrome.runtime.sendMessage({
        type: SESSION_ENDED_MESSAGE,
        sessionToken: window.__slowmoExtensionSessionTokenV1,
      });
    },
    getSpeed() {
      return snapshot.speed;
    },
    getSnapshot() {
      return snapshot;
    },
    subscribe(subscriber) {
      subscribers.add(subscriber);
      subscriber(snapshot);
      return () => subscribers.delete(subscriber);
    },
  };

  return controller;
}

async function waitForBody(): Promise<void> {
  if (document.body) return;
  await new Promise<void>((resolve) => {
    document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
  });
}

async function mountToolbar(): Promise<void> {
  await waitForBody();
  if (window.__slowmoExtensionToolbarHostV1) {
    window.__slowmoExtensionToolbarHostV1.reset();
    window.__slowmoExtensionToolbarHostV1.open();
    return;
  }

  const stored = await chrome.storage.local.get(STORAGE_KEY);
  let cachedState =
    (stored[STORAGE_KEY] as Partial<ToolbarViewState> | undefined) ?? null;
  const persistence: ToolbarPersistence = {
    load: () => cachedState,
    save: (state) => {
      cachedState = state;
      void chrome.storage.local.set({ [STORAGE_KEY]: state });
    },
  };

  window.__slowmoExtensionToolbarHostV1 = createSlowmoToolbarHost({
    controller: createBridgeController(),
    persistence,
    shortcut: false,
    defaultPlacement: 'bottom-right',
  });
}

void mountToolbar();
