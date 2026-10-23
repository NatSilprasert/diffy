import { describe, expect, it } from 'vitest';
import { annotateFile, buildPromptDiff, skipReason } from '../src/annotate.js';
import type { ChangedFile } from '../src/github.js';

const file = (path: string, patch: string | undefined, status = 'modified'): ChangedFile => ({
  path,
  status,
  additions: 0,
  deletions: 0,
  patch,
});

const patch = ['@@ -10,3 +10,4 @@', ' a', '-b', '+c', '+d', ' e'].join('\n');

describe('annotateFile', () => {
  it('prefixes new-file line numbers and leaves deleted lines blank', () => {
    expect(annotateFile(file('src/x.ts', patch))).toBe(
      [
        '### src/x.ts (modified)',
        '@@ -10,3 +10,4 @@',
        '   10   a',
        '      - b',
        '   11 + c',
        '   12 + d',
        '   13   e',
      ].join('\n'),
    );
  });
});

describe('skipReason', () => {
  it.each([
    ['pnpm-lock.yaml', 'lockfile'],
    ['apps/web/package-lock.json', 'lockfile'],
    ['public/app.min.js', 'generated file'],
    ['packages/core/dist/index.js', 'generated file'],
    ['vendor/lib/a.go', 'generated file'],
    ['test/__snapshots__/a.snap', 'generated file'],
  ])('skips %s', (path, reason) => {
    expect(skipReason(file(path, patch))).toBe(reason);
  });

  it('skips files with no patch', () => {
    expect(skipReason(file('logo.png', undefined))).toMatch(/no patch/);
  });

  it('keeps normal source files', () => {
    expect(skipReason(file('src/distance.ts', patch))).toBeUndefined();
  });
});

describe('buildPromptDiff', () => {
  it('reports included and skipped files', () => {
    const result = buildPromptDiff([
      file('src/a.ts', patch),
      file('pnpm-lock.yaml', patch),
      file('logo.png', undefined),
    ]);
    expect(result.included).toEqual(['src/a.ts']);
    expect(result.skipped.map((s) => s.path)).toEqual(['pnpm-lock.yaml', 'logo.png']);
    expect(result.text.startsWith('### src/a.ts')).toBe(true);
  });

  it('drops whole files that do not fit, but still includes later smaller ones', () => {
    const big = ['@@ -1,1 +1,1 @@', '+' + 'x'.repeat(500)].join('\n');
    const result = buildPromptDiff([file('big.ts', big), file('small.ts', patch)], 300);
    expect(result.included).toEqual(['small.ts']);
    expect(result.skipped).toEqual([{ path: 'big.ts', reason: 'over size budget' }]);
  });
});
