const TRIGGER_EVENT = 'slowmo-extension-trigger';

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: (eventName) => {
        window.dispatchEvent(new CustomEvent(eventName));
      },
      args: [TRIGGER_EVENT],
    });
  } catch {
    // Chrome blocks injection on internal pages and the Web Store.
  }
});
