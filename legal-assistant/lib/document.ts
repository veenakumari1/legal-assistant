import { z } from "zod";

/**
 * Shared by the browser (form validation) and, in Stage B, the server
 * (/api/draft re-validates the same schema, because browser checks can be bypassed).
 */

export const DOCUMENT_TYPES = [
  {
    id: "nda",
    label: "Non-Disclosure Agreement (NDA)",
    description: "Keeps shared business information confidential.",
    partyALabel: "Disclosing party",
    partyBLabel: "Receiving party",
    purposeLabel: "Purpose of disclosure",
    purposePlaceholder: "e.g. Evaluating a possible software development partnership",
  },
  {
    id: "service-agreement",
    label: "Service Agreement",
    description: "Sets scope, payment, and terms for services provided.",
    partyALabel: "Service provider",
    partyBLabel: "Client",
    purposeLabel: "Services to be provided",
    purposePlaceholder: "e.g. Design and development of a company website",
  },
  {
    id: "business-letter",
    label: "Formal Business Letter",
    description: "A professional letter such as a notice, request, or follow-up.",
    partyALabel: "Sender",
    partyBLabel: "Recipient",
    purposeLabel: "Purpose of the letter",
    purposePlaceholder: "e.g. Request for payment of an overdue invoice",
  },
] as const;

export type DocumentTypeId = (typeof DOCUMENT_TYPES)[number]["id"];

export const DOCUMENT_TYPE_IDS = DOCUMENT_TYPES.map((t) => t.id) as [
  DocumentTypeId,
  ...DocumentTypeId[],
];

export const LIMITS = {
  name: 120,
  jurisdiction: 120,
  purpose: 600,
  details: 2000,
} as const;

export const draftRequestSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPE_IDS, {
    message: "Please choose a document type.",
  }),
  partyA: z
    .string()
    .trim()
    .min(1, "This name is required.")
    .max(LIMITS.name, `Keep this under ${LIMITS.name} characters.`),
  partyB: z
    .string()
    .trim()
    .min(1, "This name is required.")
    .max(LIMITS.name, `Keep this under ${LIMITS.name} characters.`),
  jurisdiction: z
    .string()
    .trim()
    .min(2, "Please enter a country or region, e.g. Pakistan.")
    .max(LIMITS.jurisdiction, `Keep this under ${LIMITS.jurisdiction} characters.`),
  purpose: z
    .string()
    .trim()
    .min(10, "Please describe this in at least a short sentence.")
    .max(LIMITS.purpose, `Keep this under ${LIMITS.purpose} characters.`),
  details: z
    .string()
    .trim()
    .max(LIMITS.details, `Keep this under ${LIMITS.details} characters.`)
    .optional()
    .default(""),
});

export type DraftRequest = z.infer<typeof draftRequestSchema>;

/** Largest document we will turn into a PDF (characters). */
export const MAX_PDF_CHARS = 30_000;

/** Request body for /api/pdf: the CURRENT (possibly edited) text and its document type. */
export const pdfRequestSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPE_IDS, { message: "Unknown document type." }),
  content: z
    .string()
    .trim()
    .min(1, "The document is empty. Add some text before exporting.")
    .max(MAX_PDF_CHARS, `The document is too long to export (limit ${MAX_PDF_CHARS.toLocaleString()} characters).`),
});

export type PdfRequest = z.infer<typeof pdfRequestSchema>;

/** Builds a safe download name like "nda-draft-2026-10-10.pdf". */
export function buildPdfFilename(documentType: string, date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  const slug = documentType.replace(/[^a-z0-9-]/gi, "").toLowerCase() || "document";
  return `${slug}-draft-${day}.pdf`;
}

export type FieldName = keyof DraftRequest;
export type FieldErrors = Partial<Record<FieldName, string>>;

export function getDocumentType(id: string) {
  return DOCUMENT_TYPES.find((t) => t.id === id);
}

/** Turns a zod error into a simple { fieldName: "message" } map for the form. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as FieldName | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
