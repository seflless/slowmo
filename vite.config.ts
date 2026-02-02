import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*'],
      outDir: 'dist',
    }),
  ],
  build: {
    lib: {
      entry: {
        slowmo: resolve(__dirname, 'src/index.ts'),
        recreate: resolve(__dirname, 'src/recreate.ts'),
        'cli/recreate': resolve(__dirname, 'src/cli/recreate.ts'),
      },
      name: 'slowmo',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        'gsap',
        'fs',
        'path',
        'node:fs',
        'node:path',
        'node:os',
        'node:child_process',
      ],
      output: {
        globals: {
          gsap: 'gsap',
        },
      },
    },
  },
});
