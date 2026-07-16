import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import JSZip from "jszip";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const SYSTEM = `You are an expert resume writer. You will receive the paragraphs of a candidate's CV (extracted from their Word document, numbered) and a job description (JD). Your job is to EDIT the CV in place: you return replacement text for individual paragraphs only. The document's design, fonts, layout, photo, and structure stay untouched — you can only change the words inside existing paragraphs, or delete a paragraph.

Return STRICT JSON, nothing else, in this shape:
{"edits":[{"i":<paragraph index>,"text":"<replacement text>"}]}

- Include ONLY paragraphs you are changing. Unlisted paragraphs stay exactly as they are.
- "text" must be a single line (no newline characters). It replaces the paragraph's entire text.
- Use "text": "" to DELETE a paragraph (for entries irrelevant to this JD).
- Never edit or delete paragraphs containing the candidate's name or contact details (address, phone, email, links).
- Do not change section headings.
- No markdown, no ** markers, no em or en dashes anywhere; use commas, colons, or parentheses.

Content rules:
1. NO FALSE INFORMATION. Every fact must come from the existing CV text. Rephrase and reframe; never fabricate. Never add a tool, skill, or metric that is not already in the CV, not even hedged as "familiar" or "exposure to". Renaming to the JD's synonym is allowed (Postgres -> PostgreSQL); adding is not.
2. Keep every employer, title, project name, date, location, degree, institution, and grade exactly as written.
3. ATS ALIGNMENT: rephrase summary and bullets to mirror the JD's exact keywords wherever the CV genuinely supports them. Surface buried but relevant skills into prominent wording.
4. If the CV has a summary/profile paragraph, rewrite it: 2-3 sentences, concrete tools and numbers, no self-praising adjectives (passionate, driven, results-oriented), and end it with one availability sentence matched to the job type using only enrollment/date facts in the CV (e.g. "Available as a working student, 15-20 hours per week").
5. BULLETS: where real numbers exist use "Accomplished X by doing Y, resulting in Z". Otherwise a direct bullet starting with a strong action verb. Good bullets may stay untouched.
6. Shrink or delete bullets/entries irrelevant to this JD; expand the most relevant ones.
7. TONE: plain, crisp, human. Banned: testament, beacon, delve, spearheaded, fostered, vibrant, leveraged, seamlessly, robust, cutting-edge, passionate, dynamic, synergy.
8. Remove "currently in semester X" phrasing if present.`;

type Edit = { i: number; text: string };

const P_REGEX = /<w:p\b[^>]*(?:\/>|>[\s\S]*?<\/w:p>)/g;
const T_REGEX = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;

function unescapeXml(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphText(pXml: string): string {
  let out = "";
  let m: RegExpExecArray | null;
  const re = new RegExp(T_REGEX.source, "g");
  while ((m = re.exec(pXml))) out += unescapeXml(m[1]);
  return out.trim();
}

// Put all replacement text into the first <w:t> (inherits that run's style);
// empty every other <w:t> in the paragraph.
function setParagraphText(pXml: string, newText: string): string {
  let first = true;
  return pXml.replace(new RegExp(T_REGEX.source, "g"), () => {
    if (first) {
      first = false;
      return `<w:t xml:space="preserve">${escapeXml(newText)}</w:t>`;
    }
    return `<w:t xml:space="preserve"></w:t>`;
  });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  let body: { docxBase64?: string; jobDescription?: string; company?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.docxBase64 || !body.jobDescription?.trim()) {
    return NextResponse.json(
      { error: "Original .docx and job description are required." },
      { status: 400 },
    );
  }

  // --- unpack the docx and index its paragraphs ---
  let zip: JSZip;
  let xml: string;
  try {
    zip = await JSZip.loadAsync(Buffer.from(body.docxBase64, "base64"));
    const doc = zip.file("word/document.xml");
    if (!doc) throw new Error("word/document.xml not found");
    xml = await doc.async("string");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unreadable file";
    return NextResponse.json(
      { error: `Couldn't open the .docx (${msg}). Re-upload the original file.` },
      { status: 422 },
    );
  }

  type Para = { start: number; end: number; xml: string; text: string; complex: boolean };
  const paras: Para[] = [];
  {
    const re = new RegExp(P_REGEX.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) {
      const pXml = m[0];
      paras.push({
        start: m.index,
        end: m.index + pXml.length,
        xml: pXml,
        text: paragraphText(pXml),
        // nested <w:p (text boxes etc.) — editing text is fine, deleting is not
        complex: pXml.indexOf("<w:p", 4) !== -1,
      });
    }
  }

  const numbered = paras
    .map((p, i) => ({ i, text: p.text }))
    .filter((p) => p.text.length > 0);

  if (numbered.length < 3) {
    return NextResponse.json(
      { error: "Couldn't find editable text paragraphs in this .docx." },
      { status: 422 },
    );
  }

  // --- ask the model for paragraph edits ---
  const user = [
    "<job_description"
      + (body.company ? ` company="${body.company.replace(/"/g, "'")}"` : "")
      + (body.role ? ` role="${body.role.replace(/"/g, "'")}"` : "")
      + ">",
    body.jobDescription.trim(),
    "</job_description>",
    "",
    "<cv_paragraphs>",
    JSON.stringify(numbered),
    "</cv_paragraphs>",
    "",
    "Return the edits JSON now.",
  ].join("\n");

  const client = new Anthropic({ apiKey });
  let edits: Edit[];
  try {
    const msg = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    const block = msg.content[0];
    const raw = block && block.type === "text" ? block.text : "";
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed.edits)) throw new Error("missing edits array");
    edits = parsed.edits.filter(
      (e: unknown): e is Edit =>
        typeof e === "object" && e !== null &&
        typeof (e as Edit).i === "number" &&
        typeof (e as Edit).text === "string",
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json(
      { error: `The model returned unusable edits (${msg}). Try again.` },
      { status: 502 },
    );
  }

  // --- apply edits back into the XML, last-to-first so offsets stay valid ---
  const editable = new Set(numbered.map((n) => n.i));
  const applied = edits
    .filter((e) => editable.has(e.i) && e.i >= 0 && e.i < paras.length)
    .sort((a, b) => b.i - a.i);

  let newXml = xml;
  for (const e of applied) {
    const p = paras[e.i];
    const clean = e.text.replace(/[\r\n]+/g, " ").replace(/[—–]/g, ", ").trim();
    let replacement: string;
    if (clean === "" && !p.complex) {
      replacement = ""; // delete the whole paragraph
    } else {
      replacement = setParagraphText(p.xml, clean);
    }
    newXml = newXml.slice(0, p.start) + replacement + newXml.slice(p.end);
  }

  zip.file("word/document.xml", newXml);
  const outBuf = await zip.generateAsync({ type: "nodebuffer" });

  // plain text of the edited CV, for the on-screen editor / rating / letter reuse
  const editMap = new Map(applied.map((e) => [e.i, e.text.replace(/[\r\n]+/g, " ").trim()]));
  const newText = paras
    .map((p, i) => (editMap.has(i) ? editMap.get(i)! : p.text))
    .filter((t) => t && t.length > 0)
    .join("\n");

  return NextResponse.json({
    docxBase64: outBuf.toString("base64"),
    text: newText,
    editsApplied: applied.length,
  });
}
