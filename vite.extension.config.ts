import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isToolbar = mode === 'toolbar';
  const isBackground = mode === 'background';
  const entry = isToolbar
    ? 'src/extension/toolbar-host.ts'
    : isBackground
      ? 'src/extension/background.ts'
      : 'src/extension/content.ts';
  const outputName = isToolbar
    ? 'toolbar'
    : isBackground
      ? 'background'
      : 'runtime';
  return {
    build: {
      lib: {
        entry: resolve(__dirname, entry),
        name: `slowmoExtension${outputName}`,
        formats: ['iife'],
        fileName: () => `${outputName}.js`,
      },
      outDir: 'extension',
      emptyOutDir: false,
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
      minify: false,
    },
  };
});
