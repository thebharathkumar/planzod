/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Outfit", "DM Sans", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
        accent: {
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
        },
        surface: {
          50: "#faf5f0",
          100: "#f5ebdf",
          200: "#ede4d8",
          300: "#d4c5b0",
          400: "#9b8770",
          500: "#6b5d4a",
          600: "#463a2a",
          700: "#2c2418",
          800: "#1a1410",
          900: "#110c08",
          950: "#08050a",
        },
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.2)",
        "card-hover":
          "0 20px 25px -5px rgb(0 0 0 / 0.5), 0 0 25px -5px rgb(249 115 22 / 0.3)",
        glow: "0 0 30px -5px rgb(249 115 22 / 0.45)",
      },
      transitionDuration: {
        200: "200ms",
        300: "300ms",
      },
    },
  },
  plugins: [],
};
