import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 20;

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured." }, { status: 500 });
  }
  const { text } = await req.json().catch(() => ({ text: "" }));
  if (!text || typeof text !== "string" || text.trim().length < 30) {
    return NextResponse.json({ company: "", role: "" });
  }

  const client = new Anthropic({ apiKey });
  try {
    const msg = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content:
            "Extract the company name and role title from this job description. Respond ONLY with strict JSON: {\"company\":\"...\",\"role\":\"...\"}. Empty string if you can't tell. Do not include markdown fences.\n\n---\n" +
            text.slice(0, 6000),
        },
      ],
    });
    const block = msg.content[0];
    const raw = block && block.type === "text" ? block.text : "";
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    return NextResponse.json({
      company: typeof parsed.company === "string" ? parsed.company : "",
      role: typeof parsed.role === "string" ? parsed.role : "",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ company: "", role: "", warning: message });
  }
}
