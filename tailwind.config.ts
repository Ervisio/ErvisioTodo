import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        blue: Object.fromEntries(
          [100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => [
            n,
            "rgb(var(--accent-ch) / <alpha-value>)",
          ]),
        ),
        white: "rgb(var(--fg) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--fg) / <alpha-value>)",
          dim: "rgb(var(--ink-dim) / <alpha-value>)",
          faint: "rgb(var(--ink-faint) / <alpha-value>)",
        },
        accent: "rgb(var(--accent-ch) / <alpha-value>)",
        orange: Object.fromEntries(
          [100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => [
            n,
            "rgb(var(--accent-ch) / <alpha-value>)",
          ]),
        ),
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
} satisfies Config;
