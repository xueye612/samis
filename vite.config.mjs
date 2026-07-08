import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api-samis': {
        // 本地联调：指向 index 后端（DB 同机 192.168.10.178:2881）。
        // 回滚：改回 'http://47.105.38.226:8022'（远程 Apifox）。
        target: 'http://192.168.10.178:8022',
        changeOrigin: true,
      },
    },
  },
});
