import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tauri ожидает фиксированный порт и не должен терять вывод ошибок Rust
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: { target: 'es2021', minify: 'esbuild', sourcemap: false, outDir: 'dist' },
});
