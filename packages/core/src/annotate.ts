import { parsePatch } from './diff.js';
import { NOTHING_GENERATED, type IsGenerated } from './gitattributes.js';
import type { ChangedFile } from './github.js';

// About 40k tokens of diff. Modern models take far more, but every character is paid for and waited for.
// The server can change it with MAX_DIFF_CHARS.
export const DEFAULT_MAX_DIFF_CHARS = 150_000;

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

// Folders and files that tools write: build output, dependencies, snapshots, ORM migration snapshots,
// protobuf and other code generators. Nobody reviews these by hand, and they can be huge.
const GENERATED_PATH = /(^|\/)(dist|vendor|node_modules|__snapshots__|__generated__|drizzle\/meta)\//;
const GENERATED_FILE = /(\.(min\.(js|css)|snap|map)|_snapshot\.json|\.generated\.[a-z0-9]+|\.pb\.go|_pb2(_grpc)?\.py|\.g\.dart)$/;

export function skipReason(
  file: Pick<ChangedFile, 'path' | 'patch'>,
  isGenerated: IsGenerated = NOTHING_GENERATED,
  isIgnored: IsGenerated = NOTHING_GENERATED,
): string | undefined {
  const name = file.path.split('/').pop() ?? file.path;
  if (isIgnored(file.path)) return 'ignored by .diffy.yaml';
  if (file.patch === undefined) return 'binary or too large (no patch)';
  if (LOCKFILES.has(name)) return 'lockfile';
  if (GENERATED_PATH.test(file.path) || GENERATED_FILE.test(file.path)) return 'generated file';
  if (isGenerated(file.path)) return 'generated file (.gitattributes)';
  return undefined;
}

const SOURCE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|astro|py|go|rs|java|kt|kts|scala|rb|php|cs|swift|m|mm|c|h|cc|cpp|hpp|ex|exs|erl|clj|dart|lua|sh|bash|zsh|sql|graphql|gql|prisma|proto|tf)$/i;
const TEST_FILE = /(^|\/)(__tests__|tests?|spec|e2e)\/|[._-](test|spec)\.[a-z0-9]+$|_test\.go$/i;

// Which files go into the prompt first when not everything fits: code, then tests, then the rest
// (config, data, docs). A lower number is more important.
export function filePriority(path: string): 0 | 1 | 2 {
  if (TEST_FILE.test(path)) return 1;
  if (SOURCE_FILE.test(path)) return 0;
  return 2;
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
// When the files do not all fit, the most important ones are picked first (see filePriority), and within the
// same importance the smaller ones, so the budget covers as many files as possible. The prompt still lists the
// chosen files in the pull request's own order.
export function buildPromptDiff(
  files: ChangedFile[],
  maxChars: number = DEFAULT_MAX_DIFF_CHARS,
  // isGenerated: files marked generated in .gitattributes. isIgnored: the `ignore` patterns of .diffy.yaml.
  { isGenerated = NOTHING_GENERATED, isIgnored = NOTHING_GENERATED }: { isGenerated?: IsGenerated; isIgnored?: IsGenerated } = {},
): PromptDiff {
  const skippedAt = new Map<number, SkippedFile>();
  const candidates: Array<{ index: number; block: string; priority: number }> = [];

  files.forEach((file, index) => {
    const reason = skipReason(file, isGenerated, isIgnored);
    if (reason) skippedAt.set(index, { path: file.path, reason });
    else candidates.push({ index, block: annotateFile(file), priority: filePriority(file.path) });
  });

  const chosen = new Set<number>();
  let used = 0;
  const byImportance = [...candidates].sort((a, b) => a.priority - b.priority || a.block.length - b.block.length || a.index - b.index);
  for (const candidate of byImportance) {
    if (used + candidate.block.length > maxChars) {
      skippedAt.set(candidate.index, { path: files[candidate.index]!.path, reason: 'over size budget' });
      continue;
    }
    chosen.add(candidate.index);
    used += candidate.block.length + 2;
  }

  const inOrder = candidates.filter((candidate) => chosen.has(candidate.index));
  return {
    text: inOrder.map((candidate) => candidate.block).join('\n\n'),
    included: inOrder.map((candidate) => files[candidate.index]!.path),
    skipped: [...skippedAt.entries()].sort(([a], [b]) => a - b).map(([, skipped]) => skipped),
  };
}
