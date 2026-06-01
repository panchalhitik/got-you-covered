import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const KNOWN_BLOCKERS = new Set([
  "linkedin.com",
  "www.linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "ziprecruiter.com",
]);

export async function POST(req: NextRequest) {
  let url = "";
  try {
    const body = await req.json();
    url = String(body.url || "").trim();
    if (!url) return NextResponse.json({ error: "Missing URL" }, { status: 400 });
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    const host = hostnameOf(url);
    if (KNOWN_BLOCKERS.has(host)) {
      return NextResponse.json(
        {
          error: `${host} blocks automated scraping (login wall / anti-bot). Paste the job description text instead.`,
        },
        { status: 422 },
      );
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Fetch failed: ${res.status} ${res.statusText}. Paste the text instead.` },
        { status: 422 },
      );
    }

    const html = await res.text();
    if (!html || html.length < 200) {
      return NextResponse.json(
        { error: "Page returned almost no content (likely JS-rendered). Paste the text instead." },
        { status: 422 },
      );
    }

    const { JSDOM } = await import("jsdom");
    const { Readability } = await import("@mozilla/readability");
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    let text = "";
    let title = "";
    if (article && article.textContent && article.textContent.trim().length > 200) {
      text = article.textContent;
      title = article.title || "";
    } else {
      const body = dom.window.document.body;
      body?.querySelectorAll("script,style,noscript,nav,footer,header,svg").forEach((n) => n.remove());
      text = body?.textContent || "";
      title = dom.window.document.title || "";
    }

    text = text.replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();

    if (text.length < 200) {
      return NextResponse.json(
        {
          error:
            "Couldn't extract meaningful text — the page may be JS-rendered or behind a login. Paste the text instead.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ text, title, url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Scrape failed: ${msg}. Paste the text instead.` },
      { status: 500 },
    );
  }
}
