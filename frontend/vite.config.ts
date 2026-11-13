import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

const defaultApiProxyTarget = 'http://localhost:8080';
const apiProxyTarget = process.env.BOBBUY_API_PROXY_TARGET?.trim() || defaultApiProxyTarget;
const wsProxyTarget = process.env.BOBBUY_WS_PROXY_TARGET?.trim() || apiProxyTarget.replace(/^http/i, 'ws');

export default defineConfig({
  plugins: [react()],
  test: {
    // The SEO checks use Node's built-in test runner and have their own npm
    // script; do not make Vitest collect the similarly named file.
    exclude: [...configDefaults.exclude, 'scripts/**']
  },
  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (id.includes('/src/components/ChatWidget')) {
            return 'chat-flow';
          }
          if (id.includes('/src/components/ProcurementDashboard')) {
            return 'procurement-dashboard';
          }
          if (id.includes('/src/pages/StockMaster')) {
            return 'stock-master';
          }
          if (id.includes('/src/pages/ZenAuditView')) {
            return 'audit-view';
          }
          return undefined;
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
        headers: {
          'Origin': apiProxyTarget,
          'Referer': `${apiProxyTarget}/`
        }
      },
      '/ws': {
        target: wsProxyTarget,
        ws: true,
        changeOrigin: true
      }
    }
  }
});
