/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0b0b0b",
        panel: "#111111",
        accent: "#8b5cf6",
        muted: "#9ca3af",
      },
    },
  },
  plugins: [],
};
