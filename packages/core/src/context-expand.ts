import { filePriority, type PromptDiff } from './annotate.js';
import { parsePatch, type Hunk, type PatchLine } from './diff.js';
import type { ChangedFile } from './github.js';

// GitHub's patch shows each change with three lines around it. A reviewer who sees only that cannot tell what the
// function does, what the variables hold or what the lines above and below check. This gives the model the
// function (or class, or whole small file) around each change, taken from the file as it is at the pull request's
// head commit.

export const LINES_AFTER = 3;
// How far above a change to look for the function it sits in, and how many lines to add above the hunk when there
// is none (the top level of a file, or a language this does not recognise).
export const MAX_LINES_BEFORE = 60;
export const FALLBACK_EXTRA_LINES = 5;
// A file up to this size is shown whole: it is cheaper than the model guessing what the rest holds.
export const WHOLE_FILE_CHARS = 5_000;
// A file with more lines than this is left as a plain patch.
export const MAX_EXPANDED_FILE_LINES = 4_000;
// Do not bother fetching files when less than this is left of the budget.
const MIN_BUDGET = 1_500;
const FETCH_BATCH = 5;

const indentOf = (line: string): number => {
  let width = 0;
  for (const char of line) {
    if (char === ' ') width++;
    else if (char === '\t') width += 4;
    else break;
  }
  return width;
};

