import type { SlowmoController } from './index';
import {
  createDial,
  isToolbarDockEdge,
  isToolbarPoint,
  type SlowmoToolbarElement,
  type ToolbarClock,
  type ToolbarPlacement,
  type ToolbarViewState,
} from './dial';

export type {
  SlowmoToolbarElement,
  ToolbarDockEdge,
  ToolbarPlacement,
  ToolbarPoint,
  ToolbarViewState,
} from './dial';

export interface ToolbarPersistence {
  load(): Partial<ToolbarViewState> | null;
  save(state: ToolbarViewState): void;
}

export interface SlowmoToolbarHostOptions {
  controller: SlowmoController;
  defaultOpen?: boolean;
  defaultPlacement?: ToolbarPlacement;
  anchor?: Element | null;
  anchorSide?: 'top' | 'right' | 'bottom' | 'left';
  anchorGap?: number;
  shortcut?: string | false;
  persistence?: ToolbarPersistence | false;
  mountTarget?: HTMLElement;
  layout?: 'floating' | 'inline';
  onOpenChange?: (open: boolean) => void;
  clock?: ToolbarClock;
}

export interface SlowmoToolbarHost {
  readonly controller: SlowmoController;
  open(): SlowmoToolbarElement | null;
  close(): void;
  toggle(): void;
  reset(): void;
  update(options: Partial<Omit<SlowmoToolbarHostOptions, 'controller'>>): void;
  destroy(): void;
  isOpen(): boolean;
  getElement(): SlowmoToolbarElement | null;
}

const DEFAULT_STORAGE_KEY = 'slowmo-toolbar-placement-v1';
export const DEFAULT_TOOLBAR_SHORTCUT = 'Mod+Shift+S';

function normalizeState(value: Partial<ToolbarViewState> | null): Partial<ToolbarViewState> {
  if (!value) return {};
  return {
    position: isToolbarPoint(value.position) ? value.position : undefined,
    dockEdge: isToolbarDockEdge(value.dockEdge) ? value.dockEdge : undefined,
    isVertical:
      typeof value.isVertical === 'boolean' ? value.isVertical : undefined,
  };
}

export function createLocalStorageToolbarPersistence(
  key = DEFAULT_STORAGE_KEY,
): ToolbarPersistence {
  return {
    load() {
      if (typeof localStorage === 'undefined') return null;
      try {
        const raw = localStorage.getItem(key);
        return raw ? normalizeState(JSON.parse(raw) as Partial<ToolbarViewState>) : null;
      } catch {
        return null;
      }
    },
    save(state) {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        // Placement persistence is best-effort.
      }
    },
  };
}

function eventMatchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const key = parts.find(
    (part) => !['mod', 'meta', 'command', 'cmd', 'control', 'ctrl', 'alt', 'option', 'shift'].includes(part),
  );
  if (!key || event.key.toLowerCase() !== key) return false;

  const isApple =
    typeof navigator !== 'undefined'
    && /mac|iphone|ipad|ipod/i.test(navigator.platform);
  const expectsMod = parts.includes('mod');
  const expectsMeta =
    parts.some((part) => ['meta', 'command', 'cmd'].includes(part))
    || (expectsMod && isApple);
  const expectsCtrl =
    parts.some((part) => ['control', 'ctrl'].includes(part))
    || (expectsMod && !isApple);
  const expectsAlt = parts.some((part) => ['alt', 'option'].includes(part));
  const expectsShift = parts.includes('shift');

  return (
    event.metaKey === expectsMeta
    && event.ctrlKey === expectsCtrl
    && event.altKey === expectsAlt
    && event.shiftKey === expectsShift
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

export function createSlowmoToolbarHost(
  options: SlowmoToolbarHostOptions,
): SlowmoToolbarHost {
  const controller = options.controller;
  let currentOptions = { ...options };
  let element: SlowmoToolbarElement | null = null;
  let openState = false;
  let destroyed = false;

  const host: SlowmoToolbarHost = {
    controller,

    open() {
      if (destroyed || typeof document === 'undefined') return null;
      if (openState && element?.isConnected) return element;
      if (element) {
        element.destroy();
        element = null;
      }

      controller.reset();
      openState = true;
      const persistence =
        currentOptions.persistence === false
          ? null
          : currentOptions.persistence ?? createLocalStorageToolbarPersistence();
      const initialState = normalizeState(persistence?.load() ?? null);
      const nextElement = createDial({
        layout: currentOptions.layout,
        defaultPlacement: currentOptions.defaultPlacement,
        initialState,
        anchor: currentOptions.anchor,
        anchorSide: currentOptions.anchorSide,
        anchorGap: currentOptions.anchorGap,
        initialSpeed: 1,
        initialPaused: false,
        onSpeedChange: (speed) => controller.setSpeed(speed),
        onClose: () => {
          if (element !== nextElement) return;
          openState = false;
          controller.destroy();
          currentOptions.onOpenChange?.(false);
        },
        onClosed: () => {
          if (element === nextElement) element = null;
        },
        clock: currentOptions.clock,
        onStateChange: (state) => {
          const activePersistence =
            currentOptions.persistence === false
              ? null
              : currentOptions.persistence
                ?? createLocalStorageToolbarPersistence();
          activePersistence?.save(state);
        },
      });
      element = nextElement;
      (currentOptions.mountTarget ?? document.body).appendChild(nextElement);
      currentOptions.onOpenChange?.(true);
      return nextElement;
    },

    close() {
      if (!openState) {
        controller.destroy();
        return;
      }
      element?.close();
    },

    toggle() {
      if (openState) host.close();
      else host.open();
    },

    reset() {
      if (element && openState) {
        element.setPlaybackState(1, false);
      } else {
        controller.reset();
      }
    },

    update(nextOptions) {
      if (destroyed) return;
      const previousDefaultOpen = currentOptions.defaultOpen;
      currentOptions = { ...currentOptions, ...nextOptions, controller };
      if (
        nextOptions.mountTarget
        && element
        && element.parentElement !== nextOptions.mountTarget
      ) {
        nextOptions.mountTarget.appendChild(element);
      }
      if (nextOptions.defaultOpen !== previousDefaultOpen) {
        if (nextOptions.defaultOpen === false) host.close();
        if (nextOptions.defaultOpen === true) host.open();
      }
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleKeyDown);
      }
      element?.destroy();
      element = null;
      openState = false;
      controller.destroy();
    },

    isOpen() {
      return openState;
    },

    getElement() {
      return element;
    },
  };

  function handleKeyDown(event: KeyboardEvent): void {
    const shortcut =
      currentOptions.shortcut === undefined
        ? DEFAULT_TOOLBAR_SHORTCUT
        : currentOptions.shortcut;
    if (
      !shortcut
      || event.defaultPrevented
      || event.repeat
      || isEditableTarget(event.target)
      || !eventMatchesShortcut(event, shortcut)
    ) {
      return;
    }

    event.preventDefault();
    host.toggle();
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeyDown);
  }
  if (currentOptions.defaultOpen !== false) host.open();

  return host;
}

export default createSlowmoToolbarHost;
