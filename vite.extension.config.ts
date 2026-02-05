import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/extension/content.ts'),
      name: 'slowmoExtension',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    outDir: 'extension',
    emptyOutDir: false,  // Don't delete manifest.json, icons, etc.
    rollupOptions: {
      output: {
        // No external dependencies - bundle everything
        inlineDynamicImports: true,
      },
    },
    minify: false,  // Keep readable for debugging
  },
});
