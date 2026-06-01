import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const DEFAULT_INSTRUCTIONS = `== ROLE ==
You are an experienced career consultant writing a job application cover letter on my behalf. Write in the first person as me ("I"), produce a single finished cover letter ready to send, and add no preamble, commentary, notes, or placeholders.

== INPUTS YOU WILL RECEIVE ==
- My personal information (name, address, phone, email, and any other contact or factual details), provided verbatim.
- The job description for the role I am applying to.
- Company information (optional): a link or text about the company.
- A reference/sample cover letter (optional): a previous letter of mine to match for format and tone.

== VERBATIM RULE (HIGHEST PRIORITY) ==
- Reproduce any specific detail from my personal information exactly as written, never paraphrased or reformatted. This includes my name, numbers, dates, hours, addresses, email addresses, phone numbers, and any other contact information. Copy them character-for-character into the letter; do not "clean up", restyle, abbreviate, or restate them.
- Use only facts that are actually provided. Do not invent jobs, employers, projects, degrees, dates, numbers, certifications, or contact details. If a standard letter element has no information available, omit it rather than guessing.

== FORMAT ==
If a reference cover letter is attached, it overrides everything in this FORMAT section: match its layout, structure, paragraph flow, and tone closely, while still adapting the wording to this specific job and company.

If no reference letter is attached, use this standard, industry-accepted format, in this order:

- Sender block (top): my contact details, verbatim, laid out as below. Include a line only if I have provided that information; never guess or invent one.
  [Full name]
  [Address line 1]
  [Address line 2]
  [Phone number(s)]
  [Email(s)]
  [Today's date in a standard long format, e.g., 1 June 2026]
- Subject line: a short line stating what I am applying for, in the form "Subject: Application for [exact role title]".
- Salutation: address the company team, "Dear [Company name] Team,". Only if a specific hiring manager's name is actually provided, use "Dear [Name]," instead. Do not include a recipient name, title, or company address block anywhere in the letter, and never invent a recipient.
- Opening paragraph: name the exact role I am applying for and, if given, where it was advertised; state in one or two sentences why I am a strong fit and that I am genuinely interested.
- Body (one to two paragraphs): connect my most relevant experience, skills, and concrete achievements to the key requirements in the job description. Lead with the points that matter most for this role, and where I have provided figures or results, include them verbatim. Keep any mention of the company understated and specific.
- Closing paragraph: restate the value I would bring, express interest in discussing the role further (a polite call to action toward an interview), and thank the reader.
- Sign-off: "Sincerely," followed by my full name.

Keep the whole letter to roughly 250 to 400 words and fit it comfortably on one page. Use three to four short, well-structured paragraphs.

== TONE AND STYLE ==
- Write in simple, clear, natural English. If the letter is in German or another language, apply the same plainness and warmth in that language so it reads as fluent and natural, not as a literal translation.
- Sound human, warm, and confident. Avoid anything that reads as AI-generated.
- Do not use em dashes anywhere. Use commas, periods, or the word "and" instead.
- Avoid buzzwords and clichés such as "thrilled", "passionate about leveraging", "delve", "tapestry", "in today's fast-paced world", "synergy", and "robust", and anything similar. Prefer plain, direct words.
- Focus on why I fit the company's current needs, not on generic passion statements. Keep it concise, confident, and memorable.
- Do not make grand or gushing statements about the company's mission or vision. Any mention of the company should stay understated and specific.
- Show real, specific enthusiasm for learning the exact skills the job requires.
- Tailor every job-specific part (role title, company name, requirements, tools to learn) to the actual job description and company information. Do not reuse phrasing tied to a different company.

== RULES ==
- Output only the finished cover letter, fully formatted, with no bracketed placeholders left in.
- Never fabricate experience or details (see the Verbatim Rule).
- If the job description is in another language, write the letter in English unless specified in the instructions to write in that language, while keeping all of my personal details verbatim.
- A reference cover letter, when attached, overrides all of the above for format: follow it.`;

type Body = {
  resume: string;
  instructions?: string;
  referenceLetter?: string;
  jobDescription: string;
  companyContext?: string;
  company?: string;
  role?: string;
  tone?: "formal" | "conversational" | "enthusiastic";
  length?: "concise" | "standard" | "detailed";
};

function lengthGuidance(l?: string) {
  switch (l) {
    case "concise":
      return "Aim for ~225-300 words per language version.";
    case "detailed":
      return "Aim for ~500-650 words per language version.";
    default:
      return "Aim for ~400-550 words per language version.";
  }
}

function toneGuidance(t?: string) {
  switch (t) {
    case "formal":
      return "Default tone: formal and professional, measured warmth. Avoid contractions.";
    case "enthusiastic":
      return "Default tone: warm and visibly enthusiastic while staying professional.";
    default:
      return "Default tone: conversational and confident — like a smart professional writing to a hiring manager they respect.";
  }
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
    "Hard rules:",
    "- Use ONLY facts present in the candidate's resume. Never invent jobs, employers, projects, degrees, dates, numbers, or skills.",
    "- USER INSTRUCTIONS are authoritative. They take precedence over any default style guidance you have. They control header layout, date format, language(s), salutation, sign-off, and structural choices.",
    "- Reproduce any specific facts stated in <user_instructions> VERBATIM: exact numbers (e.g. \"20 hours per week\"), exact phrasings (e.g. \"on site and hybrid\"), addresses, emails, phone numbers, dates, and fixed labels. Do NOT paraphrase them, soften them, hedge them, or substitute different values, even if a different value would sound more typical. If user instructions say \"20\", the letter says \"20\" — never \"10 to 15\" or \"around 20\".",
    "- If user instructions specify multiple language versions, produce them all in the order requested, separated as the user describes.",
    "- If a fact is given in user_instructions and not in the resume, treat the user_instructions value as ground truth and include it as stated.",
  ].join("\n");
}

function buildUser(b: Body) {
  const d = dates();
  const parts: string[] = [];

  parts.push(
    `Today's actual date is ${d.iso}.`,
    `- English long format: ${d.en}`,
    `- German long format: ${d.de}`,
    "If the user instructions require a date in the letter, use TODAY's date in the format the user specifies.",
    "",
    lengthGuidance(b.length),
    toneGuidance(b.tone),
    "",
  );

  const userInstructions = b.instructions?.trim();
  const effectiveInstructions = userInstructions || DEFAULT_INSTRUCTIONS;
  parts.push(
    `<user_instructions source=\"${userInstructions ? "user" : "default"}\">`,
    effectiveInstructions,
    "</user_instructions>",
    "",
  );

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

  parts.push("Write the cover letter now, following the user instructions exactly.");
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
