"use client";

import { useId, useRef, useState } from "react";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const MAX_BYTES = 5 * 1024 * 1024;

export async function uploadImage(file: File): Promise<{ url?: string; error?: string }> {
  if (file.size > MAX_BYTES) return { error: `${file.name} is larger than 5 MB.` };
  const body = new FormData();
  body.append("file", file);
  try {
    const res = await fetch("/api/uploads", { method: "POST", body, credentials: "include" });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { error: data?.detail ?? `Upload failed (${res.status}).` };
    return { url: data.url as string };
  } catch {
    return { error: "Upload failed. Check your connection." };
  }
}

/**
 * Drop or pick image files. Uploads each one and reports the hosted URL.
 * `multiple` allows several files at once (up to `remaining`).
 */
export function ImageDropzone({
  onUploaded,
  multiple = false,
  remaining = 1,
  disabled = false,
  label,
  compact = false,
}: {
  onUploaded: (url: string) => void;
  multiple?: boolean;
  remaining?: number;
  disabled?: boolean;
  label: string;
  compact?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handle(files: FileList | null) {
    if (!files?.length || disabled) return;
    setError(null);
    const picked = Array.from(files).slice(0, multiple ? remaining : 1);
    if (files.length > picked.length) setError(`Only ${remaining} more image${remaining === 1 ? "" : "s"} allowed.`);
    setBusy(picked.length);
    for (const file of picked) {
      const result = await uploadImage(file);
      if (result.url) onUploaded(result.url);
      else setError(result.error ?? "Upload failed.");
      setBusy((n) => n - 1);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handle(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600 ${
          compact ? "px-4 py-5" : "px-6 py-8"
        } ${
          disabled
            ? "cursor-not-allowed border-zinc-200 bg-zinc-50 opacity-60"
            : dragging
              ? "border-brand-600 bg-brand-50"
              : "border-zinc-300 bg-zinc-50/60 hover:border-ink hover:bg-white"
        }`}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT}
          multiple={multiple}
          disabled={disabled || busy > 0}
          className="sr-only"
          onChange={(e) => void handle(e.target.files)}
        />
        <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink text-signal-300">
          {busy > 0 ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-signal-300 border-t-transparent" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4m0 0-4 4m4-4 4 4" />
              <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
            </svg>
          )}
        </span>
        <span className="text-sm font-semibold text-ink">
          {busy > 0 ? `Uploading ${busy > 1 ? `${busy} images` : "image"}…` : label}
        </span>
        <span className="text-xs text-zinc-500">
          Drop {multiple ? "images" : "an image"} here or <span className="font-semibold text-brand-700 underline underline-offset-2">browse</span> · PNG, JPG, WebP, GIF · up to 5 MB
        </span>
      </label>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
