import { describe, expect, it } from 'vitest';
import { annotateFile, buildPromptDiff, filePriority, skipReason } from '../src/annotate.js';
import { parseGeneratedAttributes } from '../src/gitattributes.js';
import { ignoreMatcher } from '../src/repo-config.js';
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
    ['drizzle/meta/0002_snapshot.json', 'generated file'],
    ['db/migrations/meta/0001_snapshot.json', 'generated file'],
    ['src/__generated__/graphql.ts', 'generated file'],
    ['src/api/schema.generated.ts', 'generated file'],
    ['proto/user.pb.go', 'generated file'],
    ['proto/user_pb2.py', 'generated file'],
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

describe('skipReason with .gitattributes', () => {
  it('skips what .gitattributes marks generated', () => {
    const isGenerated = parseGeneratedAttributes('api/client/** linguist-generated');
    expect(skipReason(file('api/client/index.ts', patch), isGenerated)).toBe('generated file (.gitattributes)');
    expect(skipReason(file('src/index.ts', patch), isGenerated)).toBeUndefined();
  });
});

describe('filePriority', () => {
  it.each([
    ['src/app/page.tsx', 0],
    ['server/users.repository.ts', 0],
    ['migrations/0002.sql', 0],
    ['main.go', 0],
    ['src/login-schema.test.ts', 1],
    ['test/annotate.test.ts', 1],
    ['__tests__/a.js', 1],
    ['pkg/user_test.go', 1],
    ['package.json', 2],
    ['README.md', 2],
    ['styles/app.css', 2],
  ])('%s is %i', (path, priority) => {
    expect(filePriority(path)).toBe(priority);
  });
});

describe('buildPromptDiff choosing what fits', () => {
  const sized = (n: number) => ['@@ -1,1 +1,1 @@', '+' + 'x'.repeat(n)].join('\n');

  it('fills the budget with code before tests and before other files, whatever their order', () => {
    const files = [file('a.json', sized(100)), file('b.test.ts', sized(100)), file('c.ts', sized(100))];
    // Room for one file only.
    expect(buildPromptDiff(files, 200).included).toEqual(['c.ts']);
    // Room for two: code and then the test.
    expect(buildPromptDiff(files, 400).included).toEqual(['b.test.ts', 'c.ts']);
  });

  it('takes the smaller files of the same kind first, so more of them fit', () => {
    const files = [file('big.ts', sized(400)), file('one.ts', sized(100)), file('two.ts', sized(100))];
    const result = buildPromptDiff(files, 400);
    expect(result.included).toEqual(['one.ts', 'two.ts']);
    expect(result.skipped).toEqual([{ path: 'big.ts', reason: 'over size budget' }]);
  });

  it('keeps the pull request order in the prompt and in the skipped list', () => {
    const files = [file('z.md', sized(10)), file('a.ts', sized(10)), file('pnpm-lock.yaml', patch), file('m.ts', sized(10))];
    const result = buildPromptDiff(files, 10_000);
    expect(result.included).toEqual(['z.md', 'a.ts', 'm.ts']);
    expect(result.text.indexOf('### z.md')).toBeLessThan(result.text.indexOf('### a.ts'));
    expect(result.skipped.map((s) => s.path)).toEqual(['pnpm-lock.yaml']);
  });
});

describe('ignore patterns of .diffy.yaml', () => {
  it('skips matching files, even ones that would otherwise be reviewed', () => {
    const isIgnored = ignoreMatcher(['docs/**', '*.svg']);
    expect(skipReason(file('docs/guide.md', patch), undefined, isIgnored)).toBe('ignored by .diffy.yaml');
    expect(skipReason(file('src/logo.svg', patch), undefined, isIgnored)).toBe('ignored by .diffy.yaml');
    expect(skipReason(file('src/app.ts', patch), undefined, isIgnored)).toBeUndefined();
  });

  it('keeps ignored files out of the prompt and lists them as skipped', () => {
    const result = buildPromptDiff([file('docs/guide.md', patch), file('src/app.ts', patch)], 10_000, { isIgnored: ignoreMatcher(['docs/**']) });
    expect(result.included).toEqual(['src/app.ts']);
    expect(result.skipped).toEqual([{ path: 'docs/guide.md', reason: 'ignored by .diffy.yaml' }]);
  });
});
