/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        line: "var(--line)",
        "txt-1": "var(--text-1)",
        "txt-2": "var(--text-2)",
        "txt-3": "var(--text-3)",
        accent: "#3B82F6",
        ok: "#10B981",
        warn: "#F59E0B",
        danger: "#EF4444",
      },
      fontFamily: {
        heading: ["Outfit", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
