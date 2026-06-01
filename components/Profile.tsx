"use client";

import { useEffect, useState } from "react";
import { profileStore, ProfileData } from "@/lib/storage";
import FileDrop from "./FileDrop";

export default function Profile({
  value,
  onChange,
}: {
  value: ProfileData;
  onChange: (v: ProfileData) => void;
}) {
  const [showRef, setShowRef] = useState(false);

  useEffect(() => {
    profileStore.save(value);
  }, [value]);

  function update<K extends keyof ProfileData>(key: K, v: ProfileData[K]) {
    onChange({ ...value, [key]: v });
  }

  const resumeWords = value.resume.trim() ? value.resume.trim().split(/\s+/).length : 0;

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold">1 — Your profile</h2>
          <p className="text-xs text-muted">Reused across every letter. Stored only in this browser.</p>
        </div>
        {value.resume && (
          <span className="tag">{resumeWords} words in resume</span>
        )}
      </div>

      <div className="space-y-5">
        <div>
          <label className="label">Resume (PDF or .docx)</label>
          <FileDrop
            accept=".pdf,.docx,.txt,.md"
            label={value.resumeFileName ? `Replace: ${value.resumeFileName}` : "Drop a resume or click to upload"}
            hint="Parsed to plain text on upload. Editable below."
            onText={(text, name) => {
              onChange({ ...value, resume: text, resumeFileName: name });
            }}
          />
          {value.resume && (
            <textarea
              className="textarea mt-3"
              rows={10}
              value={value.resume}
              onChange={(e) => update("resume", e.target.value)}
              placeholder="Resume text will appear here..."
            />
          )}
        </div>

        <div>
          <label className="label">Always-applied instructions</label>
          <textarea
            className="textarea"
            rows={4}
            placeholder="Tone, things to emphasize, must-avoid phrases, hard constraints. e.g. 'Lead with backend systems experience; downplay early-career retail roles; keep the tone warm but direct; never use the word leverage.'"
            value={value.instructions}
            onChange={(e) => update("instructions", e.target.value)}
          />
          {!value.instructions.trim() && (
            <p className="text-xs text-muted mt-2">
              Empty — a built-in default prompt (standard one-page business letter, verbatim rule for personal details, sample-letter format takes precedence if attached) will be used.
            </p>
          )}
        </div>

        <div>
          <button
            type="button"
            className="text-xs text-accent hover:underline"
            onClick={() => setShowRef((s) => !s)}
          >
            {showRef ? "Hide" : "Add"} reference cover letter (optional, for style)
          </button>
          {showRef && (
            <div className="mt-3 space-y-3">
              <FileDrop
                accept=".pdf,.docx,.txt,.md"
                label={
                  value.referenceFileName
                    ? `Replace: ${value.referenceFileName}`
                    : "Upload a past cover letter to emulate its voice"
                }
                onText={(text, name) => {
                  onChange({ ...value, referenceLetter: text, referenceFileName: name });
                }}
              />
              {value.referenceLetter && (
                <textarea
                  className="textarea"
                  rows={6}
                  value={value.referenceLetter}
                  onChange={(e) => update("referenceLetter", e.target.value)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
