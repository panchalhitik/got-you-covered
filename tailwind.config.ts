import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#08081a",
        panel: "#0f0f22",
        panel2: "#171732",
        border: "#27274a",
        muted: "#8a8ab0",
        accent: "#a855f7",
        accent2: "#ec4899",
        accent3: "#3b82f6",
        accentSoft: "#1f1740",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        pixel: ["var(--font-pixel)", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(168, 85, 247, 0.45)",
        glowStrong: "0 0 70px -8px rgba(168, 85, 247, 0.7)",
        glowPink: "0 0 60px -8px rgba(236, 72, 153, 0.55)",
      },
      backgroundImage: {
        brand: "linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #3b82f6 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
