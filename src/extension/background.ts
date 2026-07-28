import {
  COMMAND_MESSAGE,
  SESSION_ENDED_MESSAGE,
} from './protocol';

const SESSION_KEY_PREFIX = 'slowmo-active-tab:';
const activationQueues = new Map<number, Promise<void>>();
const navigationGenerations = new Map<number, number>();

type ExtensionRuntimeCommand =
  | { command: 'set-speed'; speed: number | 'infinity' }
  | { command: 'deactivate' };

function sessionKey(tabId: number): string {
  return `${SESSION_KEY_PREFIX}${tabId}`;
}

async function setTabSession(
  tabId: number,
  sessionToken: string | null,
): Promise<void> {
  const key = sessionKey(tabId);
  if (sessionToken) {
    await chrome.storage.session.set({ [key]: sessionToken });
  } else {
    await chrome.storage.session.remove(key);
  }
}

async function getTabSessionToken(tabId: number): Promise<string | null> {
  const key = sessionKey(tabId);
  const state = await chrome.storage.session.get(key);
  return typeof state[key] === 'string' ? state[key] : null;
}

async function clearTabSession(
  tabId: number,
  expectedToken?: string,
): Promise<void> {
  if (
    expectedToken
    && (await getTabSessionToken(tabId)) !== expectedToken
  ) {
    return;
  }
  await setTabSession(tabId, null);
}

async function injectSessionToken(
  tabId: number,
  sessionToken: string,
  world: 'MAIN' | 'ISOLATED',
  target: chrome.scripting.InjectionTarget = { tabId, allFrames: true },
): Promise<void> {
  await chrome.scripting.executeScript({
    target,
    world: world as chrome.scripting.ExecutionWorld,
    injectImmediately: true,
    func: (token: string) => {
      window.__slowmoExtensionSessionTokenV1 = token;
    },
    args: [sessionToken],
  });
}

async function injectRuntime(
  tabId: number,
  target: chrome.scripting.InjectionTarget = { tabId, allFrames: true },
): Promise<void> {
  await chrome.scripting.executeScript({
    target,
    files: ['runtime.js'],
    world: 'MAIN',
    injectImmediately: true,
  });
}

async function runRuntimeCommand(
  tabId: number,
  command: ExtensionRuntimeCommand,
  sessionToken: string,
  target: chrome.scripting.InjectionTarget = { tabId, allFrames: true },
): Promise<void> {
  const infinite =
    command.command === 'set-speed' && command.speed === 'infinity';
  const speed =
    command.command === 'set-speed' && typeof command.speed === 'number'
      ? command.speed
    : null;
  await chrome.scripting.executeScript({
    target,
    world: 'MAIN',
    injectImmediately: true,
    func: (
      commandName: ExtensionRuntimeCommand['command'],
      commandSpeed: number | null,
      isInfinite: boolean,
      expectedToken: string,
    ) => {
      const runtime = window.__slowmoExtensionRuntimeV1;
      if (!runtime || runtime.sessionToken !== expectedToken) return;
      if (commandName === 'deactivate') {
        runtime.deactivate();
      } else {
        runtime.setSpeed(
          isInfinite ? Number.POSITIVE_INFINITY : commandSpeed ?? 1,
        );
      }
    },
    args: [command.command, speed, infinite, sessionToken],
  });
}

async function deactivateAnyRuntime(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    world: 'MAIN',
    injectImmediately: true,
    func: () => {
      window.__slowmoExtensionRuntimeV1?.deactivate();
    },
  });
}

async function deactivateAnyToolbar(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'ISOLATED',
    injectImmediately: true,
    func: (_marker: 'destroy-toolbar') => {
      window.__slowmoExtensionToolbarHostV1?.destroy();
      delete window.__slowmoExtensionToolbarHostV1;
    },
    args: ['destroy-toolbar'],
  });
}

async function getTopFrameSpeed(
  tabId: number,
): Promise<number | 'infinity'> {
  const results = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    world: 'MAIN',
    injectImmediately: true,
    func: () => {
      const speed = window.__slowmoExtensionRuntimeV1?.controller.getSpeed() ?? 1;
      return Number.isFinite(speed) ? speed : 'infinity';
    },
  });
  const speed = results[0]?.result;
  return typeof speed === 'number' || speed === 'infinity' ? speed : 1;
}

function getNavigationGeneration(tabId: number): number {
  return navigationGenerations.get(tabId) ?? 0;
}

function assertCurrentDocument(tabId: number, generation: number): void {
  if (getNavigationGeneration(tabId) !== generation) {
    throw new Error('The tab navigated during Slowmo activation');
  }
}

