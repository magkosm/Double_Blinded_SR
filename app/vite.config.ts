import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/Double_Blinded_SR/',
  build: {
    outDir: 'dist',
  },
});
