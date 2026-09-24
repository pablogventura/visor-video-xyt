import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Production builds target GitHub Pages: https://<user>.github.io/visor-video-xyt/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/visor-video-xyt/' : '/',
}));
