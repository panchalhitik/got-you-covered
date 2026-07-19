import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const SYSTEM = `Act as an expert executive recruiter reviewing a cover letter. Be concise and direct. If a job description is provided, judge the letter against its actual requirements (especially any hard filters or must-haves); if not, judge against general best practice and say so.

Return exactly this format, nothing else:

Overall: X/10 — one line on where it stands and the single biggest lever.

Ratings (each: score + 1 to 2 lines max)

* Hook: X/10 — ...
* Value proposition: X/10 — ...
* Tone & authenticity: X/10 — ...
* Readability & formatting: X/10 — ...
* Call to action: X/10 — ...
* Human-feel (not AI-written): X/100 — ... (name the 1 to 2 strongest AI tells, if any)

Fix first (max 3, one line each, specific and actionable)

1. ...
2. ...
3. ...

Verify before sending (only if relevant: unproven claims, missing must-haves, or factual risks — max 2 lines; omit if none)

Rules:

* Total response under 200 words. No preamble, no restating the letter.
* Score honestly; do not inflate. Distinguish "good" from "great."
* Tie every criticism to a concrete change, not a vibe.
* For human-feel, flag specific phrases (e.g. tidy self-summarizing connectives, polished aphorisms), not a generic verdict, and note that no score is a reliable AI detector.
* If a JD is present and the letter misses a stated hard requirement, that goes in "Fix first."`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured on the server." }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  let body: { letter?: string; jobDescription?: string; company?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!body.letter?.trim()) {
    return new Response(JSON.stringify({ error: "A cover letter is required." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const parts: string[] = [];
  if (body.jobDescription?.trim()) {
    parts.push(
      "<job_description"
        + (body.company ? ` company="${body.company.replace(/"/g, "'")}"` : "")
        + (body.role ? ` role="${body.role.replace(/"/g, "'")}"` : "")
        + ">",
      body.jobDescription.trim(),
      "</job_description>",
      "",
    );
  } else {
    parts.push("No job description was provided.", "");
  }
  parts.push("<cover_letter>", body.letter.trim(), "</cover_letter>", "", "Review it now.");

  const client = new Anthropic({ apiKey });

  try {
    const stream = await client.messages.stream({
      model: DEFAULT_MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: parts.join("\n") }],
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
