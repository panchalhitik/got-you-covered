import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d10",
        panel: "#14171c",
        muted: "#8a9099",
        border: "#262a31",
        accent: "#7c5cff",
        accentSoft: "#1a1632",
      },
    },
  },
  plugins: [],
};
export default config;
