import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Plugin to handle SPA routing for OAuth callbacks
function spaFallback(): Plugin {
  return {
    name: 'spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        // Redirect OAuth callback routes to index.html
        if (req.url?.startsWith('/auth/')) {
          req.url = '/index.html';
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [spaFallback(), react(), tailwindcss()],
  define: {
    'global': 'globalThis',
  },
  resolve: {
    alias: {
      'buffer': 'buffer/',
    },
  },
  optimizeDeps: {
    include: ['buffer'],
  },
})
