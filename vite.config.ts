/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the app from /KalitateLab/ (repository name, case-sensitive).
export default defineConfig({
  base: '/KalitateLab/',
  plugins: [react()],
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
