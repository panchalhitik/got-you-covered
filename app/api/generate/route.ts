import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const DEFAULT_INSTRUCTIONS = `You are an experienced career consultant writing a job application cover letter on my behalf. Using the JOB DESCRIPTION and CV/RESUME, write a one-page cover letter in English that follows the layout, structure, bolding, and rules below exactly.

== INPUTS YOU WILL RECEIVE ==
1. My personal information from my CV (name, address, phone, email, and any other contact or factual details), provided verbatim.
2. The job description for the role I am applying to.
3. Company information (optional): a link or text about the company. If provided, use it to mirror the company's mission and values in the letter.
4. A reference/sample cover letter (optional): a previous letter of mine. If provided, match its format, paragraph flow, and tone, adapting the guidance below to fit it. The reference takes precedence on format and tone where they differ from the defaults below.

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
4. Body: five short paragraphs (see STRUCTURE).
5. Sign-off: "Best regards," then the candidate's full name on the next line (exactly as in the CV).

== STRUCTURE (five body paragraphs, in order) ==
1. Intro: state the exact role title and the company/team, and the candidate's current status (degree program and university, or current role, from the CV). Express clear, specific motivation. Bold the phrase capturing the company's core mission or commitment as stated in the job description.
2. Background and interest: summarize the candidate's most relevant academic and practical experience from the CV and show genuine interest in the field. Bold the key principles, concepts, or skill areas from the job description that the candidate aligns with.
3. Professional experience: give concrete examples of past contributions tied to the role's requirements. Bold one sentence describing the most relevant hands-on contributions.
4. Why this role: explain what specifically draws the candidate to the role and how the company's focus matches their interests and goals. Bold the short phrase naming the core value combination of the role.
5. Closing: a short paragraph expressing eagerness to contribute, including exactly one availability sentence chosen by job type, using the candidate's enrollment status and graduation/completion date from the CV:
   - Part-time or working student: currently enrolled and available for 15 to 20 hours per week, on site, remote, or hybrid.
   - Graduate or full-time: available full time after course completion in [graduation date from CV], on site, remote, or hybrid.
   - Internship: available from [earliest start date from CV] for 3 to 6 months.
   End with a brief thank-you sentence. Bold the phrase stating the contribution the candidate wants to make to the company.

== BOLDING ==
- IMPORTANT: mirror the job description's own keywords and phrasing in the bolded segments so each paragraph visibly ties to the role. Pull the exact terms the employer uses (mission, required skills, values) and place them in the bolded phrases rather than paraphrasing them.
- Bold ONLY: the subject line, the salutation, the sign-off line, the candidate's name in the personal details block, the candidate's name on the sign-off line, and ONE key phrase or sentence per body paragraph (the segment that signals alignment). Do not over-bold.

== RULES ==
1. Write in simple, clear, natural English.
2. Sound human, warm, and confident. Avoid anything that reads as AI-generated.
3. Match this tone throughout: earnest, professional, and lightly idealistic about the field.
4. Do not use em dashes anywhere. Use commas, periods, or the word "and" instead.
5. Avoid buzzwords and clichés such as "thrilled", "passionate about leveraging", "delve", "tapestry", "in today's fast-paced world", "synergy", "robust", and similar. Prefer plain, direct words.
6. Show real, specific enthusiasm for learning the exact skills the job requires.
7. Use only facts present in the CV. Do not invent experience or personal details.
8. Always use today's actual date.
9. Length: use from the option selected by user. (Strict)`;

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
