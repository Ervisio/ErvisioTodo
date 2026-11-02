"use client";

import { apiFetch as fetch } from "@/lib/client";

import { useRef, useState } from "react";
import { readJsonResponse } from "@/lib/http/readJsonResponse";

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  /** CDN subfolder where the file will be saved (default: 'uploads') */
  subfolder?: string;
  /** File input accept attribute (default: 'image/*') */
  accept?: string;
  className?: string;
}

/**
 * URL input field with an integrated "Carica" button.
 * Uploads the chosen file to /api/admin/upload and fills the input with the returned CDN URL.
 * Shows a small image preview when the current value looks like an image URL.
 */
export function ImageUploadField({
  label,
  value,
  onChange,
  error,
  hint,
  required,
  placeholder,
  subfolder = "uploads",
  accept = "image/*",
  className = "",
}: ImageUploadFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("subfolder", subfolder);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: form,
      });
      const json = await readJsonResponse<{
        success: boolean;
        url?: string;
        error?: string;
      }>(res);
      if (!json.success || !json.url)
        throw new Error(json.error ?? "Errore upload");
      onChange(json.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Errore");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const displayedError = error ?? uploadError ?? null;
  const isImage = value.trim() !== "" && !/\.(mp4|webm|mov|avi)$/i.test(value);

  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-ink-dim">
        {label}
        {required && <span className="ml-1 text-rose-400">*</span>}
      </label>

      <div className="flex gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => {
            setUploadError(null);
            onChange(e.target.value);
          }}
          placeholder={placeholder ?? "https://..."}
          className={`flex-1 min-w-0 rounded-lg border border-white/[0.04] bg-white/5 px-3 py-2 text-sm text-white placeholder:text-ink-faint focus:border-orange-500/30 focus:outline-none focus:ring-1 focus:ring-orange-500/15 ${
            displayedError ? "border-rose-500/30" : ""
          }`}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="shrink-0 rounded-lg border border-white/[0.04] bg-white/5 px-3 py-2 text-xs text-ink-dim transition hover:bg-white/10 hover:text-white disabled:opacity-40"
        >
          {uploading ? (
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-white/40 border-t-white" />
          ) : (
            "Carica"
          )}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFile}
      />

      {/* Preview */}
      {isImage && value && (
        <div className="mt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="preview"
            className="h-14 w-auto rounded border border-white/[0.04] object-cover"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        </div>
      )}

      {hint && !displayedError && (
        <p className="mt-1 text-xs text-ink-faint">{hint}</p>
      )}
      {displayedError && (
        <p className="mt-1 text-xs text-rose-400">{displayedError}</p>
      )}
    </div>
  );
}
