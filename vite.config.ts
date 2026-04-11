import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

const getGitHash = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
};

const getBuildTimestamp = () => {
  return new Date().toISOString();
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const netlifyFunctionsOrigin =
    env.VITE_DEV_NETLIFY_FUNCTIONS_ORIGIN || 'https://platscanner.martinhessmann.com';

  return {
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.4.2'),
    __GIT_HASH__: JSON.stringify(getGitHash()),
    __BUILD_TIMESTAMP__: JSON.stringify(getBuildTimestamp()),
    __DEV_MODE__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  worker: {
    format: 'es',
    plugins: () => [react()],
  },
  build: {
    rollupOptions: {
      output: {
        // Ensure worker files are properly handled
        manualChunks: undefined,
      },
    },
  },
  server: {
    proxy: {
      // Same-origin in dev: llmWhispererService uses `/.netlify/functions/llmwhisperer` when import.meta.env.DEV
      '/.netlify/functions/llmwhisperer': {
        target: netlifyFunctionsOrigin,
        changeOrigin: true,
        secure: true,
      },
      '/api/warframe-market': {
        target: 'https://api.warframe.market/v2',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/warframe-market/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Accept', 'application/json');
            proxyReq.setHeader('Content-Type', 'application/json');
            proxyReq.setHeader('Language', 'en');
            proxyReq.setHeader('Platform', 'pc');
            proxyReq.setHeader('User-Agent', 'PlatScanner/1.2.1');
          });
        },
      },
    },
  },
};
});
