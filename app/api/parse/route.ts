import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    const name = (file as File).name || "upload";
    const buf = Buffer.from(await file.arrayBuffer());
    const lower = name.toLowerCase();

    let text = "";
    if (lower.endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse")).default;
      const out = await pdfParse(buf);
      text = out.text || "";
    } else if (lower.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const out = await mammoth.extractRawText({ buffer: buf });
      text = out.value || "";
    } else if (lower.endsWith(".txt") || lower.endsWith(".md")) {
      text = buf.toString("utf8");
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Upload a PDF, .docx, or .txt." },
        { status: 415 },
      );
    }

    text = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!text) {
      return NextResponse.json(
        { error: "Couldn't extract any text — the file may be scanned or image-based." },
        { status: 422 },
      );
    }

    return NextResponse.json({ text, name });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Parse failed: ${msg}` }, { status: 500 });
  }
}
