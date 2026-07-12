"use client";

import { AlertCircle, FileText, UploadCloud, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type DragEvent } from "react";

export type FileDropValue = File | null;

type FileDropFieldProps = {
  /** Human label shown above the field. */
  label: string;
  /** Current selected file (controlled by the parent). */
  file: FileDropValue;
  onFileChange: (file: FileDropValue) => void;
  /** Accepted MIME types. Defaults to images + PDF. */
  accept?: string[];
  /** Max size in megabytes. Defaults to 5. */
  maxSizeMB?: number;
  required?: boolean;
  hint?: string;
};

const DEFAULT_ACCEPT = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function prettySize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileDropField({
  label,
  file,
  onFileChange,
  accept = DEFAULT_ACCEPT,
  maxSizeMB = 5,
  required,
  hint,
}: FileDropFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Build (and revoke) an object URL for image previews.
  useEffect(() => {
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [file]);

  const acceptAttr = accept.join(",");
  const acceptLabel = accept.includes("application/pdf")
    ? "JPG, PNG, WEBP or PDF"
    : "JPG, PNG or WEBP";

  function validateAndSet(next: File | null) {
    setError("");
    if (!next) {
      onFileChange(null);
      return;
    }
    if (!accept.includes(next.type)) {
      setError(`Unsupported file type. Please upload ${acceptLabel}.`);
      return;
    }
    if (next.size > maxSizeMB * 1024 * 1024) {
      setError(`File is too large. Maximum size is ${maxSizeMB} MB.`);
      return;
    }
    onFileChange(next);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    validateAndSet(dropped);
  }

  function clear() {
    validateAndSet(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const isImage = file?.type.startsWith("image/");

  return (
    <div>
      <label
        htmlFor={inputId}
        className="block mb-2 text-xs font-head font-semibold uppercase tracking-widest text-secondary-foreground"
      >
        {label}
        {required ? (
          <span className="ml-1 text-primary">*</span>
        ) : (
          <span className="ml-1.5 text-muted-foreground normal-case tracking-normal">(optional)</span>
        )}
      </label>

      {file ? (
        /* --- Selected-file card --- */
        <div className="flex items-center gap-4 rounded-md border border-primary/30 bg-secondary/50 p-3">
          {isImage && previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- transient local blob preview, not an app asset
            <img
              src={previewUrl}
              alt="Selected file preview"
              className="h-16 w-16 shrink-0 rounded object-cover border border-line"
            />
          ) : (
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded bg-primary/10 text-primary-glow border border-line">
              <FileText size={26} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-foreground font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{prettySize(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={clear}
            aria-label="Remove file"
            className="shrink-0 rounded-md border border-line p-2 text-secondary-foreground hover:text-foreground hover:border-primary/50 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        /* --- Drop zone --- */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          className={`flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-7 text-center cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
            dragging
              ? "border-primary bg-primary/10"
              : "border-line bg-secondary/40 hover:border-primary/50 hover:bg-secondary/60"
          }`}
        >
          <UploadCloud size={26} className="text-primary-glow" />
          <p className="text-sm text-secondary-foreground">
            <span className="text-foreground font-medium">Click to upload</span> or drag &amp; drop
          </p>
          <p className="text-xs text-muted-foreground">
            {acceptLabel} · up to {maxSizeMB} MB
          </p>
        </div>
      )}

      {/* Hidden native input for the browse dialog. */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={acceptAttr}
        className="sr-only"
        onChange={(e) => validateAndSet(e.target.files?.[0] ?? null)}
      />

      {hint && !error && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-primary-glow">
          <AlertCircle size={13} /> {error}
        </p>
      )}
    </div>
  );
}
