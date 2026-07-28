import {
  createSlowmoController,
  getSlowmoWallClock,
  type SlowmoController,
} from './index';
import {
  createSlowmoToolbarHost,
  type SlowmoToolbarHostOptions,
} from './toolbar-core';

export {
  DEFAULT_TOOLBAR_SHORTCUT,
  createLocalStorageToolbarPersistence,
  type SlowmoToolbarElement,
  type SlowmoToolbarHost,
  type ToolbarDockEdge,
  type ToolbarPersistence,
  type ToolbarPlacement,
  type ToolbarPoint,
  type ToolbarViewState,
} from './toolbar-core';

export interface SlowmoToolbarOptions
  extends Omit<SlowmoToolbarHostOptions, 'controller' | 'clock'> {
  controller?: SlowmoController;
}

export function createSlowmoToolbar(
  options: SlowmoToolbarOptions = {},
) {
  return createSlowmoToolbarHost({
    ...options,
    controller: options.controller ?? createSlowmoController(),
    clock: getSlowmoWallClock(),
  });
}

export default createSlowmoToolbar;
