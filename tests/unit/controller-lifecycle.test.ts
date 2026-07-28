// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

describe('headless controller lifecycle', () => {
  afterEach(async () => {
    const { slowmo } = await import('../../src/index');
    slowmo.destroy();
    vi.resetModules();
  });

  it('does not patch browser timing APIs merely by being imported', async () => {
    const nativeRAF = window.requestAnimationFrame;
    const nativePerformanceNow = performance.now;
    const nativeDateNow = Date.now;
    const nativeSetTimeout = window.setTimeout;
    const nativeSetInterval = window.setInterval;

    await import('../../src/index');

    expect(window.requestAnimationFrame).toBe(nativeRAF);
    expect(performance.now).toBe(nativePerformanceNow);
    expect(Date.now).toBe(nativeDateNow);
    expect(window.setTimeout).toBe(nativeSetTimeout);
    expect(window.setInterval).toBe(nativeSetInterval);
  });

  it('restores exact browser timing functions when its last owner is destroyed', async () => {
    const nativeRAF = window.requestAnimationFrame;
    const nativePerformanceNow = performance.now;
    const nativeDateNow = Date.now;
    const nativeSetTimeout = window.setTimeout;
    const nativeSetInterval = window.setInterval;
    const { createSlowmoController } = await import('../../src/index');
    const controller = createSlowmoController();

    controller.setSpeed(0.5);

    expect(controller.getSnapshot()).toEqual({
      status: 'active',
      speed: 0.5,
      paused: false,
    });
    expect(window.requestAnimationFrame).not.toBe(nativeRAF);
    expect(performance.now).not.toBe(nativePerformanceNow);
    expect(Date.now).not.toBe(nativeDateNow);
    expect(window.setTimeout).not.toBe(nativeSetTimeout);
    expect(window.setInterval).not.toBe(nativeSetInterval);

    controller.destroy();

    expect(controller.getSnapshot()).toEqual({
      status: 'inactive',
      speed: 1,
      paused: false,
    });
    expect(window.requestAnimationFrame).toBe(nativeRAF);
    expect(performance.now).toBe(nativePerformanceNow);
    expect(Date.now).toBe(nativeDateNow);
    expect(window.setTimeout).toBe(nativeSetTimeout);
    expect(window.setInterval).toBe(nativeSetInterval);
  });

  it('keeps shared timing active until every controller releases its ownership', async () => {
    const nativeRAF = window.requestAnimationFrame;
    const { createSlowmoController } = await import('../../src/index');
    const first = createSlowmoController();
    const second = createSlowmoController();

    first.setSpeed(0.5);
    second.activate();
    first.destroy();

    expect(window.requestAnimationFrame).not.toBe(nativeRAF);
    expect(second.getSnapshot().status).toBe('active');

    second.destroy();
    expect(window.requestAnimationFrame).toBe(nativeRAF);
  });

  it('restores the previous owner speed when an overlapping session closes', async () => {
    const { createSlowmoController } = await import('../../src/index');
    const embedded = createSlowmoController();
    const extension = createSlowmoController();

    try {
      embedded.setSpeed(0.5);
      extension.setSpeed(8);
      expect(embedded.getSpeed()).toBe(8);

      extension.destroy();
      expect(embedded.getSpeed()).toBe(0.5);
    } finally {
      extension.destroy();
      embedded.destroy();
    }
  });

  it('notifies subscribers through the public snapshot interface', async () => {
    const { createSlowmoController } = await import('../../src/index');
    const controller = createSlowmoController();
    const snapshots: Array<{ status: string; speed: number; paused: boolean }> = [];
    const unsubscribe = controller.subscribe((snapshot) => snapshots.push(snapshot));

    controller.setSpeed(2);
    controller.pause();
    controller.play();
    controller.destroy();
    unsubscribe();

    expect(snapshots).toEqual([
      { status: 'inactive', speed: 1, paused: false },
      { status: 'active', speed: 1, paused: false },
      { status: 'active', speed: 2, paused: false },
      { status: 'active', speed: 0, paused: true },
      { status: 'active', speed: 2, paused: false },
      { status: 'inactive', speed: 1, paused: false },
    ]);
  });
});
