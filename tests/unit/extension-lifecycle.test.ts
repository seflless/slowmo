// @vitest-environment node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface ChromeListeners {
  action?: (tab: { id?: number }) => void;
  message?: (message: unknown, sender: { tab?: { id?: number } }) => void;
  tabRemoved?: (tabId: number) => void;
  navigation?: (details: { tabId: number; frameId: number }) => void;
}

describe('Chrome extension activation boundary', () => {
  let listeners: ChromeListeners;
  let executeScript: ReturnType<typeof vi.fn>;
  let session: Map<string, unknown>;

  beforeEach(async () => {
    vi.resetModules();
    listeners = {};
    session = new Map();
    executeScript = vi.fn().mockResolvedValue([]);

    vi.stubGlobal('chrome', {
      action: {
        setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
        setBadgeText: vi.fn().mockResolvedValue(undefined),
        setTitle: vi.fn().mockResolvedValue(undefined),
        onClicked: {
          addListener: (listener: ChromeListeners['action']) => {
            listeners.action = listener;
          },
        },
      },
      runtime: {
        onMessage: {
          addListener: (listener: ChromeListeners['message']) => {
            listeners.message = listener;
          },
        },
      },
      tabs: {
        onRemoved: {
          addListener: (listener: ChromeListeners['tabRemoved']) => {
            listeners.tabRemoved = listener;
          },
        },
      },
      webNavigation: {
        onCommitted: {
          addListener: (listener: ChromeListeners['navigation']) => {
            listeners.navigation = listener;
          },
        },
      },
      scripting: { executeScript },
      storage: {
        session: {
          async set(values: Record<string, unknown>) {
            for (const [key, value] of Object.entries(values)) session.set(key, value);
          },
          async get(key: string) {
            return { [key]: session.get(key) };
          },
          async remove(key: string) {
            session.delete(key);
          },
        },
      },
    });

    await import('../../src/extension/background');
  });

  it('injects the runtime into all frames and the toolbar into the top frame', async () => {
    listeners.action?.({ id: 42 });

    await vi.waitFor(() => expect(executeScript).toHaveBeenCalledTimes(4));
    expect(executeScript).toHaveBeenNthCalledWith(2, {
      target: { tabId: 42, allFrames: true },
      files: ['runtime.js'],
      world: 'MAIN',
      injectImmediately: true,
    });
    expect(executeScript).toHaveBeenNthCalledWith(4, {
      target: { tabId: 42 },
      files: ['toolbar.js'],
      world: 'ISOLATED',
      injectImmediately: true,
    });
    expect(session.get('slowmo-active-tab:42')).toEqual(expect.any(String));
  });

  it('stops tracking the tab after toolbar close or navigation', async () => {
    listeners.action?.({ id: 42 });
    await vi.waitFor(() => {
      expect(session.get('slowmo-active-tab:42')).toEqual(expect.any(String));
    });
    const sessionToken = session.get('slowmo-active-tab:42');

    listeners.message?.(
      { type: 'slowmo-extension-session-ended-v1', sessionToken },
      { tab: { id: 42 } },
    );
    await vi.waitFor(() => expect(session.has('slowmo-active-tab:42')).toBe(false));

    listeners.action?.({ id: 42 });
    await vi.waitFor(() => {
      expect(session.get('slowmo-active-tab:42')).toEqual(expect.any(String));
    });
    listeners.navigation?.({ tabId: 42, frameId: 0 });
    await vi.waitFor(() => expect(session.has('slowmo-active-tab:42')).toBe(false));
  });

  it('injects the runtime into a new child frame only while the tab is active', async () => {
    listeners.action?.({ id: 42 });
    await vi.waitFor(() => {
      expect(session.get('slowmo-active-tab:42')).toEqual(expect.any(String));
    });
    executeScript.mockClear();

    listeners.navigation?.({ tabId: 42, frameId: 7 });

    await vi.waitFor(() => expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 42, frameIds: [7] },
      files: ['runtime.js'],
      world: 'MAIN',
      injectImmediately: true,
    }));
  });

  it('fans toolbar commands out to every frame without persisting speed', async () => {
    listeners.action?.({ id: 42 });
    await vi.waitFor(() => {
      expect(session.get('slowmo-active-tab:42')).toEqual(expect.any(String));
    });
    const sessionToken = session.get('slowmo-active-tab:42');
    executeScript.mockClear();

    listeners.message?.(
      {
        type: 'slowmo-extension-command-message-v1',
        command: 'set-speed',
        speed: 'infinity',
        sessionToken,
      },
      { tab: { id: 42 } },
    );

    await vi.waitFor(() => expect(executeScript).toHaveBeenCalled());
    expect(session.get('slowmo-active-tab:42')).toBe(sessionToken);
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 42, allFrames: true },
      world: 'MAIN',
      injectImmediately: true,
      func: expect.any(Function),
      args: ['set-speed', null, true, sessionToken],
    });
  });

  it('does not let stale close cleanup clear a newer activation', async () => {
    listeners.action?.({ id: 42 });
    await vi.waitFor(() => {
      expect(session.get('slowmo-active-tab:42')).toEqual(expect.any(String));
    });
    const firstToken = session.get('slowmo-active-tab:42') as string;
    let finishDeactivate!: () => void;
    const delayedDeactivate = new Promise<chrome.scripting.InjectionResult[]>(
      (resolve) => {
        finishDeactivate = () => resolve([]);
      },
    );
    executeScript.mockImplementation((details: { args?: unknown[] }) => (
      details.args?.[0] === 'deactivate'
        ? delayedDeactivate
        : Promise.resolve([])
    ));

    listeners.message?.(
      {
        type: 'slowmo-extension-session-ended-v1',
        sessionToken: firstToken,
      },
      { tab: { id: 42 } },
    );
    await vi.waitFor(() => {
      expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({
        args: ['deactivate', null, false, firstToken],
      }));
    });

    listeners.action?.({ id: 42 });
    await vi.waitFor(() => {
      expect(session.get('slowmo-active-tab:42')).not.toBe(firstToken);
    });
    const secondToken = session.get('slowmo-active-tab:42');
    finishDeactivate();
    await vi.waitFor(() => {
      expect(session.get('slowmo-active-tab:42')).toBe(secondToken);
    });
  });

  it('serializes rapid activations so one session cannot overwrite another', async () => {
    listeners.action?.({ id: 42 });
    listeners.action?.({ id: 42 });

    await vi.waitFor(() => expect(executeScript).toHaveBeenCalledTimes(8));

    const calls = executeScript.mock.calls.map(([details]) => details);
    const firstToken = calls[0].args[0] as string;
    const secondToken = calls[4].args[0] as string;

    expect(calls[1].files).toEqual(['runtime.js']);
    expect(calls[2].args).toEqual([firstToken]);
    expect(calls[3].files).toEqual(['toolbar.js']);
    expect(calls[5].files).toEqual(['runtime.js']);
    expect(calls[6].args).toEqual([secondToken]);
    expect(calls[7].files).toEqual(['toolbar.js']);
    expect(secondToken).not.toBe(firstToken);
    expect(session.get('slowmo-active-tab:42')).toBe(secondToken);
  });

  it('deactivates a partially injected runtime when toolbar injection fails', async () => {
    let rejectedToolbar = false;
    executeScript.mockImplementation((details: { files?: string[] }) => {
      if (details.files?.includes('toolbar.js') && !rejectedToolbar) {
        rejectedToolbar = true;
        return Promise.reject(new Error('Toolbar injection failed'));
      }
      return Promise.resolve([]);
    });
    const activate = (
      globalThis as typeof globalThis & {
        __slowmoActivateTabForTests: (tabId: number) => Promise<void>;
      }
    ).__slowmoActivateTabForTests;

    await activate(42);

    const activationToken = executeScript.mock.calls[0][0].args[0] as string;
    expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({
      target: { tabId: 42, allFrames: true },
      args: ['deactivate', null, false, activationToken],
    }));
    expect(session.has('slowmo-active-tab:42')).toBe(false);
  });

  it('invalidates an activation that overlaps a top-level navigation', async () => {
    let finishTokenInjection!: () => void;
    const delayedTokenInjection = new Promise<chrome.scripting.InjectionResult[]>(
      (resolve) => {
        finishTokenInjection = () => resolve([]);
      },
    );
    executeScript
      .mockImplementationOnce(() => delayedTokenInjection)
      .mockResolvedValue([]);

    listeners.action?.({ id: 42 });
    await vi.waitFor(() => expect(executeScript).toHaveBeenCalledTimes(1));
    listeners.navigation?.({ tabId: 42, frameId: 0 });
    finishTokenInjection();

    await vi.waitFor(() => {
      expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({
        args: expect.arrayContaining(['deactivate']),
      }));
    });
    expect(
      executeScript.mock.calls.some(
        ([details]) => details.files?.includes('toolbar.js'),
      ),
    ).toBe(false);
    expect(session.has('slowmo-active-tab:42')).toBe(false);
  });

  it('fully removes an older active session when reactivation fails', async () => {
    const activate = (
      globalThis as typeof globalThis & {
        __slowmoActivateTabForTests: (tabId: number) => Promise<void>;
      }
    ).__slowmoActivateTabForTests;
    await activate(42);
    expect(session.get('slowmo-active-tab:42')).toEqual(expect.any(String));

    executeScript.mockImplementation((details: { files?: string[] }) => {
      if (details.files?.includes('toolbar.js')) {
        return Promise.reject(new Error('Toolbar reinjection failed'));
      }
      return Promise.resolve([]);
    });
    await activate(42);

    expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({
      target: { tabId: 42 },
      world: 'ISOLATED',
      args: ['destroy-toolbar'],
    }));
    expect(session.has('slowmo-active-tab:42')).toBe(false);
  });

  it('ships as action-triggered with a remappable command', () => {
    const manifestPath = fileURLToPath(
      new URL('../../extension/manifest.json', import.meta.url),
    );
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.commands._execute_action.suggested_key).toEqual({
      default: 'Ctrl+Shift+S',
      mac: 'Command+Shift+S',
    });
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(['activeTab', 'scripting', 'storage', 'webNavigation']),
    );
  });
});
