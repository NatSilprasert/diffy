import { describe, expect, it, vi } from 'vitest';
import { buildPromptDiff } from '../src/annotate.js';
import {
  expandDiffContext,
  expandedFileBlock,
  findEnclosingStart,
  MAX_EXPANDED_FILE_LINES,
} from '../src/context-expand.js';
import type { ChangedFile } from '../src/github.js';

const lines = (text: string) => text.split('\n');

describe('findEnclosingStart', () => {
  it('finds the function a change sits in, not the if inside it', () => {
    const code = lines(
      [
        'import x from "x";', // 1
        '', // 2
        'export async function save(user: User) {', // 3
        '  const row = await find(user.id);', // 4
        '  if (row) {', // 5
        '    row.name = user.name;', // 6  <- change
        '  }', // 7
        '}', // 8
      ].join('\n'),
    );
    expect(findEnclosingStart(code, 6)).toBe(3);
  });

  it('finds the method of a class, and takes the comment and decorator above it along', () => {
    const code = lines(
      [
        'class Users {', // 1
        '  /** Finds one. */', // 2
        '  @Get(":id")', // 3
        '  async findOne(id: string) {', // 4
        '    return this.repo.find(id);', // 5  <- change
        '  }', // 6
        '}', // 7
      ].join('\n'),
    );
    expect(findEnclosingStart(code, 5)).toBe(2);
  });

  it('finds a Python def and a Go func', () => {
    expect(findEnclosingStart(lines('import os\n\ndef run(x):\n    y = x + 1\n    return y'), 4)).toBe(3);
    expect(findEnclosingStart(lines('package main\n\nfunc (s *Server) Handle(w Writer) error {\n\tw.Write(nil)\n\treturn nil\n}'), 4)).toBe(3);
  });

  it('finds an arrow function assigned to a const', () => {
    expect(findEnclosingStart(lines('const total = (items: Item[]) => {\n  return items.length;\n};'), 2)).toBe(1);
  });

  it('is undefined for a change at the top level, or with nothing declared above it', () => {
    expect(findEnclosingStart(lines('const a = 1;\nconst b = 2;'), 2)).toBeUndefined();
    expect(findEnclosingStart(lines('  x = 1\n  y = 2'), 2)).toBeUndefined();
  });

  it('does not look further up than the limit', () => {
    const body = Array.from({ length: 80 }, (_, i) => `  line${i}();`);
    const code = ['function big() {', ...body, '  changed();', '}'];
    expect(findEnclosingStart(code, 82, 60)).toBeUndefined();
    expect(findEnclosingStart(code, 82, 100)).toBe(1);
  });
});

const file = (over: Partial<ChangedFile> = {}): ChangedFile => ({ path: 'src/a.ts', status: 'modified', additions: 1, deletions: 1, patch: '', ...over });

// A 14 line file with one changed line (line 9, inside `render`).
const CODE = [
  'import { x } from "x";', // 1
  '', // 2
  'export function helper() {', // 3
  '  return 1;', // 4
  '}', // 5
  '', // 6
  'export function render(items: Item[]) {', // 7
  '  const out = [];', // 8
  '  for (const item of items) out.push(item.name.trim());', // 9  (changed)
  '  return out;', // 10
  '}', // 11
  '', // 12
  'export const VERSION = "1";', // 13
  'export const NAME = "a";', // 14
].join('\n');
const PATCH = ['@@ -6,7 +6,7 @@', ' ', ' export function render(items: Item[]) {', '   const out = [];', '-  for (const item of items) out.push(item.name);', '+  for (const item of items) out.push(item.name.trim());', '   return out;', ' }', ' '].join('\n');

