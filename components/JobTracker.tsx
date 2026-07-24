"use client";

import { useEffect, useMemo, useState } from "react";
import {
  JobStatus,
  JobType,
  MAX_TRACKED_JOBS,
  TrackedJob,
  TrackerSettings,
  trackerSettingsStore,
  trackerStore,
} from "@/lib/storage";

const STATUS_META: Record<JobStatus, { label: string; cls: string }> = {
  applied: { label: "Applied", cls: "text-sky-300 border-sky-400/40 bg-sky-400/10" },
  interview: { label: "Interview", cls: "text-amber-300 border-amber-400/40 bg-amber-400/10" },
  offer: { label: "Offer", cls: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10" },
  rejected: { label: "Rejected", cls: "text-red-300 border-red-400/40 bg-red-400/10" },
};

const TYPE_META: Record<JobType, string> = {
  "full-time": "Full time",
  "part-time": "Part time",
  internship: "Internship",
  "working-student": "Working student",
};

const STATUS_KEYS = Object.keys(STATUS_META) as JobStatus[];
const TYPE_KEYS = Object.keys(TYPE_META) as JobType[];

function sameLocalDay(ts: number, ref: Date) {
  const d = new Date(ts);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

// Local calendar-day key, zero-padded so string sort == chronological order.
function dayKey(d: Date) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

export default function JobTracker() {
  const [hydrated, setHydrated] = useState(false);
  const [jobs, setJobs] = useState<TrackedJob[]>([]);
  const [settings, setSettings] = useState<TrackerSettings>({ dailyTarget: 10 });

  // filters
  const [query, setQuery] = useState("");
  const [fStatus, setFStatus] = useState<"all" | JobStatus>("all");
  const [fType, setFType] = useState<"all" | JobType>("all");
  const [showCount, setShowCount] = useState(100);

  // add form
  const [nCompany, setNCompany] = useState("");
  const [nRole, setNRole] = useState("");
  const [nLink, setNLink] = useState("");
  const [nType, setNType] = useState<JobType>("full-time");
  const [nStatus, setNStatus] = useState<JobStatus>("applied");
  const [addErr, setAddErr] = useState<string | null>(null);

  useEffect(() => {
    setJobs(trackerStore.load());
    setSettings(trackerSettingsStore.load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    trackerStore.save(jobs);
  }, [jobs, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    trackerSettingsStore.save(settings);
  }, [settings, hydrated]);

  const now = new Date();
  const stats = useMemo(() => {
    const total = jobs.length;
    const byStatus = { applied: 0, interview: 0, offer: 0, rejected: 0 } as Record<JobStatus, number>;
    let today = 0;
    for (const j of jobs) {
      byStatus[j.status] = (byStatus[j.status] || 0) + 1;
      if (sameLocalDay(j.createdAt, now)) today++;
    }
    const rejectionPct = total ? Math.round((byStatus.rejected / total) * 100) : 0;
    return { total, byStatus, today, rejectionPct };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs]);

  const goal = Math.max(1, settings.dailyTarget || 1);
  const goalPct = Math.min(100, Math.round((stats.today / goal) * 100));
  const goalHit = stats.today >= goal;

  const analytics = useMemo(() => {
    // applications per calendar day
    const counts = new Map<string, number>();
    for (const j of jobs) {
      const k = dayKey(new Date(j.createdAt));
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const activeDays = counts.size;

    // days where the (current) daily goal was reached
    const metSet = new Set<string>();
    for (const [k, c] of counts) if (c >= goal) metSet.add(k);
    const daysGoalMet = metSet.size;

    // current streak of goal-met days ending today (or yesterday, so it does
    // not reset to zero before you have applied today)
    let currentStreak = 0;
    {
      const cursor = new Date();
      if (!metSet.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
      while (metSet.has(dayKey(cursor))) {
        currentStreak++;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    // longest run of consecutive goal-met days ever
    let bestStreak = 0;
    {
      const sorted = [...metSet].sort();
      let run = 0;
      let prev = "";
      for (const k of sorted) {
        if (prev) {
          const [py, pm, pd] = prev.split("-").map(Number);
          const expect = dayKey(new Date(py, pm - 1, pd + 1));
          run = expect === k ? run + 1 : 1;
        } else run = 1;
        bestStreak = Math.max(bestStreak, run);
        prev = k;
      }
    }

    const total = jobs.length;
    const interview = jobs.filter((j) => j.status === "interview").length;
    const offer = jobs.filter((j) => j.status === "offer").length;
    const responseRate = total ? Math.round(((interview + offer) / total) * 100) : 0;
    const offerRate = total ? Math.round((offer / total) * 100) : 0;

    const weekAgo = Date.now() - 7 * 86400000;
    const last7 = jobs.filter((j) => j.createdAt >= weekAgo).length;
    const avgPerActiveDay = activeDays ? total / activeDays : 0;

    // last 14 calendar days as a mini bar series
    const days: { key: string; label: string; count: number; met: boolean }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = dayKey(d);
      const c = counts.get(k) || 0;
      days.push({ key: k, label: String(d.getDate()), count: c, met: c >= goal });
    }
    const scaleMax = Math.max(goal, ...days.map((d) => d.count), 1);

    return {
      activeDays,
      daysGoalMet,
      currentStreak,
      bestStreak,
      responseRate,
      offerRate,
      last7,
      avgPerActiveDay,
      days,
      scaleMax,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, goal]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs
      .filter((j) => {
        if (fStatus !== "all" && j.status !== fStatus) return false;
        if (fType !== "all" && j.type !== fType) return false;
        if (q && !(`${j.company} ${j.role} ${j.notes}`.toLowerCase().includes(q))) return false;
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [jobs, query, fStatus, fType]);

  function addJob() {
    setAddErr(null);
    if (!nCompany.trim() || !nRole.trim()) {
      setAddErr("Company and role are required.");
      return;
    }
    if (jobs.length >= MAX_TRACKED_JOBS) {
      setAddErr(`Tracker is full (${MAX_TRACKED_JOBS} jobs). Delete some entries first.`);
      return;
    }
    const job: TrackedJob = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      company: nCompany.trim(),
      role: nRole.trim(),
      link: nLink.trim(),
      type: nType,
      status: nStatus,
      notes: "",
    };
    setJobs([job, ...jobs]);
    setNCompany("");
    setNRole("");
    setNLink("");
  }

  function updateJob(id: string, patch: Partial<TrackedJob>) {
    setJobs(jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }

  function removeJob(id: string) {
    if (!window.confirm("Delete this application from the tracker?")) return;
    setJobs(jobs.filter((j) => j.id !== id));
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-baseline gap-4">
          <span className="section-number">03</span>
          <div>
            <h2 className="font-display text-lg uppercase tracking-wider">Job tracker</h2>
            <p className="text-xs text-muted mt-1">
              Every application in one place. {jobs.length} / {MAX_TRACKED_JOBS} tracked, stored only in this browser.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted whitespace-nowrap">Daily goal</label>
          <input
            type="number"
            min={1}
            max={200}
            className="input !w-20 text-center"
            value={settings.dailyTarget}
            onChange={(e) =>
              setSettings({ dailyTarget: Math.max(1, Math.min(200, Number(e.target.value) || 1)) })
            }
          />
        </div>
      </div>

      {/* ---- Stats ---- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-3">
        <div className="rounded-xl border border-border bg-[#0a0a1c]/60 p-3 col-span-2 sm:col-span-3 lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] uppercase tracking-widest text-muted">Today</span>
            {goalHit && <span className="text-[10px] font-pixel text-emerald-300">GOAL HIT ✓</span>}
          </div>
          <div className="text-2xl font-display font-bold mt-1">
            {stats.today}
            <span className="text-sm text-muted font-sans font-normal"> / {goal}</span>
          </div>
          <div className="h-2 mt-2 rounded-full bg-[#0a0a1c] border border-border overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${goalPct}%`,
                background: goalHit
                  ? "linear-gradient(90deg,#34d399,#22d3ee)"
                  : "linear-gradient(90deg,#ec4899,#a855f7)",
              }}
            />
          </div>
        </div>
        {[
          { label: "Total", value: stats.total, cls: "text-white" },
          { label: "Applied", value: stats.byStatus.applied, cls: "text-sky-300" },
          { label: "Interview", value: stats.byStatus.interview, cls: "text-amber-300" },
          { label: "Offer", value: stats.byStatus.offer, cls: "text-emerald-300" },
          { label: "Rejected", value: stats.byStatus.rejected, cls: "text-red-300" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-[#0a0a1c]/60 p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted">{s.label}</div>
            <div className={`text-2xl font-display font-bold mt-1 ${s.cls}`}>{s.value}</div>
          </div>
        ))}
        <div className="rounded-xl border border-border bg-[#0a0a1c]/60 p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted">Rejection</div>
          <div className="text-2xl font-display font-bold mt-1 text-red-300">{stats.rejectionPct}%</div>
        </div>
      </div>

      {/* ---- Analytics ---- */}
      {stats.total > 0 && (
        <details open className="border border-border rounded-xl bg-[#0a0a1c]/50 mb-4 group">
          <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer select-none list-none">
            <h3 className="text-sm font-semibold">Analytics</h3>
            <span className="text-xs text-muted group-open:hidden">Show</span>
            <span className="text-xs text-muted hidden group-open:inline">Hide</span>
          </summary>

          <div className="px-4 pb-4">
            {/* metric tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              <div className="rounded-lg border border-border bg-[#0a0a1c]/60 p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted">Days goal met</div>
                <div className="text-xl font-display font-bold mt-1 text-emerald-300">
                  {analytics.daysGoalMet}
                </div>
                <div className="text-[10px] text-muted mt-0.5">of {analytics.activeDays} active</div>
              </div>
              <div className="rounded-lg border border-border bg-[#0a0a1c]/60 p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted">Current streak</div>
                <div className="text-xl font-display font-bold mt-1">
                  {analytics.currentStreak}
                  <span className="text-xs text-muted font-sans font-normal"> {analytics.currentStreak === 1 ? "day" : "days"}</span>
                </div>
                <div className="text-[10px] text-muted mt-0.5">goal-met in a row</div>
              </div>
              <div className="rounded-lg border border-border bg-[#0a0a1c]/60 p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted">Best streak</div>
                <div className="text-xl font-display font-bold mt-1">
                  {analytics.bestStreak}
                  <span className="text-xs text-muted font-sans font-normal"> {analytics.bestStreak === 1 ? "day" : "days"}</span>
                </div>
                <div className="text-[10px] text-muted mt-0.5">personal record</div>
              </div>
              <div className="rounded-lg border border-border bg-[#0a0a1c]/60 p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted">Response rate</div>
                <div className="text-xl font-display font-bold mt-1 text-amber-300">
                  {analytics.responseRate}%
                </div>
                <div className="text-[10px] text-muted mt-0.5">interview + offer</div>
              </div>
              <div className="rounded-lg border border-border bg-[#0a0a1c]/60 p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted">Offer rate</div>
                <div className="text-xl font-display font-bold mt-1 text-emerald-300">
                  {analytics.offerRate}%
                </div>
                <div className="text-[10px] text-muted mt-0.5">of all applications</div>
              </div>
              <div className="rounded-lg border border-border bg-[#0a0a1c]/60 p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted">Last 7 days</div>
                <div className="text-xl font-display font-bold mt-1">{analytics.last7}</div>
                <div className="text-[10px] text-muted mt-0.5">
                  {analytics.avgPerActiveDay.toFixed(1)} / active day
                </div>
              </div>
            </div>

            {/* 14-day activity chart */}
            <div className="rounded-lg border border-border bg-[#0a0a1c]/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium">Last 14 days</span>
                <span className="text-[10px] text-muted flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-sm bg-emerald-400" /> goal met
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-4 border-t border-dashed border-accent/70" /> goal ({goal})
                  </span>
                </span>
              </div>
              <div className="relative h-24 flex items-end gap-1">
                {/* goal threshold line */}
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-accent/50 pointer-events-none"
                  style={{ bottom: `${(goal / analytics.scaleMax) * 100}%` }}
                />
                {analytics.days.map((d) => (
                  <div
                    key={d.key}
                    className="flex-1 rounded-t-sm transition-all relative group/bar min-h-[2px]"
                    style={{
                      height: `${Math.max((d.count / analytics.scaleMax) * 100, d.count > 0 ? 4 : 1)}%`,
                      background: d.met
                        ? "linear-gradient(180deg,#34d399,#059669)"
                        : d.count > 0
                          ? "linear-gradient(180deg,#a855f7,#7c3aed)"
                          : "rgba(255,255,255,0.05)",
                    }}
                    title={`${d.key}: ${d.count} application${d.count === 1 ? "" : "s"}`}
                  />
                ))}
              </div>
              <div className="flex gap-1 mt-1">
                {analytics.days.map((d) => (
                  <div key={d.key} className="flex-1 text-center text-[9px] text-muted/70">
                    {d.label}
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-muted mt-2">
              Streaks and days-goal-met use your current daily goal ({goal}). Change the goal above to recalculate.
            </p>
          </div>
        </details>
      )}

      {/* ---- Add form ---- */}
      <div className="border border-border rounded-xl p-4 mb-4 bg-[#0a0a1c]/50">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
          <input
            className="input lg:col-span-1"
            placeholder="Company *"
            value={nCompany}
            onChange={(e) => setNCompany(e.target.value)}
          />
          <input
            className="input lg:col-span-2"
            placeholder="Role / job title *"
            value={nRole}
            onChange={(e) => setNRole(e.target.value)}
          />
          <input
            className="input lg:col-span-1"
            placeholder="Job link (optional)"
            value={nLink}
            onChange={(e) => setNLink(e.target.value)}
          />
          <div className="flex gap-2 lg:col-span-2">
            <select className="input" value={nType} onChange={(e) => setNType(e.target.value as JobType)}>
              {TYPE_KEYS.map((t) => (
                <option key={t} value={t}>{TYPE_META[t]}</option>
              ))}
            </select>
            <select className="input" value={nStatus} onChange={(e) => setNStatus(e.target.value as JobStatus)}>
              {STATUS_KEYS.map((s) => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
            <button className="btn-primary text-xs whitespace-nowrap" onClick={addJob}>
              + Add
            </button>
          </div>
        </div>
        {addErr && <div className="text-xs text-amber-400 mt-2">{addErr}</div>}
      </div>

      {/* ---- Filters ---- */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          className="input !w-64"
          placeholder="Search company, role, notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="input !w-auto" value={fStatus} onChange={(e) => setFStatus(e.target.value as "all" | JobStatus)}>
          <option value="all">All statuses</option>
          {STATUS_KEYS.map((s) => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
        <select className="input !w-auto" value={fType} onChange={(e) => setFType(e.target.value as "all" | JobType)}>
          <option value="all">All types</option>
          {TYPE_KEYS.map((t) => (
            <option key={t} value={t}>{TYPE_META[t]}</option>
          ))}
        </select>
        {(query || fStatus !== "all" || fType !== "all") && (
          <span className="text-xs text-muted">
            {filtered.length} match{filtered.length === 1 ? "" : "es"}
          </span>
        )}
      </div>

      {/* ---- Table ---- */}
      {filtered.length === 0 ? (
        <div className="text-sm text-muted italic border border-dashed border-border rounded-md p-6 text-center">
          {jobs.length === 0
            ? "No applications yet. Add one above, or generate a cover letter and hit “Track application”."
            : "Nothing matches these filters."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-muted border-b border-border">
                <th className="py-2 pr-2 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Company</th>
                <th className="py-2 pr-3 font-medium">Role</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Notes</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.slice(0, showCount).map((j, idx) => (
                <tr key={j.id} className="hover:bg-white/[0.02]">
                  <td className="py-2 pr-2 text-muted text-xs">{idx + 1}</td>
                  <td className="py-2 pr-3 text-xs text-muted whitespace-nowrap">
                    {new Date(j.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-3 font-medium">{j.company}</td>
                  <td className="py-2 pr-3">
                    {j.link ? (
                      <a
                        href={/^https?:\/\//i.test(j.link) ? j.link : `https://${j.link}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:underline"
                      >
                        {j.role}
                      </a>
                    ) : (
                      j.role
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      className="input !py-1 !px-2 text-xs !w-auto"
                      value={j.type}
                      onChange={(e) => updateJob(j.id, { type: e.target.value as JobType })}
                    >
                      {TYPE_KEYS.map((t) => (
                        <option key={t} value={t}>{TYPE_META[t]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      className={`!py-1 !px-2 text-xs rounded-md border ${STATUS_META[j.status].cls} bg-[#0a0a1c]`}
                      value={j.status}
                      onChange={(e) => updateJob(j.id, { status: e.target.value as JobStatus })}
                    >
                      {STATUS_KEYS.map((s) => (
                        <option key={s} value={s}>{STATUS_META[s].label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      className="input !py-1 !px-2 text-xs min-w-[120px]"
                      placeholder="—"
                      value={j.notes}
                      onChange={(e) => updateJob(j.id, { notes: e.target.value })}
                    />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      className="text-muted hover:text-red-400 text-xs px-2"
                      title="Delete"
                      onClick={() => removeJob(j.id)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > showCount && (
            <div className="text-center mt-3">
              <button className="btn-soft text-xs" onClick={() => setShowCount((c) => c + 100)}>
                Show more ({filtered.length - showCount} hidden)
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
