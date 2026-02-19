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
      '/api': {
        target: 'https://super-admin-backend-120280829617.asia-south1.run.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
})
