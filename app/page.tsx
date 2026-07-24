"use client";

import { useEffect, useRef, useState } from "react";
import Profile from "@/components/Profile";
import JobInput from "@/components/JobInput";
import LetterEditor from "@/components/LetterEditor";
import CvTools from "@/components/CvTools";
import JobTracker from "@/components/JobTracker";
import {
  HistoryItem,
  JobData,
  MAX_TRACKED_JOBS,
  ProfileData,
  TrackedJob,
  historyStore,
  jobStore,
  letterStore,
  profileStore,
  trackerStore,
} from "@/lib/storage";

const INITIAL_PROFILE: ProfileData = {
  resume: "",
  resumeFileName: "",
  resumeDocxBase64: "",
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

type Tab = "letter" | "cv" | "tracker";
const TAB_KEY = "gyc.tab.v1";

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>("letter");
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
    try {
      const savedTab = window.localStorage.getItem(TAB_KEY);
      if (savedTab === "letter" || savedTab === "cv" || savedTab === "tracker") setTab(savedTab);
    } catch {}
    setHydrated(true);
  }, []);

  function switchTab(t: Tab) {
    setTab(t);
    try {
      window.localStorage.setItem(TAB_KEY, t);
    } catch {}
  }

  useEffect(() => {
    if (!hydrated) return;
    letterStore.save(letter);
  }, [letter, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    profileStore.save(profile);
  }, [profile, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    jobStore.save(job);
  }, [job, hydrated]);

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

  function useOptimizedInLetter(plainCv: string) {
    setProfile({ ...profile, resume: plainCv, resumeFileName: "optimized-cv (from CV optimizer)" });
    switchTab("letter");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Called from the letter tab after generating — logs the current job.
  function trackCurrentJob(): string {
    const company = job.company.trim();
    const role = job.role.trim();
    if (!company && !role) return "Fill in company/role first";
    const list = trackerStore.load();
    const dup = list.find(
      (j) =>
        j.company.toLowerCase() === company.toLowerCase() &&
        j.role.toLowerCase() === role.toLowerCase(),
    );
    if (dup) return "Already in tracker";
    if (list.length >= MAX_TRACKED_JOBS) return "Tracker is full (1000)";
    const entry: TrackedJob = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      company: company || "Unknown company",
      role: role || "Unknown role",
      link: job.mode === "url" ? job.jobUrl.trim() : "",
      type: "full-time",
      status: "applied",
      notes: "",
    };
    trackerStore.save([entry, ...list]);
    return "Added to tracker ✓";
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="inline-flex gap-1 p-1 rounded-xl border border-border bg-[#0d0d22]/70">
          {([
            ["letter", "Cover letter"],
            ["cv", "CV optimizer"],
            ["tracker", "Job tracker"],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => switchTab(key)}
              className={`px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-medium tracking-wide transition-all ${
                tab === key
                  ? "bg-accent text-white shadow-glow"
                  : "text-muted hover:text-white hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab !== "tracker" && (
        <>
          <Profile value={profile} onChange={setProfile} minimal={tab === "cv"} />
          <JobInput value={job} onChange={setJob} hideExtras={tab === "cv"} />

          {!canGenerate && (
            <div className="text-xs text-muted px-1">
              {!profile.resume.trim() ? "Add a resume above. " : ""}
              {!job.jobText.trim() ? "Paste or fetch a job description. " : ""}
            </div>
          )}
        </>
      )}

      {tab === "tracker" && <JobTracker />}

      {tab === "cv" && (
        <CvTools
          resume={profile.resume}
          resumeDocxBase64={profile.resumeDocxBase64}
          jobText={job.jobText}
          company={job.company}
          role={job.role}
          onUseInLetter={useOptimizedInLetter}
        />
      )}

      {tab === "letter" && (
        <LetterEditor
          letter={letter}
          setLetter={setLetter}
          company={job.company}
          role={job.role}
          jobText={job.jobText}
          streaming={streaming}
          error={error}
          onRegenerate={generate}
          canRegenerate={canGenerate}
          onTrack={trackCurrentJob}
        />
      )}

      {tab === "letter" && history.length > 0 && (
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
