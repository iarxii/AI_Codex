import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'codex_spaces': path.resolve(__dirname, '../codex_spaces'),
    },
  },
  server: {
    port: 9173,
    strictPort: true,
  }
})
