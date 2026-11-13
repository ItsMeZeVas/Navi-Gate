import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  // Docker Desktop en Windows puede no notificar a Vite los cambios del
  // volumen compartido. Polling mantiene HMR y la recarga de configuración.
  server: {
    watch: {
      usePolling: true,
      interval: 500,
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
