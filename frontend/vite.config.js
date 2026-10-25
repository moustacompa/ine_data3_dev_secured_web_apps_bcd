
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuration du serveur de développement Vite
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Aligné avec CLIENT_URL=http://localhost:3000 configuré dans le backend
    open: true,
  },
});