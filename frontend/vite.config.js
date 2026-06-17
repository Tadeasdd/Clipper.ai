import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Backend origin for the dev proxy. Defaults to localhost:8080 (native dev,
// unchanged); the docker stack sets BACKEND_ORIGIN=http://backend:8080 so the
// frontend container reaches the backend service over the compose network.
const backendOrigin = process.env.BACKEND_ORIGIN || 'http://localhost:8080';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Proxy API calls to the backend in local dev (Stage F4+).
    proxy: {
      '/api': { target: backendOrigin, changeOrigin: true },
    },
  },
});
