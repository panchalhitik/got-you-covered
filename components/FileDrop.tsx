"use client";

import { useRef, useState } from "react";

type Props = {
  accept: string;
  label: string;
  hint?: string;
  onText: (text: string, filename: string) => void;
  disabled?: boolean;
};

export default function FileDrop({ accept, label, hint, onText, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Parse failed");
      onText(data.text, data.name || file.name);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        onClick={() => !disabled && !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className={`cursor-pointer border border-dashed border-border rounded-md p-4 text-sm bg-[#0f1216] hover:border-accent/60 transition ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium">{busy ? "Parsing…" : label}</div>
            {hint && <div className="text-xs text-muted mt-0.5">{hint}</div>}
          </div>
          <button type="button" className="btn-soft text-xs" disabled={disabled || busy}>
            Choose file
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {err && <div className="text-xs text-red-400 mt-2">{err}</div>}
    </div>
  );
}
