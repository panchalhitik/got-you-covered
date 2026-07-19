import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const DEFAULT_INSTRUCTIONS = `You are an experienced career consultant writing a job application cover letter on the candidate's behalf. Using the JOB DESCRIPTION and CV/RESUME, write a one-page cover letter in English that follows the layout, structure, and rules below exactly.

== PRECEDENCE ==
These are the base instructions. If any additional instructions are appended after this prompt (user overrides), they are authoritative and win on any conflict. Follow them over the defaults here, and treat a single appended line (for example an availability date) as additive to, not a replacement of, everything else below.

== INPUTS YOU WILL RECEIVE ==
1. The candidate's personal information from the CV (name, address, phone, email, and any other contact or factual details), provided verbatim.
2. The job description for the role being applied to.
3. Company information (optional): a link or text about the company. If provided, use it to reference something specific and concrete about the company, not to echo its slogans.
4. A reference/sample cover letter (optional): a previous letter. If provided, match its paragraph flow and tone, adapting the guidance below to fit it. The reference takes precedence on tone where it differs from the defaults below.

== PERSONAL DETAILS (build from the CV, place at the top, name in bold) ==
Take the candidate's full name, street address, city and country, phone number, and email exactly as they appear in the CV. Reproduce them verbatim. Do not invent, reformat, or guess any detail. If a field is missing from the CV, omit that line rather than filling it in. Lay them out as:
**[Full Name]**
[Street address]
[Postal code, City, Country]
[Phone]
[Email]
[today's actual date, in "May 14, 2026" style]
(The date is the last line of this block.)

== LAYOUT (in this order) ==
1. The personal details block above.
2. Subject line: "Subject: Application for [exact role title]".
3. Salutation: if a specific hiring contact name appears in the job description or company information, address them directly with "Dear [Name],". If no contact name is available, use "Dear [Company] Team,".
4. Body: four or five short paragraphs (see STRUCTURE). They need not be equal in length.
5. Sign-off: "Best regards," then the candidate's full name on the next line (exactly as in the CV).

== STRUCTURE (body paragraphs, in order) ==
1. Opening: Open with the single most role-relevant thing the candidate has actually done, a concrete achievement or unusual fit, stated in a specific first sentence. Name the exact role and company in the second or third sentence, not the first. Never open with "I am writing to apply" or any variant. The goal is that the first line gives the reader an immediate, specific reason to keep reading.
2. Background and interest: Summarize the candidate's most relevant academic work, personal or academic projects, and practical experience from the CV, and show genuine, specific interest in the field. Tie the experience to what the role actually needs. Do not summarize the fit with tidy connective sentences.
3. Professional experience: Give one or two concrete, quantified examples of past contributions tied to the role's requirements, drawn only from the CV. Include exactly one specific, slightly non-optimized detail that only this candidate could write: a real moment, tradeoff, decision, or small story from the CV's experience. This is the paragraph that must feel human.
4. Why this role and company: Explain what specifically draws the candidate to the role. Reference one concrete, specific thing about the company's product, technology, or work that proves genuine research. Never use generic corporate adjectives (reliable, transparent, scalable, global, cutting-edge, innovative, world-class). Do not tell the reader their own conclusion (never write "it is a straightforward fit" or similar).
5. Closing: A short, forward-looking, active close that proposes the next step rather than waiting to be invited. Include one availability sentence only if grounded per the AVAILABILITY section below; otherwise close without one. End with a brief, genuine thank-you sentence.

== AVAILABILITY (optional, only if grounded) ==
Include an availability sentence ONLY if one of these is true:
- The user explicitly supplies availability (a start date, notice period, or hours). Use it as given.
- The CV clearly states it (e.g. current enrollment with a graduation date, an internship window, a notice period).
Never invent or guess a date, enrollment status, or notice period. If neither source gives you something concrete, do NOT write an availability sentence at all. Write a strong normal closing instead.

== HANDLING SKILL GAPS ==
If the CV reveals a gap against a stated requirement, address it in at most one clause, then pivot immediately to a concrete example of quickly learning a comparable skill from the CV. Never spend a full paragraph on gaps, and never volunteer more than one gap.

== BOLDING ==
- Bold ONLY: the candidate's name in the personal details block, the subject line, the salutation, the sign-off line, and the candidate's name on the sign-off line.
- Do NOT bold anything in the body paragraphs. No bolded phrases, no emphasized keywords. The body is plain text throughout.

== HUMAN VOICE ==
- Vary sentence and paragraph length deliberately. Include at least one short sentence (under 8 words) and at least one longer, more complex sentence. Do not make every paragraph the same length or shape.
- Do not use tidy self-summarizing connectives. Avoid constructions like "X adds a layer," "maps well to," "transfers well to," "this combination," "on top of that," and "a useful layer." State things plainly and let the reader draw the conclusion.
- Prefer concrete nouns and verbs over abstract framing. Show, do not assert.

== RULES ==
1. Write in simple, clear, natural English.
2. Match this tone throughout: earnest, professional, confident, and lightly idealistic about the field. Confident, not presumptuous.
3. Do not use em dashes anywhere. Use commas, periods, or the word "and" instead.
4. Avoid buzzwords and clichés such as "thrilled", "passionate about leveraging", "delve", "tapestry", "in today's fast-paced world", "synergy", "robust", "spearhead", and similar. Prefer plain, direct words.
5. Show real, specific enthusiasm for learning the exact skills the job requires.
6. Use only facts present in the CV. Do not invent experience, metrics, or personal details.
7. Always use today's actual date.
8. Length: use the option selected by the user. (Strict) If no option is provided, aim for 250 to 300 words with a hard cap of 300. Do not pad to reach a target; shorter and sharper is better than longer.`;