async function performActivation(
  tabId: number,
  navigationGeneration: number,
): Promise<void> {
  const sessionToken = crypto.randomUUID();
  try {
    await injectSessionToken(tabId, sessionToken, 'MAIN');
    assertCurrentDocument(tabId, navigationGeneration);
    await injectRuntime(tabId);
    assertCurrentDocument(tabId, navigationGeneration);
    await setTabSession(tabId, sessionToken);
    assertCurrentDocument(tabId, navigationGeneration);
    await injectSessionToken(
      tabId,
      sessionToken,
      'ISOLATED',
      { tabId },
    );
    assertCurrentDocument(tabId, navigationGeneration);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['toolbar.js'],
      world: 'ISOLATED',
      injectImmediately: true,
    });
    assertCurrentDocument(tabId, navigationGeneration);
    await Promise.allSettled([
      chrome.action.setBadgeText({ tabId, text: '' }),
      chrome.action.setTitle({ tabId, title: 'Slowmo' }),
    ]);
  } catch {
    // Chrome blocks extension injection on internal pages and the Web Store.
    await Promise.allSettled([
      runRuntimeCommand(
        tabId,
        { command: 'deactivate' },
        sessionToken,
      ),
      // This task still owns the per-tab activation queue, so there cannot be
      // a newer Slowmo session to preserve. This also cleans a runtime that
      // landed after a navigation but before its token.
      deactivateAnyRuntime(tabId),
      deactivateAnyToolbar(tabId),
    ]);
    // Failed activation owns the per-tab queue, so no newer activation can
    // have installed state that must be preserved.
    await clearTabSession(tabId);
    await Promise.allSettled([
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#ef4444' }),
      chrome.action.setBadgeText({ tabId, text: '!' }),
      chrome.action.setTitle({
        tabId,
        title: 'Slowmo cannot run on this Chrome page',
      }),
    ]);
  }
}

function enqueueTabTask(
  tabId: number,
  task: () => Promise<void>,
): Promise<void> {
  const previousTask =
    activationQueues.get(tabId) ?? Promise.resolve();
  const queuedTask = previousTask
    .catch(() => undefined)
    .then(task);
  const trackedTask = queuedTask.finally(() => {
    if (activationQueues.get(tabId) === trackedTask) {
      activationQueues.delete(tabId);
    }
  });
  activationQueues.set(tabId, trackedTask);
  return trackedTask;
}

function activateTab(tabId: number): Promise<void> {
  return enqueueTabTask(tabId, () => performActivation(
    tabId,
    getNavigationGeneration(tabId),
  ));
}

// Kept inside the extension service worker (never exposed to web pages) so the
// release E2E suite can invoke the same action boundary as the toolbar icon.
const testableGlobal = globalThis as typeof globalThis & {
  __slowmoActivateTabForTests?: typeof activateTab;
  __slowmoCommandTabForTests?: (
    tabId: number,
    command: ExtensionRuntimeCommand,
  ) => Promise<void>;
};
testableGlobal.__slowmoActivateTabForTests = activateTab;
testableGlobal.__slowmoCommandTabForTests = async (tabId, command) => {
  const sessionToken = await getTabSessionToken(tabId);
  if (sessionToken) {
    await runRuntimeCommand(tabId, command, sessionToken);
  }
};

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) void activateTab(tab.id);
});

chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId = sender.tab?.id;
  const sessionToken =
    typeof message?.sessionToken === 'string' ? message.sessionToken : null;
  if (!tabId || !sessionToken) return;

  if (message?.type === SESSION_ENDED_MESSAGE) {
    void runRuntimeCommand(
      tabId,
      { command: 'deactivate' },
      sessionToken,
    )
      .catch(() => undefined)
      .finally(() => clearTabSession(tabId, sessionToken));
    return;
  }

  if (
    message?.type === COMMAND_MESSAGE
    && (
      message.command === 'deactivate'
      || (
        message.command === 'set-speed'
        && (
          typeof message.speed === 'number'
          || message.speed === 'infinity'
        )
      )
    )
  ) {
    const command: ExtensionRuntimeCommand = message.command === 'deactivate'
      ? { command: 'deactivate' }
      : { command: 'set-speed', speed: message.speed };
    void getTabSessionToken(tabId).then(async (activeToken) => {
      if (activeToken !== sessionToken) return;
      await runRuntimeCommand(tabId, command, sessionToken);
    }).catch(() => undefined);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  navigationGenerations.delete(tabId);
  void clearTabSession(tabId);
});

chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId === 0) {
    navigationGenerations.set(
      details.tabId,
      getNavigationGeneration(details.tabId) + 1,
    );
    await enqueueTabTask(details.tabId, async () => {
      await clearTabSession(details.tabId);
      await Promise.allSettled([
        chrome.action.setBadgeText({ tabId: details.tabId, text: '' }),
        chrome.action.setTitle({ tabId: details.tabId, title: 'Slowmo' }),
      ]);
    });
    return;
  }
  const sessionToken = await getTabSessionToken(details.tabId);
  if (!sessionToken) return;

  try {
    const target = {
      tabId: details.tabId,
      frameIds: [details.frameId],
    };
    await injectSessionToken(
      details.tabId,
      sessionToken,
      'MAIN',
      target,
    );
    await injectRuntime(details.tabId, target);
    const speed = await getTopFrameSpeed(details.tabId);
    await runRuntimeCommand(
      details.tabId,
      { command: 'set-speed', speed },
      sessionToken,
      target,
    );
  } catch {
    // A restricted or transient child frame may reject injection.
  }
});
