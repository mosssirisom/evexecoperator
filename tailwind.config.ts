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
        // Neutral greys as navy blue-greys (EV Exec navy-and-white theme).
        // Same shade roles as Tailwind's slate, so contrast is kept: 500 is
        // secondary text (#56708C, the palette's #627D98 deepened slightly to
        // pass WCAG AA on white and on the page background), 200 borders,
        // 50 the page background.
        slate: {
          50: "#F3F6F9",
          100: "#E9EFF5",
          200: "#D9E2EC",
          300: "#BCCCDC",
          400: "#829AB1",
          500: "#56708C",
          600: "#486581",
          700: "#334E68",
          800: "#243B53",
          900: "#102A43",
          950: "#0B1F33",
        },
        // Brand accent (was gold/amber). Shades follow the roles the amber
        // shades had: 300 text on dark navy, 400 fills/borders/tints,
        // 500 primary buttons, 600 accent text on white.
        brand: {
          DEFAULT: "#102A43",
          50: "#F0F5FA",
          100: "#E3EDF8",
          200: "#C9DAEC",
          300: "#A9C2DD",
          400: "#334E68",
          500: "#102A43",
          600: "#334E68",
          700: "#102A43",
          800: "#0B1F33",
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
        "brand-sm": "0 0 12px rgba(16,42,67,0.15)",
        "brand-md": "0 0 24px rgba(16,42,67,0.25)",
        "card":    "0 4px 20px rgba(16,42,67,0.08)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #102A43 0%, #334E68 50%, #102A43 100%)",
        "navy-gradient": "linear-gradient(180deg, #0c1528 0%, #070d1c 100%)",
      },
    },
  },
  plugins: [],
};

export default config;