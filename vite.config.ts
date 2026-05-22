import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'md-utf8',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/references/') && req.url.endsWith('.md')) {
            res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
          }
          next();
        });
      },
    },
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:4174',
    },
  },
});
