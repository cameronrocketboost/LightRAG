import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import { webuiPrefix } from './src/lib/constants'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables based on the mode (development, production)
  // Load all env variables (prefixed and non-prefixed)
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    // Remove the base path setting, default to '/'
    // base: webuiPrefix,
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          // Manual chunking strategy
          manualChunks: {
            // Group React-related libraries into one chunk
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            // Group graph visualization libraries into one chunk
            'graph-vendor': ['sigma', 'graphology', '@react-sigma/core'],
            // Group UI component libraries into one chunk
            'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-popover', '@radix-ui/react-select', '@radix-ui/react-tabs'],
            // Group utility libraries into one chunk
            'utils-vendor': ['axios', 'i18next', 'zustand', 'clsx', 'tailwind-merge'],
            // Separate feature modules
            'feature-graph': ['./src/features/GraphViewer'],
            'feature-documents': ['./src/features/DocumentManager'],
            'feature-chat': ['./src/features/ChatView'],

            // Mermaid-related modules
            'mermaid-vendor': ['mermaid'],

            // Markdown-related modules
            'markdown-vendor': [
              'react-markdown',
              'rehype-react',
              'remark-gfm',
              'remark-math',
              'react-syntax-highlighter'
            ]
          },
          // Ensure consistent chunk naming format
          chunkFileNames: 'assets/[name]-[hash].js',
          // Entry file naming format
          entryFileNames: 'assets/[name]-[hash].js',
          // Asset file naming format
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      }
    },
    server: {
      // Use the loaded env variables instead of import.meta.env
      proxy: env.VITE_API_PROXY === 'true' && env.VITE_API_ENDPOINTS ?
        Object.fromEntries(
          env.VITE_API_ENDPOINTS.split(',').map(endpoint => [
            endpoint,
            {
              target: env.VITE_BACKEND_URL || 'http://localhost:9621',
              changeOrigin: true,
              rewrite: endpoint === '/api' ?
                (path) => path.replace(/^\/api/, '') :
                endpoint === '/docs' || endpoint === '/openapi.json' ?
                  (path) => path : undefined
            }
          ])
        ) : {}
    }
  }
})
