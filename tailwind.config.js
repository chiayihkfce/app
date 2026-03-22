/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'mystery-dark': '#1a1a2e',
        'mystery-accent': '#e94560',
      }
    },
  },
  plugins: [],
}
