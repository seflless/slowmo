export const COMMAND_EVENT = 'slowmo-extension-command-v1';
export const COMMAND_MESSAGE = 'slowmo-extension-command-message-v1';
export const FRAME_MESSAGE = 'slowmo-extension-frame-v1';
export const READY_MESSAGE = 'slowmo-extension-ready-v1';
export const SESSION_ENDED_MESSAGE = 'slowmo-extension-session-ended-v1';

export type ExtensionCommand =
  | { command: 'set-speed'; speed: number }
  | { command: 'deactivate' };

export interface FrameMessage {
  type: typeof FRAME_MESSAGE;
  command: ExtensionCommand;
}
