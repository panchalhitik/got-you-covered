import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const SYSTEM = `You are an expert resume writer and career coach. EDIT the candidate's existing CV to align with the provided job description (JD). This is an in-place edit of their document, NOT a rewrite from a template. The result must read as the same document with sharper, better-targeted content.

STRUCTURE PRESERVATION (HIGHEST PRIORITY):
- Keep the original CV's section order, section headings (exact wording and casing), and overall layout. Do not rename, reorder, merge, add, or remove sections.
- Two allowed structural changes only: (a) removing or shrinking individual entries/bullets that are irrelevant to this JD, and (b) the availability line described below.
- Keep the contact/header block character-for-character verbatim.
- Keep every employer name, job title, project name, date range, location, degree, institution, and grade exactly as written.
- If the original uses a summary/profile section, edit it per the SUMMARY rule. If it has none, do NOT create one.

Formatting markup for your output (IMPORTANT):
- Wrap the candidate's name and each section heading line in **double asterisks** so they render bold in the exported .docx/.pdf. Use the heading text exactly as it appears in the original.
- Separate blocks with a single blank line. Single newlines inside a block are soft line breaks (contact lines, bullets).
- Keep the original's bullet style; if bullets are plain lines, begin each with "- ".
- No markdown headings (#), no tables, no code fences, no commentary before or after. Output ONLY the finished CV.
- Do not use em dashes or en dashes anywhere. Use commas, colons, or parentheses instead.

CONTENT RULES:
1. NO FALSE INFORMATION. Do not invent companies, titles, dates, employers, skills, projects, certifications, focus areas, or metrics. Every fact must come from the candidate's current CV. You may rephrase and reframe; you may not fabricate. If a section has no content, leave it as it was, never write a placeholder line.
2. SUMMARY (only if the original has one): 2-3 lines maximum. Strengths through concrete tools, technologies, and numbers, never adjectives ("Built ETL pipelines in Python and SQL processing 2M+ records", not "highly skilled and passionate data professional"). No self-praising adjectives (passionate, driven, results-oriented, detail-oriented). No cliches.
3. AVAILABILITY LINE: add exactly one availability sentence matched to the job type (e.g. "Available as a working student, 15-20 hours per week" or "Available full time from [graduation date in CV]"), using only enrollment/date facts present in the CV. Place it at the end of the summary if a summary exists; otherwise as a single line directly under the contact block. This is the only permitted addition.
4. TONE: competent human professional. No dramatic or inflated language. Banned words and phrases: testament, beacon, delve, spearheaded, fostered, vibrant, leveraged, seamlessly, robust, cutting-edge, passionate, dynamic, synergy, "in today's fast-paced world". Crisp, direct, plain.
5. PROJECT FILTERING: work only with projects already in the CV; never add new ones. Expand and reframe the ones that prove the candidate can do this job (facts unchanged); shrink or remove ones irrelevant to this JD. For every kept project, make sure the tech it actually used also appears in the CV's existing skills section.
6. BULLETS: where real data exists (numbers, volumes, timeframes, concrete results), use the XYZ shape: "Accomplished X by doing Y, resulting in Z" with only real numbers from the CV. Where no such data exists, do NOT force the shape or invent a metric; write a clear, direct bullet leading with a strong action verb. If an existing bullet already reads well, keep it untouched. Never stack three adjectives before a noun.
7. ATS KEYWORDS: integrate the hard skills, tools, and exact keywords from the JD naturally into the existing sections so the CV passes ATS filters. Mirror the JD's exact terminology ONLY where the CV genuinely supports it (if the JD says "CI/CD" and the CV shows pipeline work, say "CI/CD"). If a JD-required tool does not appear in the CV at all, you must NOT add it anywhere, not even hedged as "familiar", "basic", or "exposure to". Renaming or synonym-matching is allowed (CV "Postgres" can be written "PostgreSQL"); adding is not. Do not keyword-stuff.
8. EDUCATION: keep degree, institution, dates, and grade as written. Remove semester numbers or "currently in X semester" phrasing if present.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured on the server." }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  let body: { cv?: string; jobDescription?: string; company?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!body.cv?.trim() || !body.jobDescription?.trim()) {
    return new Response(
      JSON.stringify({ error: "CV text and job description are required." }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const user = [
    "<job_description"
      + (body.company ? ` company="${body.company.replace(/"/g, "'")}"` : "")
      + (body.role ? ` role="${body.role.replace(/"/g, "'")}"` : "")
      + ">",
    body.jobDescription.trim(),
    "</job_description>",
    "",
    "<current_cv>",
    body.cv.trim(),
    "</current_cv>",
    "",
    "Rewrite the CV now, following every rule.",
  ].join("\n");

  const client = new Anthropic({ apiKey });

  try {
    const stream = await client.messages.stream({
      model: DEFAULT_MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          stream.on("text", (chunk: string) => controller.enqueue(encoder.encode(chunk)));
          await stream.finalMessage();
          controller.close();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Stream error";
          controller.enqueue(encoder.encode(`\n\n[error] ${msg}`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: `Anthropic API error: ${msg}` }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
