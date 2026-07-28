# Releasing Slowmo

The npm package, website, and Chrome extension have independent versions and
release channels. Build and inspect the exact artifacts that will be published.

## Release gate

```bash
bun run typecheck
bun run test:unit
bun run test:e2e
bun run test:e2e:extension
bun run build
bun run build:demo
bun run build:ext
npm pack --dry-run
bun run zip:extension
```

Also verify:

- The generated root and toolbar bundles do not import React.
- The generated React bundle treats React as external.
- `manifest.json`, `runtime.js`, and `toolbar.js` are at the ZIP root.
- The packaged npm declarations include controller, toolbar, and hook APIs.
- The landing-page section links work when loaded directly by hash.

## npm

This release is additive if compatibility aliases remain, so use a minor
version:

```bash
npm version minor
npm publish
git push --follow-tags
```

Before publishing, inspect `npm pack --dry-run` and install the generated
tarball into a clean smoke app. The `prepublishOnly` script rebuilds the
package, but it does not replace the release gate.

Longer term, publish from CI with npm trusted publishing and provenance.

## Website

Deploy the built `dist-demo/` output after the package API and documentation are
final. Smoke-test:

- Direct links to `#try-it`, `#headless`, and `#react-component`
- Anchored toolbar, drag detachment, close, and shortcut reopen
- Local video loop and Motion hover demo
- Light/dark toolbar appearance

## Chrome Web Store

1. Increase `extension/manifest.json` to a version higher than the currently
   published extension.
2. Run the full gate and `bun run zip:extension`.
3. Inspect the ZIP; the manifest must be at its root.
4. Load that exact extension build unpacked in a clean Chrome profile.
5. Upload the complete ZIP to the existing Web Store item.
6. Update listing and privacy copy to describe action-triggered activation,
   frame injection, and placement/orientation storage.
7. Submit for review. Use deferred publishing if coordinating a launch.

The npm `package.json` version does not need to match the extension manifest
version.

## Manual extension matrix

- Already-open tab after extension reload
- Close at slow, fast, paused, and infinity presets
- Re-trigger starts at 1×
- Reload and navigation remain inactive
- Two tabs remain independent
- Same-origin, cross-origin, nested, and dynamic iframes
- Strict Trusted Types page
- Page-level scrollbar and all viewport edges
- Light and dark system appearance
- Restricted Chrome pages stay inactive and show the unavailable badge
