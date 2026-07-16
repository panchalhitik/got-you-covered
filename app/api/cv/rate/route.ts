import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const SYSTEM = `You are a ruthless hiring manager with 200 applications in your queue and six seconds per CV. Review one candidate's CV against a specific job description.

Be brutally honest and SHORT. Every point must reference actual CV content or actual JD requirements. No preamble, no summaries, no repetition.

Output EXACTLY this format, plain text, no markdown symbols, no code fences:

SCORE: <integer 0-100>
VERDICT: <one sentence, max 18 words. 80+ interview-likely, 60-79 borderline, below 60 likely rejected. Do not inflate.>

WHAT LANDS
- <max 3 bullets, each max 12 words, quoting the CV's strongest JD matches>

MISSING KEYWORDS
- <max 5 bullets. Each: the exact JD term, then max 6 words on why it matters. Absent-entirely terms first.>

RED FLAGS
- <max 3 bullets, each max 10 words: robotic phrasing, inflated verbs, irrelevant noise>

TOP FIXES
- <max 3 bullets, imperative, each max 15 words, highest impact first>

Hard limit: 150 words total. Cut the weakest points to fit, never the format.`;

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
    "<cv>",
    body.cv.trim(),
    "</cv>",
    "",
    "Review this CV against the job description now.",
  ].join("\n");

  const client = new Anthropic({ apiKey });

  try {
    const stream = await client.messages.stream({
      model: DEFAULT_MODEL,
      max_tokens: 3000,
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