describe('expandedFileBlock', () => {
  it('starts at the function around the change, with the lines numbered in the new file', () => {
    const block = expandedFileBlock(file({ patch: PATCH }), CODE, { wholeFileChars: 10 })!;
    // The hunk's own first context line (6) is above the function, so the region starts there.
    expect(block.split('\n').slice(0, 4)).toEqual(['### src/a.ts (modified)', '@@ new file lines 6-14 @@', '    6   ', '    7   export function render(items: Item[]) {']);
    // The hunk itself keeps its markers: the old line is blank-numbered, the new one marked +.
    expect(block).toContain('      -   for (const item of items) out.push(item.name);');
    expect(block).toContain('    9 +   for (const item of items) out.push(item.name.trim());');
    // The lines of the function above the hunk's own context are not repeated.
    expect(block.match(/export function render/g)).toHaveLength(1);
  });

  it('reaches up to the start of a long function, past the three lines of the patch', () => {
    const body = Array.from({ length: 14 }, (_, i) => `  step${i + 1}();`); // lines 4 to 17
    const code = ['const KEEP = 1;', '', 'export function longOne(a: number) {', ...body, '  return changed(a);', '}', '', 'const AFTER = 2;'].join('\n');
    const patch = ['@@ -17,3 +17,3 @@', '   step14();', '-  return old(a);', '+  return changed(a);', ' }'].join('\n');

    const block = expandedFileBlock(file({ patch }), code, { wholeFileChars: 10 })!;

    expect(block.split('\n').slice(0, 4)).toEqual([
      '### src/a.ts (modified)',
      '@@ new file lines 3-21 @@',
      '    3   export function longOne(a: number) {',
      '    4     step1();',
    ]);
    expect(block).toContain('   18 +   return changed(a);');
    expect(block).not.toContain('const KEEP');
  });

  it('adds a few lines below the hunk, and never lines that do not exist', () => {
    const block = expandedFileBlock(file({ patch: PATCH }), CODE, { wholeFileChars: 10 })!;
    expect(block).toContain('   13   export const VERSION = "1";');
    expect(block).toContain('   14   export const NAME = "a";');
    expect(block).not.toContain('   15 ');
  });

  it('shows a small file whole', () => {
    const block = expandedFileBlock(file({ patch: PATCH }), CODE)!;
    expect(block.split('\n')[1]).toBe('@@ new file lines 1-14 @@');
    expect(block).toContain('    1   import { x } from "x";');
    expect(block).toContain('    3   export function helper() {');
    expect(block.match(/^\s+9 \+/gm)).toHaveLength(1);
  });

  it('shows a region once when two hunks reach each other', () => {
    const code = Array.from({ length: 30 }, (_, i) => `  line${i + 1}();`).join('\n');
    const patch = [
      '@@ -3,3 +3,3 @@',
      '   line3();',
      '-  old4();',
      '+  line4();',
      '   line5();',
      '@@ -10,3 +10,3 @@',
      '   line10();',
      '-  old11();',
      '+  line11();',
      '   line12();',
    ].join('\n');
    const block = expandedFileBlock(file({ patch }), code, { wholeFileChars: 10 })!;
    const numbers = [...block.matchAll(/^\s*(\d+) [+ ] /gm)].map((m) => Number(m[1]));
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(block.match(/@@ new file lines/g)).toHaveLength(1);
    expect(numbers).toContain(7); // the gap between the hunks is filled in
  });

  it('keeps two far apart hunks as two regions', () => {
    const code = Array.from({ length: 200 }, (_, i) => `x${i + 1}`).join('\n');
    const patch = ['@@ -2,3 +2,3 @@', ' x2', '-old3', '+x3', ' x4', '@@ -150,3 +150,3 @@', ' x150', '-old151', '+x151', ' x152'].join('\n');
    expect(expandedFileBlock(file({ patch }), code, { wholeFileChars: 10 })!.match(/@@ new file lines/g)).toHaveLength(2);
  });

  it('adds the lines above a change at the top level of the file', () => {
    const code = Array.from({ length: 40 }, (_, i) => `const v${i + 1} = ${i + 1};`).join('\n');
    const patch = ['@@ -20,3 +20,3 @@', ' const v20 = 20;', '-const old21 = 0;', '+const v21 = 21;', ' const v22 = 22;'].join('\n');
    const block = expandedFileBlock(file({ patch }), code, { wholeFileChars: 10 })!;
    expect(block.split('\n')[1]).toBe('@@ new file lines 15-25 @@');
  });

  it('is undefined when there is nothing to expand: no patch, a removed file, an empty or huge file, no hunks', () => {
    expect(expandedFileBlock(file({ patch: undefined }), CODE)).toBeUndefined();
    expect(expandedFileBlock(file({ patch: PATCH, status: 'removed' }), CODE)).toBeUndefined();
    expect(expandedFileBlock(file({ patch: PATCH }), '')).toBeUndefined();
    expect(expandedFileBlock(file({ patch: PATCH }), 'x\n'.repeat(MAX_EXPANDED_FILE_LINES + 1))).toBeUndefined();
    expect(expandedFileBlock(file({ patch: '' }), CODE)).toBeUndefined();
  });

  it('copes with a file that ends with a newline', () => {
    const block = expandedFileBlock(file({ patch: PATCH }), `${CODE}\n`, { wholeFileChars: 10 })!;
    expect(block).not.toContain('   15 ');
  });
});

