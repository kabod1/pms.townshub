import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.png', 'favicon.jpg', 'logo-icon.jpg', 'logo.jpeg'],
      manifest: {
        name: 'Townshub PMS',
        short_name: 'Townshub',
        description: 'AI-powered Hotel Property Management System',
        theme_color: '#0F2138',
        background_color: '#F8F9FA',
        display: 'standalone',
        start_url: '/',
        orientation: 'any',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: '/favicon.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/favicon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      // injectManifest mode — workbox config is handled in src/sw.ts directly
      injectManifestConfig: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/logo-white.jpg', '**/logo.jpeg'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
