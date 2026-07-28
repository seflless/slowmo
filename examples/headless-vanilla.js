import { createSlowmoController } from 'slowmo';

const slowmo = createSlowmoController();

document.querySelector('[data-speed="half"]').addEventListener('click', () => {
  slowmo.setSpeed(0.5);
});
document.querySelector('[data-action="pause"]').addEventListener('click', () => {
  slowmo.pause();
});
document.querySelector('[data-action="reset"]').addEventListener('click', () => {
  slowmo.reset();
});

window.addEventListener('pagehide', () => slowmo.destroy(), { once: true });