// Lines that start something with a body (any language we are likely to meet), but not control flow.
const CONTROL = /^\s*(if|else|elif|for|foreach|while|do|switch|case|catch|finally|try|with|return|await|yield|throw|match|when)\b/;
const DECLARATION = new RegExp(
  '^\\s*(?:' +
    [
      '(?:export\\s+)?(?:default\\s+)?(?:abstract\\s+)?(?:async\\s+)?(?:function|class|interface|enum|struct|trait|impl|module|namespace|object|record)\\b',
      '(?:export\\s+)?type\\s+\\w+',
      '(?:public|private|protected|internal|static|override|final|abstract|async|pub|open)\\b',
      '(?:def|func|fn|fun|sub|proc)\\b',
      '(?:export\\s+)?(?:const|let|var)\\s+\\w+(?:\\s*:[^=]+)?\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|\\w+)\\s*(?:=>|:)',
      '(?:export\\s+)?(?:const|let|var)\\s+\\w+\\s*=\\s*(?:async\\s+)?function\\b',
      '[\\w$.<>\\[\\], ]*[\\w$>\\]]\\s*\\([^)]*\\)\\s*(?:\\{|:|=>|->)',
    ].join('|') +
    ')',
);
// Lines that belong to the declaration under them: comments, doc blocks, decorators and attributes.
// A line that only closes a block: its indentation is that of the block's opening line, not of its contents.
const CLOSING = /^\s*[})\]]/;
const ATTACHED = /^\s*(?:\/\/|\/\*|\*|#|@|\[)/;

// The line (1-based) where the function that contains `target` (1-based) begins, with the comments and decorators
// right above it. undefined when the change is at the top level of the file or no such line is near.
export function findEnclosingStart(lines: readonly string[], target: number, maxBefore: number = MAX_LINES_BEFORE): number | undefined {
  const at = target - 1;
  // The indentation of the changed code itself: the function must be indented less than that. Blank lines and lines
  // that only close something say nothing about it.
  let base: number | undefined;
  for (let i = at; i < Math.min(lines.length, at + 6) && base === undefined; i++) {
    const line = lines[i]!;
    if (line.trim() !== '' && !CLOSING.test(line)) base = indentOf(line);
  }
  if (base === undefined || base === 0) return undefined;

  for (let i = at - 1; i >= Math.max(0, at - maxBefore); i--) {
    const line = lines[i]!;
    if (line.trim() === '' || indentOf(line) >= base) continue;
    if (CONTROL.test(line) || !DECLARATION.test(line)) continue;

    let start = i;
    while (start > 0 && i - start < 8 && ATTACHED.test(lines[start - 1]!) && indentOf(lines[start - 1]!) >= indentOf(line)) start--;
    return start + 1;
  }
  return undefined;
}

const format = (line: number | undefined, marker: string, text: string) => `${line === undefined ? '' : String(line)}`.padStart(5) + ` ${marker} ${text}`;
const markerOf = (line: PatchLine) => (line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' ');

type Span = { first: number; last: number; changed: number };

// The new-file lines a hunk covers, and the first one it changes.
function spanOf(hunk: Hunk): Span | undefined {
  const numbered = hunk.lines.filter((line) => line.newLine !== undefined);
  if (numbered.length === 0) return undefined;
  // A hunk that only deletes lines has no added line: its change is at the line after the deletion.
  const changed = hunk.lines.find((line) => line.type === 'add')?.newLine ?? numbered[0]!.newLine!;
  return { first: numbered[0]!.newLine!, last: numbered[numbered.length - 1]!.newLine!, changed };
}

// A file block with more around each change: the enclosing function above it, a few lines below, and a whole small
// file. Lines are numbered in the new file like the plain patch, deleted lines stay blank-numbered, and only the
// lines the patch marks with + are new. undefined when the file cannot be expanded (so the plain patch is used).
export function expandedFileBlock(
  file: Pick<ChangedFile, 'path' | 'status' | 'patch'>,
  content: string,
  { linesAfter = LINES_AFTER, wholeFileChars = WHOLE_FILE_CHARS }: { linesAfter?: number; wholeFileChars?: number } = {},
): string | undefined {
  if (file.patch === undefined || file.status === 'removed') return undefined;

  const lines = content.split('\n');
  if (lines.at(-1) === '') lines.pop();
  if (lines.length === 0 || lines.length > MAX_EXPANDED_FILE_LINES) return undefined;

  const hunks = parsePatch(file.patch).map((hunk) => ({ hunk, span: spanOf(hunk) }));
  if (hunks.length === 0 || hunks.some(({ span }) => span === undefined)) return undefined;
  const ordered = hunks.map(({ hunk, span }) => ({ hunk, span: span! })).sort((a, b) => a.span.first - b.span.first);

  const whole = content.length <= wholeFileChars;
  // Where each hunk's expanded region begins and ends, in the new file.
  const regions = ordered.map(({ hunk, span }) => ({
    hunk,
    span,
    start: whole ? 1 : Math.min(span.first, findEnclosingStart(lines, span.changed) ?? Math.max(1, span.first - FALLBACK_EXTRA_LINES)),
    end: whole ? lines.length : Math.min(lines.length, span.last + linesAfter),
  }));

  // Hunks whose expanded regions touch are one region, so no line is shown twice.
  const groups: Array<typeof regions> = [];
  for (const region of regions) {
    const group = groups.at(-1);
    if (group && region.start <= Math.max(...group.map((r) => r.end)) + 1) group.push(region);
    else groups.push([region]);
  }

  const out = [`### ${file.path} (${file.status})`];
  for (const group of groups) {
    const start = Math.min(...group.map((r) => r.start));
    const end = Math.max(...group.map((r) => r.end));
    out.push(`@@ new file lines ${start}-${end} @@`);

    let next = start;
    const context = (upTo: number) => {
      for (; next <= upTo; next++) out.push(format(next, ' ', lines[next - 1]!));
    };
    for (const { hunk, span } of group) {
      context(span.first - 1);
      for (const line of hunk.lines) out.push(format(line.newLine, markerOf(line), line.text));
      next = Math.max(next, span.last + 1);
    }
    context(end);
  }
  return out.join('\n');
}

export type ExpandOptions = {
  maxChars: number;
  linesAfter?: number;
  wholeFileChars?: number;
};

export type ExpandedDiff = PromptDiff & {
  // The files that were given more than their plain patch.
  expanded: string[];
};

// Swaps the plain patch of each included file for a fuller block, as long as the total stays within `maxChars`.
// The most important files go first (code, then tests, then the rest; smaller ones first), and a file whose fuller
// block does not fit is left as the plain patch. `loadContent` reads a file at the head commit; a file it cannot
// read is simply left as it was.
export async function expandDiffContext(
  diff: PromptDiff,
  files: ChangedFile[],
  loadContent: (path: string) => Promise<string | undefined>,
  { maxChars, linesAfter, wholeFileChars }: ExpandOptions,
): Promise<ExpandedDiff> {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const used = diff.parts.reduce((sum, part) => sum + part.block.length + 2, 0);
  let remaining = maxChars - used;

  const order = [...diff.parts].sort((a, b) => filePriority(a.path) - filePriority(b.path) || a.block.length - b.block.length);
  const replaced = new Map<string, string>();

  for (let i = 0; i < order.length && remaining >= MIN_BUDGET; i += FETCH_BATCH) {
    const batch = order.slice(i, i + FETCH_BATCH);
    const contents = await Promise.all(batch.map((part) => loadContent(part.path).catch(() => undefined)));
    batch.forEach((part, j) => {
      const content = contents[j];
      const file = byPath.get(part.path);
      if (!content || !file) return;
      const block = expandedFileBlock(file, content, { linesAfter, wholeFileChars });
      if (!block) return;
      const extra = block.length - part.block.length;
      if (extra > remaining) return;
      replaced.set(part.path, block);
      remaining -= Math.max(0, extra);
    });
  }

  const parts = diff.parts.map((part) => ({ path: part.path, block: replaced.get(part.path) ?? part.block }));
  return {
    ...diff,
    text: parts.map((part) => part.block).join('\n\n'),
    parts,
    expanded: diff.parts.filter((part) => replaced.has(part.path)).map((part) => part.path),
  };
}
