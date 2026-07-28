import { useSlowmo } from 'slowmo/react';

export function PlaybackControls() {
  const { speed, paused, setSpeed, pause, play, reset } = useSlowmo();

  return (
    <div aria-label="Playback speed controls">
      <output>{paused ? 'Paused' : `${speed}×`}</output>
      <button type="button" onClick={() => setSpeed(0.5)}>Slow down</button>
      <button type="button" onClick={paused ? play : pause}>
        {paused ? 'Play' : 'Pause'}
      </button>
      <button type="button" onClick={reset}>Reset</button>
    </div>
  );
}
