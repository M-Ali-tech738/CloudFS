/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["'IBM Plex Mono'", "monospace"],
        sans: ["'IBM Plex Sans'", "sans-serif"],
      },
      colors: {
        surface: {
          DEFAULT: "#0a0c10",
          1: "#0f1219",
          2: "#151b26",
          3: "#1c2333",
        },
        accent: {
          DEFAULT: "#63d387",
          dim: "#3fb866",
          muted: "rgba(99,211,135,0.1)",
        },
        border: "rgba(255,255,255,0.06)",
        text: {
          primary: "#edf0f7",
          secondary: "#8892a4",
          muted: "#4d5668",
        },
        danger: "#f87171",
        warn: "#fbbf24",
      },
      borderRadius: {
        DEFAULT: "6px",
      },
    },
  },
  plugins: [],
};
