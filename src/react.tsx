import { useEffect, useRef, useState } from 'react';
import {
  createSlowmoController,
  type SlowmoController,
  type SlowmoSnapshot,
} from './index';
import {
  createSlowmoToolbar,
  type SlowmoToolbarOptions,
} from './toolbar';

export type { SlowmoToolbarOptions } from './toolbar';
export type {
  SlowmoController,
  SlowmoSnapshot,
} from './index';

export interface SlowmoToolbarProps extends SlowmoToolbarOptions {}

export interface SlowmoHook extends SlowmoSnapshot {
  controller: SlowmoController;
  setSpeed(speed: number): void;
  pause(): void;
  play(): void;
  reset(): void;
}

/**
 * Returns a stable headless controller and destroys controllers created by the
 * hook when the component unmounts. Pass a controller to share external
 * ownership without having the hook destroy it.
 */
export function useSlowmoController(
  externalController?: SlowmoController,
): SlowmoController {
  const ownedController = useRef<SlowmoController | null>(null);
  if (!externalController && !ownedController.current) {
    ownedController.current = createSlowmoController();
  }

  const controller = externalController ?? ownedController.current!;
  useEffect(() => {
    if (externalController) return undefined;
    return () => controller.destroy();
  }, [controller, externalController]);

  return controller;
}

/**
 * Subscribes a React component to a controller without coupling the headless
 * package entry point to React.
 */
export function useSlowmoSnapshot(
  controller: SlowmoController,
): SlowmoSnapshot {
  const [snapshot, setSnapshot] = useState(() => controller.getSnapshot());
  useEffect(
    () => controller.subscribe(setSnapshot),
    [controller],
  );
  return snapshot;
}

/**
 * Convenient headless React hook for building custom playback controls.
 */
export function useSlowmo(
  externalController?: SlowmoController,
): SlowmoHook {
  const controller = useSlowmoController(externalController);
  const snapshot = useSlowmoSnapshot(controller);
  return {
    ...snapshot,
    controller,
    setSpeed: (speed) => controller.setSpeed(speed),
    pause: () => controller.pause(),
    play: () => controller.play(),
    reset: () => controller.reset(),
  };
}

/**
 * Drop-in toolbar component. It renders the same framework-agnostic toolbar
 * used by the vanilla package and Chrome extension.
 */
export function SlowmoToolbar(props: SlowmoToolbarProps): null {
  const hostRef = useRef<ReturnType<typeof createSlowmoToolbar> | null>(null);

  useEffect(() => {
    const toolbar = createSlowmoToolbar(props);
    hostRef.current = toolbar;
    return () => {
      toolbar.destroy();
      if (hostRef.current === toolbar) hostRef.current = null;
    };
  }, [props.controller]);

  useEffect(() => {
    hostRef.current?.update(props);
  });

  return null;
}

/** @deprecated Use `SlowmoToolbar` for the explicit product name. */
export const Slowmo = SlowmoToolbar;

export default SlowmoToolbar;
