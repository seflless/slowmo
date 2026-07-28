import { createSlowmoToolbar } from 'slowmo/toolbar';

const toolbar = createSlowmoToolbar({
  defaultPlacement: 'bottom-left',
  shortcut: 'Mod+Shift+S',
});

document.querySelector('[data-show-slowmo]').addEventListener('click', () => {
  toolbar.open();
});

window.addEventListener('pagehide', () => toolbar.destroy(), { once: true });
