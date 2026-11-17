/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: { colors: { ink: '#15231f', muted: '#718079', brand: '#176b54', lime: '#d9f37a', canvas: '#f5f7f3' }, boxShadow: { soft: '0 8px 30px rgba(27,46,38,.06)' } } },
  plugins: []
};
