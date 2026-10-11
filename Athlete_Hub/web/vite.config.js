import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The web app calls the API through this server (/api → the .NET API), so phones and tablets on
// the same Wi-Fi only need to reach one address, and the API itself never has to leave localhost.
const API_TARGET = process.env.ATHLETEHUB_API_URL || 'http://localhost:5007'
// xfwd passes each device's address on, so the API's per-device login limit still works.
const proxy = { '/api': { target: API_TARGET, changeOrigin: true, xfwd: true } }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy,
    // Allow HTTPS tunnel addresses used to install the app on phones (see docs/USER_TESTING_GUIDE.md).
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app'],
  },
  preview: {
    proxy,
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app'],
  },
  build: {
    // Use esbuild instead of rolldown to avoid JSX parsing bug
    target: 'esnext',
  },
  esbuild: {
    // Ensure JSX is handled by esbuild
    jsx: 'automatic',
  },
})
