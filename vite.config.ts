import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Everything (JS, CSS, the Mediabunny encoder library) is inlined into a single
// HTML file so the app works offline, opened straight from disk.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      input: 'flipbook.html',
    },
  },
});
