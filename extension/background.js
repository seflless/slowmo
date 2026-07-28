(function() {
  "use strict";
  const COMMAND_MESSAGE = "slowmo-extension-command-message-v1";
  const SESSION_ENDED_MESSAGE = "slowmo-extension-session-ended-v1";
  const SESSION_KEY_PREFIX = "slowmo-active-tab:";
  const activationQueues = /* @__PURE__ */ new Map();
  const navigationGenerations = /* @__PURE__ */ new Map();
  function sessionKey(tabId) {
    return `${SESSION_KEY_PREFIX}${tabId}`;
  }
  async function setTabSession(tabId, sessionToken) {
    const key = sessionKey(tabId);
    if (sessionToken) {
      await chrome.storage.session.set({ [key]: sessionToken });
    } else {
      await chrome.storage.session.remove(key);
    }
  }
  async function getTabSessionToken(tabId) {
    const key = sessionKey(tabId);
    const state = await chrome.storage.session.get(key);
    return typeof state[key] === "string" ? state[key] : null;
  }
  async function clearTabSession(tabId, expectedToken) {
    if (expectedToken && await getTabSessionToken(tabId) !== expectedToken) {
      return;
    }
    await setTabSession(tabId, null);
  }
  async function injectSessionToken(tabId, sessionToken, world, target = { tabId, allFrames: true }) {
    await chrome.scripting.executeScript({
      target,
      world,
      injectImmediately: true,
      func: (token) => {
        window.__slowmoExtensionSessionTokenV1 = token;
      },
      args: [sessionToken]
    });
  }
  async function injectRuntime(tabId, target = { tabId, allFrames: true }) {
    await chrome.scripting.executeScript({
      target,
      files: ["runtime.js"],
      world: "MAIN",
      injectImmediately: true
    });
  }
  async function runRuntimeCommand(tabId, command, sessionToken, target = { tabId, allFrames: true }) {
    const infinite = command.command === "set-speed" && command.speed === "infinity";
    const speed = command.command === "set-speed" && typeof command.speed === "number" ? command.speed : null;
    await chrome.scripting.executeScript({
      target,
      world: "MAIN",
      injectImmediately: true,
      func: (commandName, commandSpeed, isInfinite, expectedToken) => {
        const runtime = window.__slowmoExtensionRuntimeV1;
        if (!runtime || runtime.sessionToken !== expectedToken) return;
        if (commandName === "deactivate") {
          runtime.deactivate();
        } else {
          runtime.setSpeed(
            isInfinite ? Number.POSITIVE_INFINITY : commandSpeed ?? 1
          );
        }
      },
      args: [command.command, speed, infinite, sessionToken]
    });
  }
  async function deactivateAnyRuntime(tabId) {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: "MAIN",
      injectImmediately: true,
      func: () => {
        var _a;
        (_a = window.__slowmoExtensionRuntimeV1) == null ? void 0 : _a.deactivate();
      }
    });
  }
  async function deactivateAnyToolbar(tabId) {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "ISOLATED",
      injectImmediately: true,
      func: (_marker) => {
        var _a;
        (_a = window.__slowmoExtensionToolbarHostV1) == null ? void 0 : _a.destroy();
        delete window.__slowmoExtensionToolbarHostV1;
      },
      args: ["destroy-toolbar"]
    });
  }
  async function getTopFrameSpeed(tabId) {
    var _a;
    const results = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      world: "MAIN",
      injectImmediately: true,
      func: () => {
        var _a2;
        const speed2 = ((_a2 = window.__slowmoExtensionRuntimeV1) == null ? void 0 : _a2.controller.getSpeed()) ?? 1;
        return Number.isFinite(speed2) ? speed2 : "infinity";
      }
    });
    const speed = (_a = results[0]) == null ? void 0 : _a.result;
    return typeof speed === "number" || speed === "infinity" ? speed : 1;
  }
  function getNavigationGeneration(tabId) {
    return navigationGenerations.get(tabId) ?? 0;
  }
  function assertCurrentDocument(tabId, generation) {
    if (getNavigationGeneration(tabId) !== generation) {
      throw new Error("The tab navigated during Slowmo activation");
    }
  }
  async function performActivation(tabId, navigationGeneration) {
    const sessionToken = crypto.randomUUID();
    try {
      await injectSessionToken(tabId, sessionToken, "MAIN");
      assertCurrentDocument(tabId, navigationGeneration);
      await injectRuntime(tabId);
      assertCurrentDocument(tabId, navigationGeneration);
      await setTabSession(tabId, sessionToken);
      assertCurrentDocument(tabId, navigationGeneration);
      await injectSessionToken(
        tabId,
        sessionToken,
        "ISOLATED",
        { tabId }
      );
      assertCurrentDocument(tabId, navigationGeneration);
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["toolbar.js"],
        world: "ISOLATED",
        injectImmediately: true
      });
      assertCurrentDocument(tabId, navigationGeneration);
      await Promise.allSettled([
        chrome.action.setBadgeText({ tabId, text: "" }),
        chrome.action.setTitle({ tabId, title: "Slowmo" })
      ]);
    } catch {
      await Promise.allSettled([
        runRuntimeCommand(
          tabId,
          { command: "deactivate" },
          sessionToken
        ),
        // This task still owns the per-tab activation queue, so there cannot be
        // a newer Slowmo session to preserve. This also cleans a runtime that
        // landed after a navigation but before its token.
        deactivateAnyRuntime(tabId),
        deactivateAnyToolbar(tabId)
      ]);
      await clearTabSession(tabId);
      await Promise.allSettled([
        chrome.action.setBadgeBackgroundColor({ tabId, color: "#ef4444" }),
        chrome.action.setBadgeText({ tabId, text: "!" }),
        chrome.action.setTitle({
          tabId,
          title: "Slowmo cannot run on this Chrome page"
        })
      ]);
    }
  }
  function enqueueTabTask(tabId, task) {
    const previousTask = activationQueues.get(tabId) ?? Promise.resolve();
    const queuedTask = previousTask.catch(() => void 0).then(task);
    const trackedTask = queuedTask.finally(() => {
      if (activationQueues.get(tabId) === trackedTask) {
        activationQueues.delete(tabId);
      }
    });
    activationQueues.set(tabId, trackedTask);
    return trackedTask;
  }
  function activateTab(tabId) {
    return enqueueTabTask(tabId, () => performActivation(
      tabId,
      getNavigationGeneration(tabId)
    ));
  }
  const testableGlobal = globalThis;
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
    var _a;
    const tabId = (_a = sender.tab) == null ? void 0 : _a.id;
    const sessionToken = typeof (message == null ? void 0 : message.sessionToken) === "string" ? message.sessionToken : null;
    if (!tabId || !sessionToken) return;
    if ((message == null ? void 0 : message.type) === SESSION_ENDED_MESSAGE) {
      void runRuntimeCommand(
        tabId,
        { command: "deactivate" },
        sessionToken
      ).catch(() => void 0).finally(() => clearTabSession(tabId, sessionToken));
      return;
    }
    if ((message == null ? void 0 : message.type) === COMMAND_MESSAGE && (message.command === "deactivate" || message.command === "set-speed" && (typeof message.speed === "number" || message.speed === "infinity"))) {
      const command = message.command === "deactivate" ? { command: "deactivate" } : { command: "set-speed", speed: message.speed };
      void getTabSessionToken(tabId).then(async (activeToken) => {
        if (activeToken !== sessionToken) return;
        await runRuntimeCommand(tabId, command, sessionToken);
      }).catch(() => void 0);
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
        getNavigationGeneration(details.tabId) + 1
      );
      await enqueueTabTask(details.tabId, async () => {
        await clearTabSession(details.tabId);
        await Promise.allSettled([
          chrome.action.setBadgeText({ tabId: details.tabId, text: "" }),
          chrome.action.setTitle({ tabId: details.tabId, title: "Slowmo" })
        ]);
      });
      return;
    }
    const sessionToken = await getTabSessionToken(details.tabId);
    if (!sessionToken) return;
    try {
      const target = {
        tabId: details.tabId,
        frameIds: [details.frameId]
      };
      await injectSessionToken(
        details.tabId,
        sessionToken,
        "MAIN",
        target
      );
      await injectRuntime(details.tabId, target);
      const speed = await getTopFrameSpeed(details.tabId);
      await runRuntimeCommand(
        details.tabId,
        { command: "set-speed", speed },
        sessionToken,
        target
      );
    } catch {
    }
  });
})();
