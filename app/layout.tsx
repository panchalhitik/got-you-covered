import type { Metadata } from "next";
import { Space_Grotesk, Orbitron, Press_Start_2P } from "next/font/google";
import SuppressExtensionErrors from "@/components/SuppressExtensionErrors";
import "./globals.css";

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const display = Orbitron({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["600", "700", "800", "900"],
});
const pixel = Press_Start_2P({
  subsets: ["latin"],
  variable: "--font-pixel",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Got you CoVered",
  description:
    "Tailored cover letters, CV optimization against any job description, and a built-in job application tracker — all local-first.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${pixel.variable}`}>
      <body className="min-h-screen font-sans">
        <SuppressExtensionErrors />

        <header className="relative z-10">
          <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Got you CoVered logo"
                className="w-10 h-10 object-contain"
              />
              <div className="leading-tight">
                <div className="font-display text-base tracking-wider">
                  Got you <span className="cv-letter">C</span>o<span className="v-letter">V</span>ered
                </div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted font-pixel">
                  Letters · CV · Tracker
                </div>
              </div>
            </div>
            <span className="hidden sm:inline-flex chip">Local-first</span>
          </div>
          <div className="divider-glow" />
        </header>

        <section className="max-w-5xl mx-auto px-6 pt-12 pb-10 text-center">
          <div className="flex justify-center mb-6">
            <span className="chip">Write · Optimize · Track</span>
          </div>
          <div className="flex justify-center">
            <div className="relative">
              <div
                aria-hidden
                className="absolute inset-0 -z-10 blur-3xl opacity-60"
                style={{ background: "radial-gradient(circle, rgba(168,85,247,0.55), transparent 70%)" }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Got you CoVered"
                width={180}
                height={180}
                className="object-contain"
                style={{ width: 180, height: 180 }}
              />
            </div>
          </div>
          <h1 className="mt-6 font-display text-3xl sm:text-5xl font-extrabold tracking-tight">
            <span className="gradient-text">Got you </span>
            <span className="cv-letter">C</span>
            <span className="gradient-text">o</span>
            <span className="v-letter">V</span>
            <span className="gradient-text">ered</span>
          </h1>
          <p className="mt-4 text-muted max-w-xl mx-auto text-sm sm:text-base">
            Your whole application workflow: generate tailored cover letters, score and optimize your CV against
            the job description, and track every application — exported to <code className="text-white">.docx</code> / <code className="text-white">.pdf</code>, stored only in your browser.
          </p>
        </section>

        <main className="max-w-5xl mx-auto px-6 pb-16">{children}</main>

        <footer className="max-w-5xl mx-auto px-6 py-10 text-xs text-muted text-center">
          <div className="divider-glow mb-8" />
          Your resume, instructions, generated letters, optimized CVs, and tracked applications live only in this browser&apos;s localStorage. The Anthropic API is called server-side; the key never reaches your browser.
        </footer>
      </body>
    </html>
  );
}
