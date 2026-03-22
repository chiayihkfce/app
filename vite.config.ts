import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@theme/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 確保在 GitHub Pages 下路徑正確
})
