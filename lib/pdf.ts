import jsPDF from "jspdf";
import { parseBlocks, Run } from "./format";

export function downloadPdf(text: string, filename = "cover-letter") {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const FONT = "helvetica";
  const SIZE = 11;
  const margin = 72;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableRight = pageWidth - margin;
  const lineHeight = 15;
  const paragraphGap = lineHeight * 0.55;

  doc.setFont(FONT, "normal");
  doc.setFontSize(SIZE);

  let y = margin;
  let x = margin;

  function nl() {
    y += lineHeight;
    x = margin;
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function ensureRoom() {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function writeRuns(runs: Run[]) {
    for (const run of runs) {
      if (!run.text) continue;
      doc.setFont(FONT, run.bold ? "bold" : "normal");
      // Tokenize keeping whitespace so wrapping is sensible
      const tokens = run.text.split(/(\s+)/);
      for (const tok of tokens) {
        if (!tok) continue;
        const w = doc.getTextWidth(tok);
        const isSpace = /^\s+$/.test(tok);
        if (x + w > usableRight) {
          nl();
          if (isSpace) continue; // skip leading space on wrapped line
        }
        doc.text(tok, x, y);
        x += w;
      }
    }
  }

  const blocks = parseBlocks(text);
  for (const block of blocks) {
    ensureRoom();
    if (block.kind === "rule") {
      y += paragraphGap;
      ensureRoom();
      doc.setDrawColor(150);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += lineHeight;
      continue;
    }
    // Each "line" in the paragraph is a soft-break line: render its runs, then forced newline.
    block.lines.forEach((runs, idx) => {
      if (idx > 0) nl();
      x = margin;
      writeRuns(runs);
    });
    // Paragraph break
    y += lineHeight + paragraphGap;
    x = margin;
    ensureRoom();
  }

  doc.save(`${filename}.pdf`);
}
