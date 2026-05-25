import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, '../..'),
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setupTests.js',
    globals: true
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false, // Позволяет автоматически переключиться на следующий доступный порт
    // HMR автоматически использует тот же порт что и основной сервер
    // Не указываем hmr.port явно, чтобы избежать конфликтов при автоматическом переключении порта
    watch: {
      usePolling: false
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3100', // IPv4, чтобы не падать на ECONNREFUSED ::1 (IPv6)
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('⚠️  Proxy error:', err.message);
            console.error('💡 Убедитесь, что бэкенд запущен на порту 3100');
          });
        }
      },
      '/assets': {
        target: 'http://127.0.0.1:3100',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: '../../public/react',
    emptyOutDir: true
  }
});

