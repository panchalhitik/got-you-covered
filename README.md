# Got you CoVered

Generate tailored cover letters from your resume + a target job description, powered by the Anthropic API.

- **Stack:** Next.js (App Router) + TypeScript + Tailwind. API routes keep your `ANTHROPIC_API_KEY` server-side.
- **Privacy:** resumes, instructions, and generated letters are stored only in your browser's `localStorage`. Nothing is persisted on a server.

## Setup

```bash
npm install
cp .env.example .env.local   # then paste your real key
npm run dev
```

Open http://localhost:3000.

`.env.local` keys:

```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6   # optional override
```

## Using it

1. **Profile** — upload your resume (PDF or .docx). It's parsed to plain text in the browser-side via a server route; the text is editable. Add reusable instructions (tone, things to emphasize, things to avoid). Optionally upload a past cover letter for style.
2. **The job** — paste the job description or give a URL. URLs are scraped server-side; sites like LinkedIn / Indeed / Glassdoor block scrapers, so paste the text for those. Company + role auto-detect from the JD.
3. **Generate** — streams the letter into an editable view. Copy, regenerate, or download as `.docx` / `.pdf`.

## Deploy to Vercel (free)

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. In Project Settings → Environment Variables, add `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`).
4. Deploy. No other config needed — `app/api/*` routes run on Vercel's serverless runtime.

## Notes

- PDF parsing uses `pdf-parse`; scanned/image-only PDFs won't extract text.
- URL extraction uses `@mozilla/readability` + `jsdom`. JS-heavy pages may fail — paste the text in that case.
- The Anthropic call streams via `messages.stream`. Default model is `claude-sonnet-4-6`.
