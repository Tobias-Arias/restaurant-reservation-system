import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Configuración de Vite.
 *
 * - Puerto 5173, que es el que acepta el CORS del backend.
 * - Modo "development" de React Router: las rutas como /admin/mesas se
 *   sirven correctamente al recargar la página en desarrollo.
 * - `preview` en 4173, también incluido en CORS_ORIGIN.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    open: false,
  },
  preview: {
    port: 4173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
