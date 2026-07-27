/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          300: 'rgb(var(--accent-primary) / 0.5)',
          400: 'rgb(var(--accent-primary) / 0.7)',
          500: 'rgb(var(--accent-primary))',
          600: 'rgb(var(--accent-primary) / 0.9)',
          900: 'rgb(var(--accent-primary) / 0.3)',
        }
      }
    },
  },
  plugins: [],
}
