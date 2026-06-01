export type ProfileData = {
  resume: string;
  resumeFileName: string;
  instructions: string;
  referenceLetter: string;
  referenceFileName: string;
};

export type JobData = {
  mode: "paste" | "url";
  jobUrl: string;
  jobText: string;
  companyUrl: string;
  companyContext: string;
  company: string;
  role: string;
  tone: "formal" | "conversational" | "enthusiastic";
  length: "concise" | "standard" | "detailed";
};

export type HistoryItem = {
  id: string;
  createdAt: number;
  company: string;
  role: string;
  letter: string;
};

const PROFILE_KEY = "gyc.profile.v1";
const JOB_KEY = "gyc.job.v1";
const HISTORY_KEY = "gyc.history.v1";
const LETTER_KEY = "gyc.letter.v1";

const DEFAULT_PROFILE: ProfileData = {
  resume: "",
  resumeFileName: "",
  instructions: "",
  referenceLetter: "",
  referenceFileName: "",
};

const DEFAULT_JOB: JobData = {
  mode: "paste",
  jobUrl: "",
  jobText: "",
  companyUrl: "",
  companyContext: "",
  company: "",
  role: "",
  tone: "conversational",
  length: "standard",
};

function safeLoad<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

function safeSave<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const profileStore = {
  load: () => safeLoad<ProfileData>(PROFILE_KEY, DEFAULT_PROFILE),
  save: (v: ProfileData) => safeSave(PROFILE_KEY, v),
};

export const jobStore = {
  load: () => safeLoad<JobData>(JOB_KEY, DEFAULT_JOB),
  save: (v: JobData) => safeSave(JOB_KEY, v),
};

export const letterStore = {
  load: (): string => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(LETTER_KEY) || "";
  },
  save: (v: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LETTER_KEY, v);
  },
};

export const historyStore = {
  load: (): HistoryItem[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  },
  add: (item: HistoryItem) => {
    if (typeof window === "undefined") return;
    const cur = historyStore.load();
    const next = [item, ...cur].slice(0, 50);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  },
  remove: (id: string) => {
    if (typeof window === "undefined") return;
    const cur = historyStore.load().filter((h) => h.id !== id);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(cur));
  },
};
