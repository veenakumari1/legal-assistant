# Legal Drafting Assistant (MVP)

Fill in a short form, get an AI-written first draft of a legal document, edit it in the browser, and export it as a PDF.

**Not legal advice.** Drafts are AI-generated starting points and must be reviewed by a qualified lawyer before use.

## Tech

- Next.js (App Router), TypeScript, Tailwind CSS
- Google Gemini API via `@google/genai` (server side only)
- `zod` for validation (same schema in browser and server)
- `@react-pdf/renderer` for PDF generation (server side)
- `server-only` so server files can never be imported into browser code

## Setup

```bash
npm install
cp .env.example .env.local     # then open .env.local and paste your key
npm run dev                    # http://localhost:3000
```

Get a Gemini API key from Google AI Studio (https://aistudio.google.com/apikey).

### Environment variables (`.env.local`, never committed)

| Name | Purpose |
|---|---|
| `GEMINI_API_KEY` | Your Gemini key. Server only. Never prefix with `NEXT_PUBLIC_`. |
| `GEMINI_MODEL` | Model name (default `gemini-2.5-flash`). Check Google's docs for current names. |
| `MAX_OUTPUT_TOKENS` | Cap on draft length (default 4000, max 8000). |
| `RATE_LIMIT_PER_MINUTE` | Draft requests allowed per IP per minute (default 5). |

## Commands

```bash
npm run dev      # development server
npm run lint     # lint
npm run build    # production build (also type-checks)
npm start        # run the production build
```

## How it works

```
Browser (app/page.tsx)
  -> POST /api/draft  {documentType, partyA, partyB, jurisdiction, purpose, details}
     app/api/draft/route.ts: size cap, Zod validation, rate limit
     lib/ai.ts: calls Gemini with the secret key
  <- {content}  (or a friendly error)
User edits the text in the browser (kept in React state)
  -> POST /api/pdf  {documentType, content}   (the CURRENT edited text)
     app/api/pdf/route.ts: validation, builds the PDF
  <- PDF file download
```

## Files

| File | Purpose |
|---|---|
| `app/page.tsx` | The dashboard: form, loading/error states, editable draft, Export PDF button |
| `app/layout.tsx`, `app/globals.css` | Page shell and styles |
| `app/api/draft/route.ts` | Server endpoint for AI drafting |
| `app/api/pdf/route.ts` | Server endpoint for PDF export (also contains the PDF layout) |
| `lib/document.ts` | Document types, field limits, Zod schemas, filename helper |
| `lib/ai.ts` | Gemini client, system prompt, prompt builder, error mapping (server only) |
| `next.config.ts` | Basic security headers |
| `.env.example` | Safe template for your environment variables |

## How to test

1. Submit the empty form: you should see field errors.
2. Fill the form and click **Generate Draft**: a skeleton shows while loading, then the draft appears with `[PLACEHOLDERS]` for missing details.
3. Edit the text. **Reset to generated** restores the original.
4. Click **Export PDF**: a file such as `nda-draft-2026-10-10.pdf` downloads with a title, margins, page numbers, and a disclaimer footer.
5. Remove `GEMINI_API_KEY` and restart: drafting shows a clear "not configured" message.

## Limitations (important)

- **Not legal advice.** The prompt forbids inventing laws or citations, but AI can still make mistakes. Review everything.
- Laws and formalities (stamp paper, witnesses, notarization, registration) differ by place; a PDF alone may not make a document valid.
- PDF export supports Latin text only (English). Urdu or other scripts are rejected with a clear message because the built-in PDF fonts cannot display them.
- Your input is sent to Google's Gemini API. Do not enter ID numbers, bank details, or other highly sensitive data. Free and paid Gemini tiers have different data-use terms; check the current terms before using real client documents.
- Rate limiting is in memory and per server instance (fine for an MVP, not for scaled deployments). The PDF endpoint has no rate limit yet.
- Nothing is stored: no accounts, database, or history.

## Not in the MVP (future)

User accounts, saved documents and history, subscriptions and payments, streaming responses, rich-text editor, e-signatures, team workspaces, more document types, and non-Latin PDF fonts.
