import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Minimal config for Azure Static Web Apps
export default defineConfig({
  base: '/', // important: SWA get gives site from the root of the domain
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true
  }
})
