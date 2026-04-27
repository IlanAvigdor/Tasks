import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // github pages usually needs a base path if it's not a custom domain
  // base: '/Tasks/', 
});
