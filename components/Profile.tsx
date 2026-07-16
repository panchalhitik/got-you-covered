"use client";

import { useState } from "react";
import { ProfileData } from "@/lib/storage";
import FileDrop from "./FileDrop";

export default function Profile({
  value,
  onChange,
  minimal = false,
}: {
  value: ProfileData;
  onChange: (v: ProfileData) => void;
  minimal?: boolean;
}) {
  const [showRef, setShowRef] = useState(false);

  // Persistence lives in the parent page (gated on hydration) — saving here
  // on mount would clobber localStorage with the empty initial state.

  function update<K extends keyof ProfileData>(key: K, v: ProfileData[K]) {
    onChange({ ...value, [key]: v });
  }

  const resumeWords = value.resume.trim() ? value.resume.trim().split(/\s+/).length : 0;

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-5 gap-3">
        <div className="flex items-baseline gap-4">
          <span className="section-number">01</span>
          <div>
            <h2 className="font-display text-lg uppercase tracking-wider">
              {minimal ? "Your CV" : "Your profile"}
            </h2>
            <p className="text-xs text-muted mt-1">
              {minimal
                ? "Upload the CV to rate and optimize. Stored only in this browser."
                : "Reused across every letter. Stored only in this browser."}
            </p>
          </div>
        </div>
        {value.resume && (
          <span className="tag">{resumeWords} words</span>
        )}
      </div>

      <div className="space-y-5">
        <div>
          <label className="label">Resume (PDF or .docx)</label>
          <FileDrop
            accept=".pdf,.docx,.txt,.md"
            label={value.resumeFileName ? `Replace: ${value.resumeFileName}` : "Drop a resume or click to upload"}
            hint={
              minimal
                ? "Upload as .docx to let the optimizer edit your original file, design intact."
                : "Parsed to plain text on upload. Editable below."
            }
            captureRaw
            onText={(text, name, docxBase64) => {
              onChange({
                ...value,
                resume: text,
                resumeFileName: name,
                resumeDocxBase64: docxBase64 || "",
              });
            }}
          />
          {minimal && value.resumeFileName && (
            <p className="text-xs mt-2">
              {value.resumeDocxBase64 ? (
                <span className="text-emerald-400">
                  ✓ Original .docx stored — optimizing will edit it in place (photo, fonts, layout preserved).
                </span>
              ) : (
                <span className="text-amber-400">
                  Text-only upload — the optimizer can only produce a plain re-formatted CV. Upload the .docx to keep your design.
                </span>
              )}
            </p>
          )}
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

        {!minimal && (
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
        )}

        {!minimal && (
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
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted truncate">
                      {value.referenceFileName || "Reference letter"} ·{" "}
                      {value.referenceLetter.trim().split(/\s+/).length} words
                    </span>
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Remove the reference cover letter? The text will be deleted from this browser.",
                          )
                        ) {
                          onChange({
                            ...value,
                            referenceLetter: "",
                            referenceFileName: "",
                          });
                        }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  <textarea
                    className="textarea"
                    rows={6}
                    value={value.referenceLetter}
                    onChange={(e) => update("referenceLetter", e.target.value)}
                  />
                </>
              )}
            </div>
          )}
        </div>
        )}
      </div>
    </section>
  );
}
