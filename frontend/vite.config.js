import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ command, mode }) => {
  const plugins = [react(), tailwindcss()]
  const { VITE_API_BASE_URL } = loadEnv(mode, process.cwd())

  if (command === 'build' && process.env.VERCEL === '1') {
    const url = URL.canParse(VITE_API_BASE_URL) && new URL(VITE_API_BASE_URL)
    if (!url || url.protocol !== 'https:' || url.username || url.password ||
        url.search || url.hash || !['/api', '/api/'].includes(url.pathname) ||
        /(^localhost$|\.localhost$|^127\.|^0\.0\.0\.0$|^\[::1\]$)/i.test(url.hostname)) {
      throw new Error('Set VITE_API_BASE_URL in Vercel to the public HTTPS backend URL ending in /api.')
    }
  }
  if (command !== 'serve') return { plugins }

  const api = new URL(VITE_API_BASE_URL || 'http://localhost:5000/api')

  return {
    plugins,
    server: {
      proxy: {
        '/api': {
          target: api.origin,
          changeOrigin: true,
          // The browser already sent this request to the Vite origin.
          configure(proxy) {
            proxy.on('proxyReq', (request) => request.removeHeader('origin'))
          },
          rewrite: (path) => path.replace(/^\/api(?=\/|\?|$)/, api.pathname.replace(/\/$/, '')),
        },
      },
    },
  }
})
