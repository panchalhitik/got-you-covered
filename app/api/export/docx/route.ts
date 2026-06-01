import { NextRequest } from "next/server";
import { BorderStyle, Document, Packer, Paragraph, TextRun } from "docx";
import { parseBlocks } from "@/lib/format";

export const runtime = "nodejs";

const FONT = "Calibri";
const SIZE = 22; // half-points -> 11pt

function buildParagraphs(text: string): Paragraph[] {
  const blocks = parseBlocks(text);
  const out: Paragraph[] = [];

  for (const block of blocks) {
    if (block.kind === "rule") {
      out.push(
        new Paragraph({
          spacing: { before: 240, after: 240 },
          border: {
            bottom: { color: "888888", space: 1, style: BorderStyle.SINGLE, size: 6 },
          },
        }),
      );
      continue;
    }

    const children: TextRun[] = [];
    block.lines.forEach((runs, idx) => {
      if (idx > 0) children.push(new TextRun({ break: 1 }));
      for (const r of runs) {
        if (!r.text) continue;
        children.push(
          new TextRun({
            text: r.text,
            bold: r.bold,
            font: FONT,
            size: SIZE,
          }),
        );
      }
    });

    out.push(
      new Paragraph({
        spacing: { after: 200, line: 320 },
        children: children.length ? children : [new TextRun({ text: "", font: FONT, size: SIZE })],
      }),
    );
  }

  return out;
}

export async function POST(req: NextRequest) {
  const { text = "", filename = "cover-letter" } = await req.json().catch(() => ({}));
  const safeName = String(filename).replace(/[^a-z0-9_\-]+/gi, "-").replace(/^-|-$/g, "") || "cover-letter";

  const doc = new Document({
    creator: "Got you CoVered",
    title: safeName,
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
          },
        },
        children: buildParagraphs(String(text)),
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${safeName}.docx"`,
    },
  });
}
