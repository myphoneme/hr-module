import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function spaFallback(basePath: string): Plugin {
  return {
    name: 'spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const authPrefixes = basePath === '/' ? ['/auth/'] : ['/auth/', `${basePath}auth/`]
        if (authPrefixes.some(prefix => req.url?.startsWith(prefix))) {
          req.url = '/index.html'
        }
        next()
      })
    },
  }
}

const normalizeBasePath = (value: string | undefined) => {
  if (!value) return '/'
  let basePath = value.trim()
  if (!basePath.startsWith('/')) basePath = `/${basePath}`
  if (!basePath.endsWith('/')) basePath = `${basePath}/`
  return basePath
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const basePath = normalizeBasePath(env.VITE_BASE_PATH)

  return {
    base: basePath,
    plugins: [spaFallback(basePath), react(), tailwindcss()],
    define: {
      global: 'globalThis',
    },
    resolve: {
      alias: {
        buffer: 'buffer/',
      },
    },
    optimizeDeps: {
      include: ['buffer'],
    },
  }
})
