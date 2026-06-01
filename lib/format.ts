// Shared parsing of the lightweight markup the model emits:
//   **text**           -> bold run
//   line of _____      -> horizontal rule
//   blank line         -> paragraph break
//   single newline     -> soft line break inside a paragraph

export type Run = { text: string; bold: boolean };
export type Block =
  | { kind: "rule" }
  | { kind: "para"; lines: Run[][] }; // lines (soft-break separated), each line a list of runs

const HR_RE = /^[_\-–—]{3,}$/;

export function parseBlocks(input: string): Block[] {
  // Normalize line endings, collapse 3+ blanks to 2
  const text = input.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return [];

  // Split on blank lines into paragraphs
  const paragraphs = text.split(/\n\n+/);
  const blocks: Block[] = [];
  for (const p of paragraphs) {
    const stripped = p.trim();
    if (HR_RE.test(stripped)) {
      blocks.push({ kind: "rule" });
      continue;
    }
    const lines = p.split("\n").map((ln) => parseInlineBold(ln));
    blocks.push({ kind: "para", lines });
  }
  return blocks;
}

export function parseInlineBold(line: string): Run[] {
  if (!line) return [{ text: "", bold: false }];
  // Split on **...** non-greedily; supports multiple per line
  const re = /\*\*([^\n*]+?)\*\*/g;
  const runs: Run[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) runs.push({ text: line.slice(last, m.index), bold: false });
    runs.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) runs.push({ text: line.slice(last), bold: false });
  return runs.length ? runs : [{ text: line, bold: false }];
}

// Strip **markers** for plain-text uses (copy to clipboard, word count).
export function stripBold(text: string): string {
  return text.replace(/\*\*([^\n*]+?)\*\*/g, "$1");
}
