# Project notes

Legal drafting MVP: Next.js App Router + TypeScript + Tailwind, Gemini API for drafting, @react-pdf/renderer for PDFs.

- AI provider is **Gemini** (`@google/genai`). Do not switch it without being asked.
- `GEMINI_API_KEY` lives only in `.env.local` and is read only in server code (`lib/ai.ts`). Never use `NEXT_PUBLIC_` for secrets and never commit `.env.local`.
- Keep the file layout: `app/page.tsx`, `app/api/draft/route.ts`, `app/api/pdf/route.ts`, `lib/ai.ts`, `lib/document.ts`.
- Validation schemas live in `lib/document.ts` and are used by both browser and server.
- The model must never invent laws, citations, or legal requirements; missing details become `[PLACEHOLDERS]`.
- Before finishing a change run `npm run lint` and `npm run build`.
