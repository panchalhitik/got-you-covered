# Got you CoVered

Generate tailored, one-page cover letters from your resume and a target job description, powered by Claude.

**Live app: https://got-you-covered-cv.vercel.app/**

## What it does

- Reads your resume (PDF or `.docx`) and turns it into editable plain text.
- Accepts a job description as pasted text or a URL — for URLs, the page is fetched server-side and the main content is extracted.
- Auto-detects company and role from the job description.
- Writes a tailored cover letter with Claude, streaming the output as it generates.
- Supports a built-in default prompt or your own always-applied instructions, plus an optional reference cover letter to emulate your voice and layout.
- Exports to `.docx` and `.pdf` with proper formatting — bold runs for headers / salutations / sign-offs, real horizontal rules, 1" margins, 11pt body.
- Tone (formal / conversational / enthusiastic) and length (concise / standard / detailed) selectors.
- Keeps a local history of your last 50 letters so you can reload them later.

## How to use it

1. **Profile** — upload your resume. Optionally add always-applied instructions (tone, things to emphasize, must-avoid phrases) and an optional reference cover letter for style. If you leave instructions blank, a built-in default prompt produces a clean one-page business letter.
2. **The job** — paste the job description, or give a URL and click *Fetch text*. Sites like LinkedIn / Indeed / Glassdoor block scrapers; paste the text for those. Company and role auto-fill from the description.
3. **Generate** — the letter streams into an editable view. Edit anything inline.
4. **Export** — Copy to clipboard (plain text), Download `.docx`, or Download `.pdf`. Regenerate any time.

The editor uses lightweight markup: `**text**` becomes bold and a line of underscores becomes a horizontal rule. Copy strips them; downloads render them as real formatting.

## Privacy

All your data — resume text, instructions, reference letter, job descriptions, generated letters, and history — is stored only in your own browser's `localStorage`. Nothing is persisted on a server. The Anthropic API call is made server-side so the API key never reaches the browser.

## Tech stack

Next.js (App Router) + TypeScript + Tailwind CSS. Anthropic SDK for generation, `pdf-parse` and `mammoth` for resume parsing, `@mozilla/readability` + `jsdom` for URL extraction, `docx` and `jspdf` for exports.

## Running locally

```bash
git clone https://github.com/<your-username>/got-you-covered.git
cd got-you-covered
npm install
cp .env.example .env.local
# edit .env.local and paste your own ANTHROPIC_API_KEY
npm run dev
```

Then open http://localhost:3000.

`.env.local` keys:
```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6   # optional override
```

## Notes

- PDF parsing uses `pdf-parse`; scanned / image-only PDFs won't extract text.
- URL extraction works on most pages but not on heavily JavaScript-rendered or login-gated sites — paste the text in that case.
