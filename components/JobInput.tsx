"use client";

import { useEffect, useRef, useState } from "react";
import { JobData, jobStore } from "@/lib/storage";

export default function JobInput({
  value,
  onChange,
}: {
  value: JobData;
  onChange: (v: JobData) => void;
}) {
  const [scraping, setScraping] = useState(false);
  const [scrapeErr, setScrapeErr] = useState<string | null>(null);
  const [companyScraping, setCompanyScraping] = useState(false);
  const [companyErr, setCompanyErr] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);

  // valueRef always points to the latest props.value so async detection
  // (which fires after a network roundtrip) doesn't apply updates on top
  // of a stale snapshot.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
    jobStore.save(value);
  }, [value]);

  function update<K extends keyof JobData>(key: K, v: JobData[K]) {
    onChange({ ...value, [key]: v });
  }

  async function scrapeJob() {
    if (!value.jobUrl.trim()) return;
    setScraping(true);
    setScrapeErr(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: value.jobUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scrape failed");
      // Replace text AND clear stale company/role; detection will fill them in.
      onChange({ ...value, jobText: data.text, company: "", role: "" });
      detectFields(data.text, true);
    } catch (e: unknown) {
      setScrapeErr(e instanceof Error ? e.message : "Scrape failed");
    } finally {
      setScraping(false);
    }
  }

  async function scrapeCompany() {
    if (!value.companyUrl.trim()) return;
    setCompanyScraping(true);
    setCompanyErr(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: value.companyUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scrape failed");
      onChange({ ...value, companyContext: data.text });
    } catch (e: unknown) {
      setCompanyErr(e instanceof Error ? e.message : "Scrape failed");
    } finally {
      setCompanyScraping(false);
    }
  }

  async function detectFields(text: string, overwrite: boolean = false) {
    if (!text || text.trim().length < 50) return;
    setDetecting(true);
    try {
      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const data = await res.json();
      // Always merge into the LATEST state, not the closure-captured one.
      const current = valueRef.current;
      const next = { ...current };
      let changed = false;
      if (data.company && (overwrite || !next.company)) {
        next.company = data.company;
        changed = true;
      }
      if (data.role && (overwrite || !next.role)) {
        next.role = data.role;
        changed = true;
      }
      if (changed) onChange(next);
    } finally {
      setDetecting(false);
    }
  }

  function handleJobPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = e.clipboardData.getData("text");
    if (!pasted || pasted.trim().length < 50) return;
    // Wait one tick for React to apply the paste, then detect against the
    // latest text (read via valueRef so we always see the post-paste state).
    setTimeout(() => {
      const latest = valueRef.current.jobText;
      detectFields(latest || pasted, true);
    }, 50);
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-baseline gap-4">
          <span className="section-number">02</span>
          <div>
            <h2 className="font-display text-lg uppercase tracking-wider">The job</h2>
            <p className="text-xs text-muted mt-1">Paste the JD or give a URL. We&apos;ll extract the text and prefill company + role.</p>
          </div>
        </div>
        <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => update("mode", "paste")}
            className={`px-3 py-1.5 ${value.mode === "paste" ? "bg-accent text-white" : "text-muted hover:text-white"}`}
          >
            Paste text
          </button>
          <button
            type="button"
            onClick={() => update("mode", "url")}
            className={`px-3 py-1.5 ${value.mode === "url" ? "bg-accent text-white" : "text-muted hover:text-white"}`}
          >
            From URL
          </button>
        </div>
      </div>

      {value.mode === "url" && (
        <div className="mb-4">
          <label className="label">Job posting URL</label>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="https://..."
              value={value.jobUrl}
              onChange={(e) => update("jobUrl", e.target.value)}
            />
            <button
              type="button"
              className="btn-soft whitespace-nowrap"
              onClick={scrapeJob}
              disabled={scraping || !value.jobUrl.trim()}
            >
              {scraping ? "Scraping…" : "Fetch text"}
            </button>
          </div>
          {scrapeErr && <div className="text-xs text-amber-400 mt-2">{scrapeErr}</div>}
          <div className="text-xs text-muted mt-2">
            Sites like LinkedIn / Indeed / Glassdoor block scraping — paste the text instead.
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="label !mb-0">Job description text</label>
          {detecting && <span className="text-xs text-muted">Detecting company + role…</span>}
        </div>
        <textarea
          className="textarea"
          rows={10}
          placeholder="Paste or edit the full job description here..."
          value={value.jobText}
          onChange={(e) => update("jobText", e.target.value)}
          onPaste={handleJobPaste}
          onBlur={() => {
            if (value.jobText && (!value.company || !value.role)) detectFields(value.jobText);
          }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
        <div>
          <label className="label">Company</label>
          <input
            className="input"
            placeholder="Acme Inc."
            value={value.company}
            onChange={(e) => update("company", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Role</label>
          <input
            className="input"
            placeholder="Senior Software Engineer"
            value={value.role}
            onChange={(e) => update("role", e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end mb-4">
        <button
          type="button"
          className="btn-soft text-xs"
          onClick={() => detectFields(value.jobText, true)}
          disabled={detecting || value.jobText.trim().length < 50}
        >
          {detecting ? "Detecting…" : "Re-detect from job description"}
        </button>
      </div>

      <div className="mb-2">
        <label className="label">Company page URL (optional, for extra context)</label>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="https://company.com/about"
            value={value.companyUrl}
            onChange={(e) => update("companyUrl", e.target.value)}
          />
          <button
            type="button"
            className="btn-soft whitespace-nowrap"
            onClick={scrapeCompany}
            disabled={companyScraping || !value.companyUrl.trim()}
          >
            {companyScraping ? "Fetching…" : "Fetch"}
          </button>
        </div>
        {companyErr && <div className="text-xs text-amber-400 mt-2">{companyErr}</div>}
      </div>

      {value.companyContext && (
        <details className="mt-2">
          <summary className="text-xs text-muted cursor-pointer">
            Company context preview ({value.companyContext.length} chars)
          </summary>
          <textarea
            className="textarea mt-2"
            rows={5}
            value={value.companyContext}
            onChange={(e) => update("companyContext", e.target.value)}
          />
        </details>
      )}

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <label className="label">Tone</label>
          <select
            className="input"
            value={value.tone}
            onChange={(e) => update("tone", e.target.value as JobData["tone"])}
          >
            <option value="conversational">Conversational</option>
            <option value="formal">Formal</option>
            <option value="enthusiastic">Enthusiastic</option>
          </select>
        </div>
        <div>
          <label className="label">Length</label>
          <select
            className="input"
            value={value.length}
            onChange={(e) => update("length", e.target.value as JobData["length"])}
          >
            <option value="concise">Concise</option>
            <option value="standard">Standard</option>
            <option value="detailed">Detailed</option>
          </select>
        </div>
      </div>
    </section>
  );
}