describe('expandDiffContext', () => {
  const patchFor = (n: number) => ['@@ -1,3 +1,3 @@', ' a', '-b', `+c${n}`, ' d'].join('\n');
  const files = [
    file({ path: 'README.md', patch: patchFor(1) }),
    file({ path: 'src/big.ts', patch: patchFor(2) }),
    file({ path: 'src/small.ts', patch: patchFor(3) }),
    file({ path: 'src/a.test.ts', patch: patchFor(4) }),
  ];
  const content = (path: string) => `a\nb\nc\nd\n${'// filler '.repeat(path === 'src/big.ts' ? 500 : 3)}`;

  const run = (maxChars: number, loadContent = vi.fn(async (path: string) => content(path))) => {
    const plain = buildPromptDiff(files, maxChars);
    return { loadContent, promise: expandDiffContext(plain, files, loadContent, { maxChars, wholeFileChars: 100_000 }) };
  };

  it('gives every file more context when the budget allows', async () => {
    const result = await run(150_000).promise;
    expect(result.expanded.sort()).toEqual(['README.md', 'src/a.test.ts', 'src/big.ts', 'src/small.ts']);
    expect(result.text).toContain('@@ new file lines 1-');
  });

  it('keeps the pull request order of the files', async () => {
    const result = await run(150_000).promise;
    expect(result.parts.map((p) => p.path)).toEqual(['README.md', 'src/big.ts', 'src/small.ts', 'src/a.test.ts']);
    expect(result.text.indexOf('### README.md')).toBeLessThan(result.text.indexOf('### src/small.ts'));
  });

  it('spends a short budget on code before tests and other files, smaller files first, and leaves the rest as they were', async () => {
    // Room for the small code file's expansion but not the big one's.
    const result = await run(2_600).promise;
    expect(result.expanded).toContain('src/small.ts');
    expect(result.expanded).not.toContain('src/big.ts');
    expect(result.parts.find((p) => p.path === 'src/big.ts')!.block).toContain('@@ -1,3 +1,3 @@');
  });

  it('never goes over the budget', async () => {
    for (const budget of [1_000, 2_600, 5_000, 50_000]) {
      const result = await run(budget).promise;
      const used = result.parts.reduce((sum, p) => sum + p.block.length + 2, 0);
      const plain = buildPromptDiff(files, budget).parts.reduce((sum, p) => sum + p.block.length + 2, 0);
      expect(used).toBeLessThanOrEqual(Math.max(budget, plain));
    }
  });

  it('does not fetch a thing when there is no budget left', async () => {
    const plain = buildPromptDiff(files, 150_000);
    const loadContent = vi.fn();
    const used = plain.parts.reduce((sum, p) => sum + p.block.length + 2, 0);
    const result = await expandDiffContext(plain, files, loadContent, { maxChars: used + 100 });
    expect(loadContent).not.toHaveBeenCalled();
    expect(result.expanded).toEqual([]);
    expect(result.text).toBe(plain.text);
  });

  it('leaves a file as it was when its content cannot be read, and carries on with the others', async () => {
    const loadContent = vi.fn(async (path: string) => {
      if (path === 'src/small.ts') throw new Error('rate limited');
      if (path === 'src/big.ts') return undefined;
      return content(path);
    });
    const result = await run(150_000, loadContent).promise;
    expect(result.expanded.sort()).toEqual(['README.md', 'src/a.test.ts']);
  });

  it('does not change anything else about the diff', async () => {
    const { promise } = run(150_000);
    const result = await promise;
    const plain = buildPromptDiff(files, 150_000);
    expect(result.included).toEqual(plain.included);
    expect(result.skipped).toEqual(plain.skipped);
  });
});
