import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#04080f",
          900: "#070d1c",
          800: "#0c1528",
          700: "#111e38",
          600: "#172447",
          500: "#1e2e58",
        },
        gold: {
          DEFAULT: "#C9A550",
          50:  "#fdf8ec",
          100: "#f8eccc",
          200: "#f0d48a",
          300: "#e8bc52",
          400: "#d9a53a",
          500: "#C9A550",
          600: "#a07d32",
          700: "#7a5e22",
          800: "#553f16",
          900: "#2e210a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "gold-sm": "0 0 12px rgba(201,165,80,0.15)",
        "gold-md": "0 0 24px rgba(201,165,80,0.25)",
        "card":    "0 4px 24px rgba(0,0,0,0.4)",
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #C9A550 0%, #E8C97A 50%, #C9A550 100%)",
        "navy-gradient": "linear-gradient(180deg, #0c1528 0%, #070d1c 100%)",
      },
    },
  },
  plugins: [],
};

export default config;