import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/');

          if (normalizedId.includes('/node_modules/react')) {
            return 'react-vendor';
          }

          if (normalizedId.includes('/node_modules/@noble/hashes')) {
            return 'hashing';
          }

          if (
            normalizedId.includes('/node_modules/@firebase') ||
            normalizedId.includes('/node_modules/firebase')
          ) {
            return 'firebase-vendor';
          }

          return undefined;
        },
      },
    },
  },
  plugins: [react()],
});
