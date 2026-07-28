import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
  "img-src 'self' data: https://*.basemaps.cartocdn.com",
  "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
  "connect-src 'self' https: ws:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders = {
  'Content-Security-Policy': contentSecurityPolicy,
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
}

const developmentSecurityHeaders = {
  ...securityHeaders,
  'Content-Security-Policy': contentSecurityPolicy.replace(
    "script-src 'self'",
    "script-src 'self' 'unsafe-inline'",
  ),
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: developmentSecurityHeaders,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    headers: securityHeaders,
  },
})
