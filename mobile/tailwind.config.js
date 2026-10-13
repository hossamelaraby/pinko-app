/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pinko: {
          navy: '#0f172a',
          plum: '#1e1b4b',
          accent: '#db2777', // Magenta/pink restrained accent
          success: '#059669',
          warning: '#d97706',
          danger: '#dc2626'
        }
      }
    },
  },
  plugins: [],
}
