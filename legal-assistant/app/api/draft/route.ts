import { DraftError, generateDraft } from "@/lib/ai";
import { draftRequestSchema, toFieldErrors } from "@/lib/document";

// Hard cap on the raw request body (bytes). Our limits add up to ~3 KB of text.
const MAX_BODY_BYTES = 12_000;

// Very simple in-memory rate limiter (per IP, per minute).
// Fine for a single-server MVP; use a shared store such as Redis when you deploy to several servers.
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const limit = Number(process.env.RATE_LIMIT_PER_MINUTE) || 5;
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= limit) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  // Keep the map from growing forever.
  if (hits.size > 5000) hits.clear();
  return false;
}

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (isRateLimited(ip)) {
    return json({ error: "Too many requests. Please wait a minute and try again." }, 429);
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "Invalid request format." }, 415);
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return json({ error: "Your request is too large. Please shorten your details." }, 413);
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return json({ error: "Your request is too large. Please shorten your details." }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid request format." }, 400);
  }

  // Re-validate on the server: browser checks can be bypassed.
  const parsed = draftRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "Please fix the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) },
      400
    );
  }

  try {
    const content = await generateDraft(parsed.data);
    return json({ content }, 200);
  } catch (err) {
    if (err instanceof DraftError) {
      return json({ error: err.message }, err.status);
    }
    console.error("Unexpected error in /api/draft");
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
