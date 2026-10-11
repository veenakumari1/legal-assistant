"use client";

import { useState } from "react";
import {
  buildPdfFilename,
  DOCUMENT_TYPES,
  LIMITS,
  draftRequestSchema,
  getDocumentType,
  toFieldErrors,
  type DocumentTypeId,
  type FieldErrors,
} from "@/lib/document";

type FormState = {
  documentType: DocumentTypeId;
  partyA: string;
  partyB: string;
  jurisdiction: string;
  purpose: string;
  details: string;
};

const INITIAL_FORM: FormState = {
  documentType: "nda",
  partyA: "",
  partyB: "",
  jurisdiction: "",
  purpose: "",
  details: "",
};

const inputClass =
  "mt-1 block w-full rounded-xl border bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function Home() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  // The current document text. The user can edit it, so this always holds the latest edits.
  const [draft, setDraft] = useState<string | null>(null);
  // The text exactly as the AI produced it, kept so "Reset to generated" works.
  const [generated, setGenerated] = useState<string | null>(null);

  // The document type the current draft was generated for (the dropdown may change afterwards).
  const [draftType, setDraftType] = useState<DocumentTypeId>("nda");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  // UI only: marks the "Export PDF" step as done in the workflow card.
  const [exported, setExported] = useState(false);

  const isEdited = draft !== null && generated !== null && draft !== generated;

  async function handleExport() {
    if (draft === null || exporting) return;
    if (draft.trim() === "") {
      setExportError("The document is empty. Add some text before exporting.");
      return;
    }
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Always the CURRENT text, including the user's edits.
        body: JSON.stringify({ documentType: draftType, content: draft }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setExportError(data?.error ?? "PDF export failed. Your text is safe; please try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildPdfFilename(draftType);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExported(true);
    } catch {
      setExportError("Could not reach the server. Check your connection; your text is safe.");
    } finally {
      setExporting(false);
    }
  }

  const docType = getDocumentType(form.documentType)!;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear the error for a field as soon as the user edits it.
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const result = draftRequestSchema.safeParse(form);
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      setApiError(null);
      return;
    }
    // Generating again replaces the text, so ask first if the user has made edits.
    if (
      isEdited &&
      !window.confirm("Generating a new draft will replace your edits. Continue?")
    ) {
      return;
    }

    setErrors({});
    setApiError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (data?.fieldErrors) setErrors(data.fieldErrors);
        setApiError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      if (typeof data?.content !== "string" || !data.content) {
        setApiError("The server returned an empty draft. Please try again.");
        return;
      }
      setDraft(data.content);
      setGenerated(data.content);
      setDraftType(result.data.documentType);
      setExportError(null);
      setExported(false);
    } catch {
      setApiError("Could not reach the server. Check your internet connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function fieldBorder(name: keyof FormState) {
    return errors[name] ? "border-red-400" : "border-slate-200";
  }

  // ---- Dashboard-only derived values (display only, no effect on behaviour) ----
  const trackedFields = [form.partyA, form.partyB, form.jurisdiction, form.purpose, form.details];
  const filledCount = trackedFields.filter((v) => v.trim() !== "").length;
  const progressPct = Math.round((filledCount / trackedFields.length) * 100);
  const placeholderCount = draft ? (draft.match(/\[[^\]\n]+\]/g) ?? []).length : 0;
  const charCount = draft ? draft.length : 0;

  const RING_R = 42;
  const RING_C = 2 * Math.PI * RING_R;

  const steps = [
    { label: "Add document details", done: filledCount > 0 },
    { label: "Generate the draft", done: draft !== null },
    { label: "Review and edit", done: isEdited },
    { label: "Export as PDF", done: exported },
  ];
  const stepsDone = steps.filter((s) => s.done).length;

  const fieldRows = [
    { label: "Party details", value: [form.partyA, form.partyB].filter((v) => v.trim() !== "").length, max: 2 },
    { label: "Jurisdiction", value: form.jurisdiction.trim() ? 1 : 0, max: 1 },
    { label: "Purpose", value: form.purpose.trim() ? 1 : 0, max: 1 },
    { label: "Extra details", value: form.details.trim() ? 1 : 0, max: 1 },
  ];

  const cardClass =
    "rounded-3xl border border-white/80 bg-white/80 shadow-[0_10px_40px_-12px_rgba(37,99,235,0.18)] backdrop-blur";

  return (
    <div className="min-h-screen px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-7xl rounded-[32px] border border-white/70 bg-gradient-to-br from-white/70 via-sky-50/70 to-blue-100/60 p-4 shadow-[0_30px_80px_-20px_rgba(30,64,175,0.28)] backdrop-blur-xl sm:p-7">
        {/* Top bar */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f2a5c] text-sm font-bold text-white shadow-sm"
            >
              LA
            </div>
            <span className="text-base font-semibold tracking-tight text-[#0f2a5c]">
              Legal Drafting Assistant
            </span>
          </div>

          <nav
            aria-label="Document type"
            className="order-last flex w-full gap-1 overflow-x-auto rounded-full border border-white/80 bg-white/70 p-1 shadow-sm sm:order-none sm:w-auto"
          >
            {DOCUMENT_TYPES.map((t) => {
              const active = t.id === form.documentType;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update("documentType", t.id)}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    active
                      ? "bg-[#2563eb] text-white shadow"
                      : "text-slate-600 hover:bg-white hover:text-[#0f2a5c]"
                  }`}
                >
                  {t.label.split(" (")[0]}
                </button>
              );
            })}
          </nav>

          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            MVP
          </span>
        </header>

        {/* Welcome + stats */}
        <section className="mt-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#0f2a5c] sm:text-4xl">
              Welcome to your drafting workspace
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-500">
              First drafts, ready to edit. Choose a document type, add the basics and export a
              clean PDF.
            </p>
          </div>
          <dl className="flex items-end gap-8">
            {[
              { label: "Fields filled", value: `${filledCount}/${trackedFields.length}` },
              { label: "Placeholders", value: placeholderCount },
              { label: "Characters", value: charCount.toLocaleString() },
            ].map((s) => (
              <div key={s.label}>
                <dd className="text-3xl font-semibold tabular-nums text-[#0f2a5c] sm:text-4xl">
                  {s.value}
                </dd>
                <dt className="mt-1 text-xs font-medium text-slate-500">{s.label}</dt>
              </div>
            ))}
          </dl>
        </section>

        <div
          role="note"
          className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900"
        >
          <strong>Not legal advice.</strong> Drafts are AI-generated starting points. Have a
          qualified lawyer review any document before you rely on or sign it.
        </div>

        <main className="mt-6 grid gap-5 lg:grid-cols-12">
          {/* Left: form */}
          <section
            aria-labelledby="form-title"
            className={`${cardClass} p-5 sm:p-6 lg:col-span-5`}
          >
            <h2 id="form-title" className="text-lg font-semibold text-[#0f2a5c]">
              Document details
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose a document type and tell us the basics. Anything you leave out becomes a
              placeholder you can fill in later.
            </p>

            <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-5">
              <div>
                <label htmlFor="documentType" className="text-sm font-medium text-slate-800">
                  Document type
                </label>
                <select
                  id="documentType"
                  value={form.documentType}
                  onChange={(e) => update("documentType", e.target.value as DocumentTypeId)}
                  className={`${inputClass} ${fieldBorder("documentType")}`}
                >
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">{docType.description}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="partyA" className="text-sm font-medium text-slate-800">
                    {docType.partyALabel}
                  </label>
                  <input
                    id="partyA"
                    type="text"
                    value={form.partyA}
                    maxLength={LIMITS.name + 50}
                    onChange={(e) => update("partyA", e.target.value)}
                    aria-invalid={!!errors.partyA}
                    aria-describedby={errors.partyA ? "partyA-error" : undefined}
                    placeholder="Full name or company"
                    className={`${inputClass} ${fieldBorder("partyA")}`}
                  />
                  {errors.partyA && (
                    <p id="partyA-error" className="mt-1 text-xs text-red-600">
                      {errors.partyA}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="partyB" className="text-sm font-medium text-slate-800">
                    {docType.partyBLabel}
                  </label>
                  <input
                    id="partyB"
                    type="text"
                    value={form.partyB}
                    maxLength={LIMITS.name + 50}
                    onChange={(e) => update("partyB", e.target.value)}
                    aria-invalid={!!errors.partyB}
                    aria-describedby={errors.partyB ? "partyB-error" : undefined}
                    placeholder="Full name or company"
                    className={`${inputClass} ${fieldBorder("partyB")}`}
                  />
                  {errors.partyB && (
                    <p id="partyB-error" className="mt-1 text-xs text-red-600">
                      {errors.partyB}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="jurisdiction" className="text-sm font-medium text-slate-800">
                  Jurisdiction
                </label>
                <input
                  id="jurisdiction"
                  type="text"
                  value={form.jurisdiction}
                  maxLength={LIMITS.jurisdiction + 50}
                  onChange={(e) => update("jurisdiction", e.target.value)}
                  aria-invalid={!!errors.jurisdiction}
                  aria-describedby={errors.jurisdiction ? "jurisdiction-error" : undefined}
                  placeholder="e.g. Pakistan"
                  className={`${inputClass} ${fieldBorder("jurisdiction")}`}
                />
                {errors.jurisdiction && (
                  <p id="jurisdiction-error" className="mt-1 text-xs text-red-600">
                    {errors.jurisdiction}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="purpose" className="text-sm font-medium text-slate-800">
                  {docType.purposeLabel}
                </label>
                <textarea
                  id="purpose"
                  rows={3}
                  value={form.purpose}
                  onChange={(e) => update("purpose", e.target.value)}
                  aria-invalid={!!errors.purpose}
                  aria-describedby={errors.purpose ? "purpose-error" : "purpose-count"}
                  placeholder={docType.purposePlaceholder}
                  className={`${inputClass} ${fieldBorder("purpose")}`}
                />
                <div className="mt-1 flex justify-between gap-2">
                  {errors.purpose ? (
                    <p id="purpose-error" className="text-xs text-red-600">
                      {errors.purpose}
                    </p>
                  ) : (
                    <span />
                  )}
                  <p
                    id="purpose-count"
                    className={`text-xs ${
                      form.purpose.length > LIMITS.purpose ? "text-red-600" : "text-slate-400"
                    }`}
                  >
                    {form.purpose.length}/{LIMITS.purpose}
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="details" className="text-sm font-medium text-slate-800">
                  Extra details <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  id="details"
                  rows={5}
                  value={form.details}
                  onChange={(e) => update("details", e.target.value)}
                  aria-invalid={!!errors.details}
                  aria-describedby={errors.details ? "details-error" : "details-count"}
                  placeholder="Dates, payment terms, duration, special conditions..."
                  className={`${inputClass} ${fieldBorder("details")}`}
                />
                <div className="mt-1 flex justify-between gap-2">
                  {errors.details ? (
                    <p id="details-error" className="text-xs text-red-600">
                      {errors.details}
                    </p>
                  ) : (
                    <span />
                  )}
                  <p
                    id="details-count"
                    className={`text-xs ${
                      form.details.length > LIMITS.details ? "text-red-600" : "text-slate-400"
                    }`}
                  >
                    {form.details.length}/{LIMITS.details}
                  </p>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Avoid ID numbers, bank details, or other highly sensitive data. Your input is
                  sent to an AI provider to write the draft.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {loading && (
                  <span
                    aria-hidden
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                )}
                {loading ? "Generating..." : "Generate Draft"}
              </button>

              {apiError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  {apiError}
                </div>
              )}
            </form>
          </section>

          {/* Right column */}
          <div className="flex flex-col gap-5 lg:col-span-7">
            <div className="grid gap-5 md:grid-cols-5">
              {/* Progress card */}
              <section
                aria-labelledby="progress-title"
                className={`${cardClass} p-5 md:col-span-3`}
              >
                <h2 id="progress-title" className="text-base font-semibold text-[#0f2a5c]">
                  Form progress
                </h2>
                <div className="mt-4 flex items-center gap-5">
                  <div className="relative h-28 w-28 shrink-0">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
                      <circle cx="50" cy="50" r={RING_R} fill="none" stroke="#dbeafe" strokeWidth="10" />
                      <circle
                        cx="50"
                        cy="50"
                        r={RING_R}
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={RING_C}
                        strokeDashoffset={RING_C * (1 - progressPct / 100)}
                        className="transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-semibold tabular-nums text-[#0f2a5c]">
                        {progressPct}%
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-slate-400">
                        complete
                      </span>
                    </div>
                  </div>
                  <ul className="min-w-0 flex-1 space-y-2.5">
                    {fieldRows.map((r) => (
                      <li key={r.label}>
                        <div className="flex justify-between text-xs text-slate-600">
                          <span>{r.label}</span>
                          <span className="tabular-nums text-slate-400">
                            {r.value}/{r.max}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-blue-100">
                          <div
                            className="h-full rounded-full bg-[#2563eb] transition-all duration-500"
                            style={{ width: `${(r.value / r.max) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              {/* Workflow card */}
              <section
                aria-labelledby="workflow-title"
                className="rounded-3xl bg-gradient-to-b from-[#12326e] to-[#0b1f47] p-5 text-white shadow-[0_14px_40px_-12px_rgba(11,31,71,0.6)] md:col-span-2"
              >
                <div className="flex items-center justify-between">
                  <h2 id="workflow-title" className="text-base font-semibold">
                    Workflow
                  </h2>
                  <span className="text-sm font-medium text-blue-200">
                    {Math.round((stepsDone / steps.length) * 100)}%
                  </span>
                </div>
                <ol className="mt-4 space-y-2.5">
                  {steps.map((s, i) => (
                    <li
                      key={s.label}
                      className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2 text-sm"
                    >
                      <span
                        aria-hidden
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          s.done ? "bg-emerald-400 text-[#0b1f47]" : "border border-white/40 text-white/70"
                        }`}
                      >
                        {s.done ? "✓" : i + 1}
                      </span>
                      <span className={s.done ? "text-white" : "text-blue-100/80"}>{s.label}</span>
                      <span className="sr-only">{s.done ? "(done)" : "(pending)"}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            {/* Draft preview */}
            <section
              aria-labelledby="preview-title"
              className={`${cardClass} flex min-h-[320px] flex-1 flex-col p-5 sm:p-6`}
            >
              <h2 id="preview-title" className="text-lg font-semibold text-[#0f2a5c]">
                Draft preview
              </h2>
              {loading ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-4 flex-1 animate-pulse space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-6"
                >
                  <span className="sr-only">Generating your draft...</span>
                  <div className="h-4 w-2/3 rounded bg-slate-200" />
                  <div className="h-3 w-full rounded bg-slate-200" />
                  <div className="h-3 w-11/12 rounded bg-slate-200" />
                  <div className="h-3 w-full rounded bg-slate-200" />
                  <div className="h-3 w-3/4 rounded bg-slate-200" />
                </div>
              ) : draft !== null ? (
                <div className="mt-4 flex flex-1 flex-col">
                  <label htmlFor="draft-editor" className="sr-only">
                    Document text (editable)
                  </label>
                  <textarea
                    id="draft-editor"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    spellCheck
                    className="min-h-[420px] w-full flex-1 resize-y rounded-2xl border border-slate-200 bg-white p-4 font-sans text-sm leading-relaxed text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      {draft.length.toLocaleString()} characters
                      {isEdited ? " · edited" : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => generated !== null && setDraft(generated)}
                      disabled={!isEdited}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reset to generated
                    </button>
                  </div>
                  {draft.trim() === "" && (
                    <p role="alert" className="mt-2 text-xs text-red-600">
                      The document is empty. Type something or reset to the generated draft.
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    Review every clause and fill in each [PLACEHOLDER] before using this document.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleExport}
                      disabled={exporting || draft.trim() === ""}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0f2a5c] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b1f47] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {exporting && (
                        <span
                          aria-hidden
                          className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                        />
                      )}
                      {exporting ? "Preparing PDF..." : "Export PDF"}
                    </button>
                    <span className="text-xs text-slate-500">
                      Exports exactly what is in the box above.
                    </span>
                  </div>
                  {exportError && (
                    <div
                      role="alert"
                      className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                    >
                      {exportError}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 flex flex-1 items-center justify-center rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-6 text-center">
                  <p className="max-w-sm text-sm text-slate-500">
                    Your generated draft will appear here, where you can edit it before exporting
                    to PDF.
                  </p>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
