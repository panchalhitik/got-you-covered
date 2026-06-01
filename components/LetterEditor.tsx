"use client";

import { useEffect, useMemo, useState } from "react";
import { downloadPdf } from "@/lib/pdf";
import { stripBold } from "@/lib/format";

type Props = {
  letter: string;
  setLetter: (v: string) => void;
  company: string;
  role: string;
  streaming: boolean;
  error: string | null;
  onRegenerate: () => void;
  canRegenerate: boolean;
};

export default function LetterEditor({
  letter,
  setLetter,
  company,
  role,
  streaming,
  error,
  onRegenerate,
  canRegenerate,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const plain = useMemo(() => stripBold(letter), [letter]);
  const words = useMemo(
    () => (plain.trim() ? plain.trim().split(/\s+/).length : 0),
    [plain],
  );

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const baseName = useMemo(() => {
    const parts = [company, role].filter(Boolean).map((s) =>
      s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase(),
    );
    return parts.length ? `cover-letter-${parts.join("-")}` : "cover-letter";
  }, [company, role]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
    } catch {}
  }

  async function exportDocx() {
    setDownloading(true);
    try {
      const res = await fetch("/api/export/docx", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: letter, filename: baseName }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  function exportPdf() {
    downloadPdf(letter, baseName);
  }

  const showEmpty = !letter && !streaming && !error;

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">3 — Your cover letter</h2>
          <p className="text-xs text-muted">
            {streaming ? "Streaming…" : letter ? `${words} words` : "Generated letter will appear here."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn-soft text-xs" onClick={copy} disabled={!letter || streaming}>
            {copied ? "Copied!" : "Copy"}
          </button>
          <button className="btn-soft text-xs" onClick={exportDocx} disabled={!letter || streaming || downloading}>
            {downloading ? "…" : "Download .docx"}
          </button>
          <button className="btn-soft text-xs" onClick={exportPdf} disabled={!letter || streaming}>
            Download .pdf
          </button>
          <button className="btn-primary text-xs" onClick={onRegenerate} disabled={streaming || !canRegenerate}>
            {streaming ? "Generating…" : letter ? "Regenerate" : "Generate"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 text-sm rounded-md border border-red-500/40 bg-red-500/10 text-red-300 px-3 py-2">
          {error}
        </div>
      )}

      {showEmpty ? (
        <div className="text-sm text-muted italic border border-dashed border-border rounded-md p-6 text-center">
          Fill in your profile and the job, then click <span className="text-white font-medium">Generate</span>.
        </div>
      ) : (
        <>
          <textarea
            className="textarea !font-serif !text-[15px] !leading-7 min-h-[640px] lg:min-h-[80vh] resize-y whitespace-pre-wrap"
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            placeholder="Your cover letter will stream in here..."
          />
          <p className="text-xs text-muted mt-2">
            <code>**text**</code> marks bold; a line of underscores becomes a horizontal rule in the .docx / .pdf. Copy strips them; downloads render them as real formatting.
          </p>
        </>
      )}
    </section>
  );
}
