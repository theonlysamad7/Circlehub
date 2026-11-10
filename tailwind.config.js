/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17231F",
        forest: "#245B45",
        mint: "#DDF3E6",
        paper: "#F7F8F4",
        muted: "#758078",
      },
    },
  },
  plugins: [],
};
