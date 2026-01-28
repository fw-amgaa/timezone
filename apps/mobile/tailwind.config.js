/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Brand colors
        primary: {
          DEFAULT: "#6366F1",
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          800: "#3730A3",
          900: "#312E81",
          950: "#1E1B4B",
        },
        success: {
          DEFAULT: "#10B981",
          light: "#D1FAE5",
        },
        warning: {
          DEFAULT: "#FB7185",
          light: "#FFE4E6",
        },
        background: {
          DEFAULT: "#FFFFFF",
          dark: "#0F172A",
        },
        surface: {
          DEFAULT: "#F8FAFC",
          dark: "#1E293B",
        },
      },
      fontFamily: {
        sans: ["NunitoSans"],
      },
    },
  },
  plugins: [],
};
