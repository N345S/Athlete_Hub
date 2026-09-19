import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Use esbuild instead of rolldown to avoid JSX parsing bug
    target: 'esnext',
  },
  esbuild: {
    // Ensure JSX is handled by esbuild
    jsx: 'automatic',
  },
})
