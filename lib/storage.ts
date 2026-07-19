export type ProfileData = {
  resume: string;
  resumeFileName: string;
  // Raw bytes of the uploaded resume when it was a .docx (base64) — lets the
  // CV optimizer edit the original file in place, preserving its design.
  resumeDocxBase64: string;
  instructions: string;
  referenceLetter: string;
  referenceFileName: string;
};

export type JobLength = "300-350" | "350-400" | "400-450" | "450-500" | "500-550";

export type JobData = {
  mode: "paste" | "url";
  jobUrl: string;
  jobText: string;
  companyUrl: string;
  companyContext: string;
  company: string;
  role: string;
  length: JobLength;
};

export type CvData = {
  optimized: string;
  rating: string;
};

export type JobStatus = "applied" | "interview" | "offer" | "rejected";
export type JobType = "full-time" | "part-time" | "internship" | "working-student";

export type TrackedJob = {
  id: string;
  createdAt: number;
  company: string;
  role: string;
  link: string;
  type: JobType;
  status: JobStatus;
  notes: string;
};

export type TrackerSettings = {
  dailyTarget: number;
};

export const MAX_TRACKED_JOBS = 1000;

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
const LETTER_REVIEW_KEY = "gyc.letterReview.v1";
const CV_KEY = "gyc.cv.v1";
const TRACKER_KEY = "gyc.tracker.v1";
const TRACKER_SETTINGS_KEY = "gyc.trackerSettings.v1";

const DEFAULT_PROFILE: ProfileData = {
  resume: "",
  resumeFileName: "",
  resumeDocxBase64: "",
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
  length: "400-450",
};

const VALID_LENGTHS: JobLength[] = ["300-350", "350-400", "400-450", "450-500", "500-550"];

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
  save: (v: ProfileData) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(v));
    } catch {
      // Quota exceeded (large embedded .docx) — retry without the raw bytes so
      // the text fields still persist.
      try {
        window.localStorage.setItem(
          PROFILE_KEY,
          JSON.stringify({ ...v, resumeDocxBase64: "" }),
        );
      } catch {}
    }
  },
};

export const jobStore = {
  load: () => {
    const loaded = safeLoad<JobData>(JOB_KEY, DEFAULT_JOB);
    // Migrate legacy length values ("concise"/"standard"/"detailed") and drop stale fields like tone.
    if (!VALID_LENGTHS.includes(loaded.length)) {
      loaded.length = "400-450";
    }
    return loaded;
  },
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

export const letterReviewStore = {
  load: (): string => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(LETTER_REVIEW_KEY) || "";
  },
  save: (v: string) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LETTER_REVIEW_KEY, v);
    } catch {}
  },
};

export const cvStore = {
  load: () => safeLoad<CvData>(CV_KEY, { optimized: "", rating: "" }),
  save: (v: CvData) => safeSave(CV_KEY, v),
};

export const trackerStore = {
  load: (): TrackedJob[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(TRACKER_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.slice(0, MAX_TRACKED_JOBS) : [];
    } catch {
      return [];
    }
  },
  save: (list: TrackedJob[]) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        TRACKER_KEY,
        JSON.stringify(list.slice(0, MAX_TRACKED_JOBS)),
      );
    } catch {}
  },
};

export const trackerSettingsStore = {
  load: (): TrackerSettings => safeLoad<TrackerSettings>(TRACKER_SETTINGS_KEY, { dailyTarget: 10 }),
  save: (v: TrackerSettings) => safeSave(TRACKER_SETTINGS_KEY, v),
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
