/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
        sans: ["'DM Sans'", "sans-serif"],
      },
      colors: {
        surface: {
          DEFAULT: "#0f1117",
          1: "#161b27",
          2: "#1e2538",
          3: "#252d42",
        },
        accent: {
          DEFAULT: "#4ade80",
          dim: "#22c55e",
          muted: "rgba(74, 222, 128, 0.15)",
        },
        border: "rgba(255,255,255,0.07)",
        text: {
          primary: "#e8eaf0",
          secondary: "#7c849a",
          muted: "#4a5168",
        },
        danger: "#f87171",
        warn: "#fb923c",
      },
    },
  },
  plugins: [],
};
