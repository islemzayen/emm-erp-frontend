/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",  // ← add this line
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ["var(--font-syne)"],
        body: ["var(--font-inter)"],
      },
    },
  },
  plugins: [],
};