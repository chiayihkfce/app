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
        // 新增提供的顏色規範
        pwGray1: 'var(--pwGray1)',
        pwGray2: 'var(--pwGray2)',
        pwGray3: 'var(--pwGray3)',
        pwGray4: 'var(--pwGray4)',
        pwGray5: 'var(--pwGray5)',
        pwGray6: 'var(--pwGray6)',
        pwGray7: 'var(--pwGray7)',
        pwBlue: 'var(--pwBlue)',
        pwYellow: 'var(--pwYellow)',
        pwDeepYellow: 'var(--pwDeepYellow)',
        pwOrange: 'var(--pwOrange)',
        pwGreen: 'var(--pwGreen)',
        pwRed: 'var(--pwRed)',
        pwRedHalf: 'var(--pwRedHalf)',
      },
      spacing: {
        'header': 'var(--h-header)',
        'header-mobile': 'var(--h-header-mobile)',
      }
    },
  },
  plugins: [],
}
