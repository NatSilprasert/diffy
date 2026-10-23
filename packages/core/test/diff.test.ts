import { describe, expect, it } from 'vitest';
import { buildCommentableIndex, parsePatch } from '../src/diff.js';

const multiHunk = [
  '@@ -1,3 +1,4 @@',
  ' import a from "a";',
  '+import b from "b";',
  ' ',
  ' export {};',
  '@@ -20,4 +21,4 @@ function run() {',
  '   const x = 1;',
  '-  return x;',
  '+  return x + 1;',
  ' }',
].join('\n');

describe('parsePatch', () => {
  it('numbers context and added lines on the new side, skipping deleted lines', () => {
    const hunks = parsePatch(multiHunk);
    expect(hunks).toHaveLength(2);

    expect(hunks[0]!.lines.map((l) => [l.type, l.newLine])).toEqual([
      ['context', 1],
      ['add', 2],
      ['context', 3],
      ['context', 4],
    ]);

    // second hunk starts at new line 21; the deleted line has no new-side number
    expect(hunks[1]!.lines.map((l) => [l.type, l.newLine])).toEqual([
      ['context', 21],
      ['del', undefined],
      ['add', 22],
      ['context', 23],
    ]);
  });

  it('handles a new file (all additions from line 1)', () => {
    const hunks = parsePatch('@@ -0,0 +1,2 @@\n+one\n+two');
    expect(hunks[0]!.lines.map((l) => l.newLine)).toEqual([1, 2]);
  });

  it('handles a deleted file (no commentable lines)', () => {
    const hunks = parsePatch('@@ -1,2 +0,0 @@\n-one\n-two');
    expect(hunks[0]!.lines.every((l) => l.newLine === undefined)).toBe(true);
  });

  it('ignores the "No newline at end of file" marker without shifting numbers', () => {
    const patch = '@@ -1,2 +1,2 @@\n-old\n\\ No newline at end of file\n+new\n+next\n\\ No newline at end of file';
    const lines = parsePatch(patch)[0]!.lines;
    expect(lines.map((l) => [l.type, l.newLine, l.text])).toEqual([
      ['del', undefined, 'old'],
      ['add', 1, 'new'],
      ['add', 2, 'next'],
    ]);
  });

  it('parses a header without counts (single-line hunk)', () => {
    const hunks = parsePatch('@@ -5 +5 @@\n-a\n+b');
    expect(hunks[0]!.newStart).toBe(5);
    expect(hunks[0]!.lines[1]).toMatchObject({ type: 'add', newLine: 5 });
  });

  it('returns no hunks for an empty patch', () => {
    expect(parsePatch('')).toEqual([]);
  });
});

describe('buildCommentableIndex', () => {
  it('maps each file to one set of commentable lines per hunk', () => {
    const index = buildCommentableIndex([
      { path: 'a.ts', patch: multiHunk },
      { path: 'image.png', patch: undefined },
    ]);

    expect(index.has('image.png')).toBe(false);
    const hunks = index.get('a.ts')!;
    expect([...hunks[0]!.lines]).toEqual([1, 2, 3, 4]);
    expect([...hunks[1]!.lines]).toEqual([21, 22, 23]);
  });

  it('keeps a renamed file under its new path', () => {
    const index = buildCommentableIndex([{ path: 'new/name.ts', patch: '@@ -1 +1 @@\n-a\n+b' }]);
    expect(index.get('new/name.ts')![0]!.lines.has(1)).toBe(true);
  });
});
