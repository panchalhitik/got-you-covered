"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { downloadPdf } from "@/lib/pdf";
import { stripBold } from "@/lib/format";
import { letterReviewStore } from "@/lib/storage";

type Props = {
  letter: string;
  setLetter: (v: string) => void;
  company: string;
  role: string;
  jobText: string;
  streaming: boolean;
  error: string | null;
  onRegenerate: () => void;
  canRegenerate: boolean;
  // Logs the current company/role in the job tracker; returns a feedback message.
  onTrack?: () => string;
};

function overallBand(score: number) {
  if (score >= 8) return { label: "Strong", color: "#34d399" };
  if (score >= 6) return { label: "Needs work", color: "#fbbf24" };
  return { label: "Weak", color: "#f87171" };
}

export default function LetterEditor({
  letter,
  setLetter,
  company,
  role,
  jobText,
  streaming,
  error,
  onRegenerate,
  canRegenerate,
  onTrack,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [trackMsg, setTrackMsg] = useState<string | null>(null);
  const [review, setReview] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewErr, setReviewErr] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setReview(letterReviewStore.load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    letterReviewStore.save(review);
  }, [review, hydrated]);

  useEffect(() => {
    if (!trackMsg) return;
    const t = setTimeout(() => setTrackMsg(null), 2500);
    return () => clearTimeout(t);
  }, [trackMsg]);

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

  async function reviewLetter() {
    if (!plain.trim() || reviewBusy || streaming) return;
    setReviewErr(null);
    setReview("");
    setReviewBusy(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/letter/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ letter: plain, jobDescription: jobText, company, role }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        let msg = `Review failed (${res.status})`;
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch {}
        throw new Error(msg);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setReview(acc);
      }
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === "AbortError") return;
      setReviewErr(e instanceof Error ? e.message : "Review failed");
    } finally {
      setReviewBusy(false);
    }
  }

  // "Overall: 7/10" parsed live from the streaming review.
  const overall = useMemo(() => {
    const m = review.match(/Overall:\s*(\d+(?:\.\d+)?)\s*\/\s*10\b/i);
    if (!m) return null;
    const n = parseFloat(m[1]);
    return Number.isFinite(n) && n >= 0 && n <= 10 ? n : null;
  }, [review]);

  const showEmpty = !letter && !streaming && !error;

  return (
    <section className="card">
      <div className="mb-5">
        <div className="flex items-baseline gap-4 mb-4">
          <span className="section-number">03</span>
          <div>
            <h2 className="font-display text-lg uppercase tracking-wider">Your cover letter</h2>
            <p className="text-xs text-muted mt-1">
              {streaming ? "Streaming…" : letter ? `${words} words` : "Generated letter will appear here."}
            </p>
          </div>
        </div>

        {/* Row 1 — document actions */}
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

        {/* Row 2 — analysis and bookkeeping */}
        {letter && !streaming && (
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <button
              className="btn-review text-xs"
              onClick={reviewLetter}
              disabled={reviewBusy}
              title="Score this letter against the job description"
            >
              {reviewBusy ? "Reviewing…" : review ? "Re-review" : "Review letter"}
            </button>
            {onTrack && (
              <button
                className="btn-track text-xs"
                onClick={() => setTrackMsg(onTrack())}
                title="Log this application in the job tracker"
              >
                {trackMsg || "Track application"}
              </button>
            )}
          </div>
        )}
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
          <p className="text-xs text-amber-400/80 mt-1">
            Both downloads embed a real text layer (selectable and ATS-readable). If you re-save the file, use
            &quot;Save as PDF&quot; / &quot;Export to PDF&quot; — never &quot;Print to PDF&quot;, which turns the text into an image that
            applicant tracking systems cannot read.
          </p>

          {(review || reviewBusy || reviewErr) && (
            <div className="border border-border rounded-xl p-4 mt-5 bg-[#0a0a1c]/50">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <div>
                  <h3 className="text-sm font-semibold">Recruiter review</h3>
                  <p className="text-xs text-muted">
                    {jobText.trim()
                      ? "Judged against this job description."
                      : "No job description given — judged against general best practice."}
                  </p>
                </div>
                {overall !== null && (
                  <div className="flex items-center gap-3">
                    <span
                      className="font-display text-3xl font-extrabold leading-none"
                      style={{ color: overallBand(overall).color }}
                    >
                      {overall}
                      <span className="text-sm text-muted font-sans font-normal"> / 10</span>
                    </span>
                    <span
                      className="text-[10px] font-pixel uppercase tracking-widest px-2 py-1 rounded"
                      style={{
                        color: overallBand(overall).color,
                        border: `1px solid ${overallBand(overall).color}55`,
                      }}
                    >
                      {overallBand(overall).label}
                    </span>
                  </div>
                )}
              </div>

              {overall !== null && (
                <div className="h-2 mb-3 rounded-full bg-[#0a0a1c] border border-border overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${overall * 10}%`,
                      background: "linear-gradient(90deg,#f87171,#fbbf24 55%,#34d399)",
                      boxShadow: `0 0 14px ${overallBand(overall).color}88`,
                    }}
                  />
                </div>
              )}

              {reviewErr ? (
                <div className="text-sm rounded-md border border-red-500/40 bg-red-500/10 text-red-300 px-3 py-2">
                  {reviewErr}
                </div>
              ) : (
                <div className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-[#d9d9ec] bg-[#0a0a1c] border border-border rounded-md p-4 max-h-[460px] overflow-y-auto">
                  {review || "Reading it like a recruiter…"}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
