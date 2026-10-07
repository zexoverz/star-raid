import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  // In dev, share cards come from `pnpm start` (server/index.mjs) on :8080.
  server: { proxy: { '/og': 'http://127.0.0.1:8080', '/star': 'http://127.0.0.1:8080' } },
})
