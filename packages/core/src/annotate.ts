import { parsePatch } from './diff.js';
import type { ChangedFile } from './github.js';

export const DEFAULT_MAX_DIFF_CHARS = 60_000;

export type SkippedFile = { path: string; reason: string };

export type PromptDiff = {
  text: string;
  included: string[];
  skipped: SkippedFile[];
};

const LOCKFILES = new Set([
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'Cargo.lock',
  'go.sum',
  'poetry.lock',
  'Gemfile.lock',
  'composer.lock',
]);

const GENERATED_PATH = /(^|\/)(dist|vendor|node_modules)\//;
const GENERATED_FILE = /\.(min\.(js|css)|snap|map)$/;

export function skipReason(file: Pick<ChangedFile, 'path' | 'patch'>): string | undefined {
  const name = file.path.split('/').pop() ?? file.path;
  if (file.patch === undefined) return 'binary or too large (no patch)';
  if (LOCKFILES.has(name)) return 'lockfile';
  if (GENERATED_PATH.test(file.path) || GENERATED_FILE.test(file.path)) return 'generated file';
  return undefined;
}

// Prefix every line with its new-file line number so the model never has to count lines.
// Deleted lines get a blank number column: they can't be commented on.
export function annotateFile(file: ChangedFile): string {
  const out = [`### ${file.path} (${file.status})`];
  for (const hunk of parsePatch(file.patch ?? '')) {
    out.push(hunk.header);
    for (const line of hunk.lines) {
      const num = line.newLine === undefined ? '' : String(line.newLine);
      const marker = line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' ';
      out.push(`${num.padStart(5)} ${marker} ${line.text}`);
    }
  }
  return out.join('\n');
}

// Whole files only: a half-cut file would confuse the model more than a missing one.
export function buildPromptDiff(
  files: ChangedFile[],
  maxChars: number = DEFAULT_MAX_DIFF_CHARS,
): PromptDiff {
  const included: string[] = [];
  const skipped: SkippedFile[] = [];
  const parts: string[] = [];
  let used = 0;

  for (const file of files) {
    const reason = skipReason(file);
    if (reason) {
      skipped.push({ path: file.path, reason });
      continue;
    }
    const block = annotateFile(file);
    if (used + block.length > maxChars) {
      skipped.push({ path: file.path, reason: 'over size budget' });
      continue;
    }
    parts.push(block);
    included.push(file.path);
    used += block.length + 2;
  }
  return { text: parts.join('\n\n'), included, skipped };
}
