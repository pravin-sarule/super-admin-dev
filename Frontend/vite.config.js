import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      include: '**/*.{jsx,tsx,js,ts}', // Include .js files for JSX parsing
    }),
    tailwindcss()
  ],
  server: {
    port: 3001,
    proxy: {
      // Local backend default. Override with VITE_DEV_PROXY_TARGET if needed.
      '/api': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
