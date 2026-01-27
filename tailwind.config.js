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
          50: '#FEF7F3',
          100: '#FDE8DC',
          200: '#FBD0B9',
          300: '#F8B896',
          400: '#F3A578',
          500: '#EE955B',
          600: '#D97B3F',
          700: '#B86230',
          800: '#944D26',
          900: '#7A3F20',
        },
        secondary: {
          50: '#F6F6F6',
          100: '#E7E7E7',
          200: '#D1D1D1',
          300: '#B0B0B0',
          400: '#888888',
          500: '#5E5E5E',
          600: '#4F4F4F',
          700: '#3D3D3D',
          800: '#2D2D2D',
          900: '#1A1A1A',
        },
      },
    },
  },
  plugins: [],
}