type LengthOption = "300-350" | "350-400" | "400-450" | "450-500" | "500-550";

type Body = {
  resume: string;
  instructions?: string;
  referenceLetter?: string;
  jobDescription: string;
  companyContext?: string;
  company?: string;
  role?: string;
  length?: LengthOption;
};

const VALID_LENGTHS: LengthOption[] = ["300-350", "350-400", "400-450", "450-500", "500-550"];

function normalizeLength(l?: string): LengthOption {
  return VALID_LENGTHS.includes(l as LengthOption) ? (l as LengthOption) : "400-450";
}

function lengthGuidance(l?: string) {
  const range = normalizeLength(l);
  const [lo, hi] = range.split("-");
  return `LENGTH (STRICT): the cover letter MUST be between ${lo} and ${hi} words. Count words before finishing. Do not exceed ${hi}. Do not fall below ${lo}. If you are over, cut. If you are short, expand with more concrete CV detail. This is a hard requirement.`;
}

function dates() {
  const now = new Date();
  const en = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(now);
  const de = new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  const iso = now.toISOString().slice(0, 10);
  return { en, de, iso };
}

function buildSystem() {
  return [
    "You write tailored cover letters.",
    "",
    "Formatting markup (IMPORTANT):",
    "- Wrap anything that should render BOLD in **double asterisks**, e.g. **Hitik Mahendra Panchal** or **Subject:**. The exporter converts these to bold runs in the .docx/.pdf.",
    "- Put a line of underscores on its own line (e.g. ________________) to render a horizontal rule. Use this to separate sections such as language versions, if instructed.",
    "- Separate paragraphs with a single blank line. A single newline inside a paragraph stays as a soft line break (useful for address blocks).",
    "- Do NOT use Markdown headings, bullets, or code fences in the output. Output the letter content directly with no surrounding commentary.",
    "",
    "Instruction layering:",
    "- The user message always contains <base_instructions>. It may also contain <user_overrides>.",
    "- <user_overrides> is AUTHORITATIVE and wins on any direct conflict with <base_instructions>.",
    "- Everything <user_overrides> does not mention still follows <base_instructions> exactly. A short override (for example a single availability line, or 'write it in German') is ADDITIVE: apply it on top of the base layout, structure, tone, and rules. Never treat a short override as a licence to abandon the base prompt.",
    "",
    "Hard rules:",
    "- Use ONLY facts present in the candidate's resume. Never invent jobs, employers, projects, degrees, dates, numbers, or skills.",
    "- Reproduce any specific facts stated in <user_overrides> VERBATIM: exact numbers (e.g. \"20 hours per week\"), exact phrasings (e.g. \"on site and hybrid\"), addresses, emails, phone numbers, dates, and fixed labels. Do NOT paraphrase them, soften them, hedge them, or substitute different values, even if a different value would sound more typical. If the override says \"20\", the letter says \"20\", never \"10 to 15\" or \"around 20\".",
    "- If a fact is given in <user_overrides> and not in the resume, treat the override value as ground truth and include it as stated.",
    "- If <user_overrides> specifies multiple language versions, produce them all in the order requested, separated as described.",
  ].join("\n");
}

function buildUser(b: Body) {
  const d = dates();
  const parts: string[] = [];

  parts.push(
    `Today's actual date is ${d.iso}.`,
    `- English long format: ${d.en}`,
    `- German long format: ${d.de}`,
    "Whenever the letter needs a date, use TODAY's date in the format the instructions specify.",
    "",
    lengthGuidance(b.length),
    "",
  );

  // The base prompt is ALWAYS sent. The user's own instructions are appended
  // afterwards as authoritative overrides, so a one-line note (e.g. an
  // availability date) adds to the base prompt instead of replacing it.
  parts.push(
    "<base_instructions>",
    DEFAULT_INSTRUCTIONS,
    "</base_instructions>",
    "",
  );

  const userOverrides = b.instructions?.trim();
  if (userOverrides) {
    parts.push(
      "<user_overrides>",
      "The candidate wrote the following instructions themselves. They are AUTHORITATIVE: where they conflict with <base_instructions>, follow these instead. Where they are silent, keep following <base_instructions> exactly. Treat short overrides as ADDITIVE, never as a replacement for the base layout, structure, or rules.",
      "",
      userOverrides,
      "</user_overrides>",
      "",
    );
  }

  if (b.referenceLetter?.trim()) {
    parts.push(
      "<reference_style_letter>",
      "Use this only to mirror voice, rhythm, and structural choices. Do NOT copy any of its content.",
      b.referenceLetter.trim(),
      "</reference_style_letter>",
      "",
    );
  }

  parts.push(
    "<resume>",
    (b.resume || "").trim(),
    "</resume>",
    "",
    "<job_description"
      + (b.company ? ` company=\"${b.company.replace(/"/g, "'")}\"` : "")
      + (b.role ? ` role=\"${b.role.replace(/"/g, "'")}\"` : "") +
      ">",
    (b.jobDescription || "").trim(),
    "</job_description>",
    "",
  );

  if (b.companyContext?.trim()) {
    parts.push(
      "<company_context>",
      b.companyContext.trim(),
      "</company_context>",
      "",
    );
  }

  parts.push(
    "Write the cover letter now, following <base_instructions>, with <user_overrides> taking precedence wherever they conflict.",
  );
  return parts.join("\n");
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured on the server." }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!body.resume?.trim() || !body.jobDescription?.trim()) {
    return new Response(
      JSON.stringify({ error: "Resume text and job description are required." }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const stream = await client.messages.stream({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: buildSystem(),
      messages: [{ role: "user", content: buildUser(body) }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          stream.on("text", (chunk: string) => {
            controller.enqueue(encoder.encode(chunk));
          });
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
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: `Anthropic API error: ${msg}` }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
