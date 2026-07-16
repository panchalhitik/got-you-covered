"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cvStore } from "@/lib/storage";
import { stripBold } from "@/lib/format";
import { downloadPdf } from "@/lib/pdf";

type Props = {
  resume: string;
  resumeDocxBase64: string;
  jobText: string;
  company: string;
  role: string;
  onUseInLetter: (plainCv: string) => void;
};

type RateSource = "uploaded" | "optimized";

function scoreBand(score: number) {
  if (score >= 80) return { label: "Interview-likely", color: "#34d399" };
  if (score >= 60) return { label: "Borderline", color: "#fbbf24" };
  return { label: "Likely rejected", color: "#f87171" };
}

export default function CvTools({
  resume,
  resumeDocxBase64,
  jobText,
  company,
  role,
  onUseInLetter,
}: Props) {
  const [hydrated, setHydrated] = useState(false);
  const [rating, setRating] = useState("");
  const [optimized, setOptimized] = useState("");
  const [optimizedDocx, setOptimizedDocx] = useState(""); // base64, in-memory only
  const [rateSource, setRateSource] = useState<RateSource>("uploaded");
  const [rateBusy, setRateBusy] = useState(false);
  const [optBusy, setOptBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const data = cvStore.load();
    setRating(data.rating);
    setOptimized(data.optimized);
    if (data.optimized) setRateSource("optimized");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    cvStore.save({ optimized, rating });
  }, [optimized, rating, hydrated]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const ready = Boolean(resume.trim() && jobText.trim());
  const busy = rateBusy || optBusy;
  const hasDocx = Boolean(resumeDocxBase64);

  const plainOptimized = useMemo(() => stripBold(optimized), [optimized]);
  const optimizedWords = useMemo(
    () => (plainOptimized.trim() ? plainOptimized.trim().split(/\s+/).length : 0),
    [plainOptimized],
  );

  // Score parsed live from the streaming rating text
  const score = useMemo(() => {
    const m = rating.match(/SCORE:\s*(\d{1,3})/i) || rating.match(/(\d{1,3})\s*\/\s*100/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
  }, [rating]);

  const ratingBody = useMemo(
    () => rating.replace(/^\s*SCORE:.*$/im, "").trim(),
    [rating],
  );

  const baseName = useMemo(() => {
    const parts = [company, role].filter(Boolean).map((s) =>
      s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase(),
    );
    return parts.length ? `cv-optimized-${parts.join("-")}` : "cv-optimized";
  }, [company, role]);

  async function streamInto(url: string, cvText: string, onChunk: (acc: string) => void) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cv: cvText, jobDescription: jobText, company, role }),
      signal: ctrl.signal,
    });

    if (!res.ok || !res.body) {
      let msg = `Request failed (${res.status})`;
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
      onChunk(acc);
    }
    return acc;
  }

  async function rateCv(sourceOverride?: RateSource) {
    if (!ready || busy) return;
    const which = sourceOverride ?? rateSource;
    const source = which === "optimized" && optimized.trim() ? plainOptimized : resume;
    setError(null);
    setRating("");
    setRateBusy(true);
    try {
      await streamInto("/api/cv/rate", source, setRating);
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Rating failed");
    } finally {
      setRateBusy(false);
    }
  }

  async function optimizeCv() {
    if (!ready || busy) return;
    setError(null);
    setOptBusy(true);
    try {
      if (hasDocx) {
        // In-place edit of the original .docx — design preserved.
        setOptimized("Editing your original .docx in place… (20-60s, no streaming for this mode)");
        const res = await fetch("/api/cv/optimize-docx", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            docxBase64: resumeDocxBase64,
            jobDescription: jobText,
            company,
            role,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Optimize failed (${res.status})`);
        setOptimized(data.text || "");
        setOptimizedDocx(data.docxBase64 || "");
      } else {
        setOptimized("");
        setOptimizedDocx("");
        await streamInto("/api/cv/optimize", resume, setOptimized);
      }
      setRateSource("optimized");
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === "AbortError") return;
      setOptimized("");
      setError(e instanceof Error ? e.message : "Optimization failed");
    } finally {
      setOptBusy(false);
    }
  }

  async function copyOptimized() {
    try {
      await navigator.clipboard.writeText(plainOptimized);
      setCopied(true);
    } catch {}
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportDocx() {
    setDownloading(true);
    try {
      if (optimizedDocx) {
        // The edited original — same design as the uploaded file.
        const bin = atob(optimizedDocx);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        downloadBlob(
          new Blob([bytes], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }),
          `${baseName}.docx`,
        );
      } else {
        const res = await fetch("/api/export/docx", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: optimized, filename: baseName }),
        });
        downloadBlob(await res.blob(), `${baseName}.docx`);
      }
    } finally {
      setDownloading(false);
    }
  }

  const band = score !== null ? scoreBand(score) : null;

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-baseline gap-4">
          <span className="section-number">03</span>
          <div>
            <h2 className="font-display text-lg uppercase tracking-wider">CV optimizer</h2>
            <p className="text-xs text-muted mt-1">
              Rate your CV against the job, then let it edit your CV to match.
            </p>
          </div>
        </div>
      </div>

      {!ready && (
        <div className="text-sm text-muted italic border border-dashed border-border rounded-md p-6 text-center mb-4">
          Upload a CV (01) and add a job description (02) first.
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm rounded-md border border-red-500/40 bg-red-500/10 text-red-300 px-3 py-2">
          {error}
        </div>
      )}

      {/* ---- Rate ---- */}
      <div className="border border-border rounded-xl p-4 mb-5 bg-[#0a0a1c]/50">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h3 className="text-sm font-semibold">Rate my CV</h3>
            <p className="text-xs text-muted">Score, missing keywords, red flags — short and brutal.</p>
          </div>
          <div className="flex items-center gap-2">
            {optimized.trim() && !optBusy && (
              <select
                className="input !w-auto text-xs"
                value={rateSource}
                onChange={(e) => setRateSource(e.target.value as RateSource)}
              >
                <option value="uploaded">Rate: uploaded CV</option>
                <option value="optimized">Rate: optimized CV</option>
              </select>
            )}
            <button className="btn-primary text-xs" onClick={() => rateCv()} disabled={!ready || busy}>
              {rateBusy ? "Rating…" : rating ? "Re-rate" : "Rate CV"}
            </button>
          </div>
        </div>

        {score !== null && band && (
          <div className="mb-4">
            <div className="flex items-end justify-between mb-2">
              <span
                className="font-display text-4xl font-extrabold leading-none"
                style={{ color: band.color }}
              >
                {score}
                <span className="text-base text-muted font-sans font-normal"> / 100</span>
              </span>
              <span
                className="text-xs font-pixel uppercase tracking-widest px-2 py-1 rounded"
                style={{ color: band.color, border: `1px solid ${band.color}55` }}
              >
                {band.label}
              </span>
            </div>
            <div className="h-3 rounded-full bg-[#0a0a1c] border border-border overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${score}%`,
                  background: `linear-gradient(90deg, #f87171, #fbbf24 55%, #34d399)`,
                  boxShadow: `0 0 14px ${band.color}88`,
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted mt-1 font-pixel">
              <span>0</span>
              <span>60</span>
              <span>80</span>
              <span>100</span>
            </div>
          </div>
        )}

        {(ratingBody || rateBusy) && (
          <div className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-[#d9d9ec] bg-[#0a0a1c] border border-border rounded-md p-4 max-h-[400px] overflow-y-auto">
            {ratingBody || "Skimming…"}
          </div>
        )}
      </div>

      {/* ---- Optimize ---- */}
      <div className="border border-border rounded-xl p-4 bg-[#0a0a1c]/50">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h3 className="text-sm font-semibold">Optimize my CV</h3>
            <p className="text-xs text-muted">
              {hasDocx
                ? "Edits your original .docx in place — photo, fonts, and layout preserved."
                : "Rewrites the CV text for this job. Upload a .docx in 01 to keep your original design."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button className="btn-soft text-xs" onClick={copyOptimized} disabled={!optimized || busy}>
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              className="btn-soft text-xs"
              onClick={exportDocx}
              disabled={!optimized || busy || downloading}
            >
              {downloading ? "…" : optimizedDocx ? "Download .docx (original design)" : "Download .docx"}
            </button>
            <button
              className="btn-soft text-xs"
              onClick={() => downloadPdf(optimized, baseName)}
              disabled={!optimized || busy}
            >
              Download .pdf
            </button>
            <button className="btn-primary text-xs" onClick={optimizeCv} disabled={!ready || busy}>
              {optBusy ? "Optimizing…" : optimized ? "Re-optimize" : "Optimize CV"}
            </button>
          </div>
        </div>

        {(optimized || optBusy) && (
          <>
            <textarea
              className="textarea !text-[13.5px] !leading-6 min-h-[420px] resize-y whitespace-pre-wrap"
              value={optimized}
              onChange={(e) => setOptimized(e.target.value)}
              placeholder="Your optimized CV will stream in here..."
            />
            <p className="text-xs text-muted mt-2">
              {optimizedWords} words
              {optimizedDocx
                ? " · .docx download keeps your original design (text edits only; manual edits in this box are NOT applied to it)"
                : ""}
              {" "}· downloads embed a real text layer (ATS-readable) — never re-save via &quot;Print to PDF&quot;.
            </p>
            {optimized.trim() && !optBusy && (
              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <button
                  className="btn-primary text-xs"
                  onClick={() => {
                    setRateSource("optimized");
                    rateCv("optimized");
                  }}
                  disabled={busy}
                >
                  Rate the optimized CV
                </button>
                <button
                  className="btn-ghost text-xs"
                  onClick={() => onUseInLetter(plainOptimized)}
                  disabled={busy}
                >
                  Use this CV in the cover letter generator →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
