import { createElement as h } from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { buildPdfFilename, getDocumentType, pdfRequestSchema } from "@/lib/document";

// Raw body cap (bytes). 30,000 characters can be up to ~120 KB in UTF-8, so allow some headroom.
const MAX_BODY_BYTES = 150_000;

const FOOTER_TEXT = "Draft for informational purposes only. Not legal advice. Review by a qualified lawyer is recommended.";

// The built-in PDF fonts only cover Latin characters (plus common punctuation).
// Text in other scripts (for example Urdu) would print as garbage, so we reject it with a clear message.
const UNSUPPORTED_CHARS = /[^\n\r\t -~ -ÿ–—‘’“”•…]/;

const styles = StyleSheet.create({
  page: {
    paddingTop: 72, // 1 inch margins on all sides
    paddingBottom: 80,
    paddingHorizontal: 72,
    fontFamily: "Times-Roman",
    fontSize: 11.5,
    color: "#111111",
  },
  title: {
    fontFamily: "Times-Bold",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  // lineHeight is set here, not on the page: a page-level lineHeight made the fixed footer disappear.
  paragraph: { marginBottom: 8, lineHeight: 1.5 },
  spacer: { height: 8 },
  footer: {
    position: "absolute",
    left: 72,
    right: 72,
    bottom: 32,
    borderTopWidth: 0.5,
    borderTopColor: "#999999",
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#555555",
  },
  footerText: { width: "82%" },
});

/** First non-empty line is the title; everything after it is the body. */
function splitTitle(content: string, fallback: string) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const firstIndex = lines.findIndex((l) => l.trim() !== "");
  if (firstIndex === -1) return { title: fallback, bodyLines: [] as string[] };
  const first = lines[firstIndex].trim();
  // A very long first line is probably body text, not a title.
  if (first.length > 120) return { title: fallback, bodyLines: lines.slice(firstIndex) };
  return { title: first, bodyLines: lines.slice(firstIndex + 1) };
}

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "Invalid request format." }, 415);
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return json({ error: "The document is too large to export." }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid request format." }, 400);
  }

  const parsed = pdfRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, 400);
  }

  const { documentType, content } = parsed.data;

  if (UNSUPPORTED_CHARS.test(content)) {
    return json(
      {
        error:
          "The document contains characters the PDF font cannot display (for example Urdu or other non-Latin scripts). Please use English/Latin text, or copy the text to a word processor.",
      },
      422
    );
  }

  const typeInfo = getDocumentType(documentType);
  const { title, bodyLines } = splitTitle(content, typeInfo?.label ?? "Document");

  try {
    const doc = h(
      Document,
      { title, author: "Legal Drafting Assistant" },
      h(
        Page,
        { size: "A4", style: styles.page },
        h(Text, { style: styles.title }, title),
        ...bodyLines.map((line, i) =>
          line.trim() === ""
            ? h(View, { key: i, style: styles.spacer })
            : h(Text, { key: i, style: styles.paragraph }, line)
        ),
        h(
          View,
          { style: styles.footer, fixed: true },
          h(Text, { style: styles.footerText }, FOOTER_TEXT),
          h(Text, {
            render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `Page ${pageNumber} of ${totalPages}`,
          })
        )
      )
    );

    const buffer = await renderToBuffer(doc);
    const filename = buildPdfFilename(documentType);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    // Details stay on the server; never log the document text.
    console.error("PDF generation failed");
    return json({ error: "PDF export failed. Your text is safe; please try again." }, 500);
  }
}
