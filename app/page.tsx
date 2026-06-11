"use client";

import { useEffect, useRef, useState } from "react";
import Profile from "@/components/Profile";
import JobInput from "@/components/JobInput";
import LetterEditor from "@/components/LetterEditor";
import {
  HistoryItem,
  JobData,
  ProfileData,
  historyStore,
  jobStore,
  letterStore,
  profileStore,
} from "@/lib/storage";

const INITIAL_PROFILE: ProfileData = {
  resume: "",
  resumeFileName: "",
  instructions: "",
  referenceLetter: "",
  referenceFileName: "",
};

const INITIAL_JOB: JobData = {
  mode: "paste",
  jobUrl: "",
  jobText: "",
  companyUrl: "",
  companyContext: "",
  company: "",
  role: "",
  length: "400-450",
};

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState<ProfileData>(INITIAL_PROFILE);
  const [job, setJob] = useState<JobData>(INITIAL_JOB);
  const [letter, setLetter] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setProfile(profileStore.load());
    setJob(jobStore.load());
    setLetter(letterStore.load());
    setHistory(historyStore.load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    letterStore.save(letter);
  }, [letter, hydrated]);

  const canGenerate = Boolean(profile.resume.trim() && job.jobText.trim());

  async function generate() {
    if (!canGenerate || streaming) return;
    setError(null);
    setLetter("");
    setStreaming(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          resume: profile.resume,
          instructions: profile.instructions,
          referenceLetter: profile.referenceLetter,
          jobDescription: job.jobText,
          companyContext: job.companyContext,
          company: job.company,
          role: job.role,
          length: job.length,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        let msg = `Generate failed (${res.status})`;
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
        const chunk = decoder.decode(value, { stream: true });
        acc += chunk;
        setLetter(acc);
      }

      if (acc.trim()) {
        const item: HistoryItem = {
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          company: job.company,
          role: job.role,
          letter: acc,
        };
        historyStore.add(item);
        setHistory(historyStore.load());
      }
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="space-y-6">
      <Profile value={profile} onChange={setProfile} />
      <JobInput value={job} onChange={setJob} />

      {!canGenerate && (
        <div className="text-xs text-muted px-1">
          {!profile.resume.trim() ? "Add a resume above. " : ""}
          {!job.jobText.trim() ? "Paste or fetch a job description. " : ""}
        </div>
      )}

      <LetterEditor
        letter={letter}
        setLetter={setLetter}
        company={job.company}
        role={job.role}
        streaming={streaming}
        error={error}
        onRegenerate={generate}
        canRegenerate={canGenerate}
      />

      {history.length > 0 && (
        <section className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">History</h2>
            <span className="text-xs text-muted">Latest {history.length} saved locally</span>
          </div>
          <ul className="divide-y divide-border">
            {history.slice(0, 10).map((h) => (
              <li key={h.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm truncate">
                    <span className="font-medium">{h.company || "Unknown company"}</span>
                    <span className="text-muted"> — {h.role || "Unknown role"}</span>
                  </div>
                  <div className="text-xs text-muted">
                    {new Date(h.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="btn-soft text-xs"
                    onClick={() => setLetter(h.letter)}
                  >
                    Load
                  </button>
                  <button
                    className="btn-ghost text-xs"
                    onClick={() => {
                      historyStore.remove(h.id);
                      setHistory(historyStore.load());
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
