import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'CHAT_LAB_');
  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: Number(env.CHAT_LAB_WEB_PORT || 4317),
      strictPort: true,
      proxy: {
        '/api': `http://127.0.0.1:${env.CHAT_LAB_API_PORT || 4318}`,
      },
    },
  };
});
