# Contributing to slowmo

Thanks for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/seflless/slowmo.git
cd slowmo
bun install
bun run dev
```

## Testing the Chrome Extension

1. Build generated runtime and toolbar bundles:

   ```bash
   bun run build:ext
   ```

2. Open `chrome://extensions`, enable Developer mode, and choose **Load
   unpacked**.
3. Select the `extension/` directory.
4. Visit a normal page. Confirm Slowmo is absent and native timing is unchanged.
5. Click the extension icon or use its assigned shortcut.
6. Test scrubbing, pause, dragging/docking, Close, clean 1× reopening, and an
   inactive reload.

After source changes, rebuild and click Reload on the extension card.

Run the automated real-browser lifecycle suite with:

```bash
bun run test:e2e:extension
```

## Project Structure

```
slowmo/
├── src/
│   ├── index.ts        # Core slowmo API
│   ├── dial.ts         # Dial component internals
│   ├── dial-api.ts     # Dial public API (setupDial/shutdownDial)
│   ├── toolbar.ts      # Canonical toolbar host API
│   ├── react.tsx       # React <Slowmo /> component
│   ├── extension/      # Extension runtime, toolbar host, worker, and protocol
│   ├── recreate.ts     # AI animation recreation
│   └── cli/            # CLI tools
├── demo/               # Demo website
├── extension/          # Chrome extension
├── tests/
│   ├── unit/           # Vitest unit tests
│   └── e2e/            # Playwright E2E tests
└── specs/              # Feature specifications
```

## Running Tests

```bash
bun run test:unit
bun run test:e2e
bun run test:e2e:extension
bun run typecheck
```

## Code Style

- TypeScript for the library
- Framework-independent core and toolbar; React remains an optional entry point
- Extension source is TypeScript and generated bundles are committed for upload
- Keep bundle size minimal

## Pull Requests

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a PR

For major changes, please open an issue first to discuss.
