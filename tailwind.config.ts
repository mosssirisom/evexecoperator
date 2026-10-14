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
        // Softer gold in place of Tailwind's bright amber/orange (easier on
        // the eye; matches the logo's gold). Same shade roles as before:
        // 50–200 pale fills, 300 text on dark, 400 dots/borders, 500 buttons,
        // 600+ text on white (600 = #8A6A1F, 5:1 contrast; the old #d97706
        // was 3.2:1).
        amber: {
          50: "#FBF7EE",
          100: "#F5ECD7",
          200: "#EBD9AE",
          300: "#E0C48A",
          400: "#D4B266",
          500: "#C9A550",
          600: "#8A6A1F",
          700: "#6F5418",
          800: "#553F16",
          900: "#3D2D10",
          950: "#241A09",
        },
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
        "card":    "0 4px 20px rgba(15,27,51,0.08)",
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