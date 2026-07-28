// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Chrome extension main-world runtime', () => {
  afterEach(() => {
    window.__slowmoExtensionRuntimeV1?.deactivate();
    delete window.__slowmoExtensionRuntimeV1;
    delete window.__slowmoExtensionSessionTokenV1;
    vi.resetModules();
  });

  it('stays inert when runtime injection lands without a session token', async () => {
    delete window.__slowmoExtensionSessionTokenV1;

    await import('../../src/extension/content');

    expect(window.__slowmoExtensionRuntimeV1).toBeUndefined();
  });
});
