import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Got you CoVered",
  description: "Generate tailored cover letters from your resume + a target job description.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-border bg-[#0d1014]">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center text-white font-bold">CV</div>
              <div>
                <h1 className="text-lg font-semibold leading-tight">Got you CoVered</h1>
                <p className="text-xs text-muted">Tailored cover letters, in seconds.</p>
              </div>
            </div>
            <span className="text-xs text-muted hidden sm:block">Local-first · your data stays in this browser</span>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
        <footer className="max-w-5xl mx-auto px-6 py-8 text-xs text-muted">
          Privacy: resumes, instructions, and generated letters are stored only in this browser&apos;s localStorage. The Anthropic API is called server-side from this app; your API key never reaches the browser.
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
