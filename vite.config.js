import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  // Mesmo host que o Electron usa em main.cjs (evita tela preta por IPv6 / localhost no Windows)
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
