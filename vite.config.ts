import { defineConfig } from 'vite';
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
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.4.2'),
    __GIT_HASH__: JSON.stringify(getGitHash()),
    __BUILD_TIMESTAMP__: JSON.stringify(getBuildTimestamp()),
    __DEV_MODE__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },
  optimizeDeps: {
    exclude: ['lucide-react', 'tesseract.js'],
  },
  worker: {
    format: 'es',
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://api.warframe.market',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Accept', 'application/json');
            proxyReq.setHeader('Content-Type', 'application/json');
            proxyReq.setHeader('Language', 'en');
            proxyReq.setHeader('Platform', 'pc');
          });
        },
      },
    },
  },
});