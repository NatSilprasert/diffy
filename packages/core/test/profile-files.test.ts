import { describe, expect, it } from 'vitest';
import { MAX_CONFIGS, MAX_SAMPLES, folderOutline, isNoise, selectProfileFiles, type TreeFile } from '../src/profile-files.js';

const f = (path: string, size = 2_000): TreeFile => ({ path, size });

describe('isNoise', () => {
  it.each([
    'logo.png',
    'node_modules/x/index.js',
    'dist/index.js',
    'pnpm-lock.yaml',
    'apps/web/.next/server.js',
    'drizzle/meta/0002_snapshot.json',
    'src/__snapshots__/a.snap',
    'src/api/__generated__/types.ts',
  ])('%s is noise', (path) => {
    expect(isNoise(path)).toBe(true);
  });

  it.each(['src/index.ts', 'package.json', 'docs/ARCHITECTURE.md', '.github/workflows/ci.yml'])('%s is not', (path) => {
    expect(isNoise(path)).toBe(false);
  });
});

describe('selectProfileFiles', () => {
  it('finds configuration at the root and one folder down, and the workflows', () => {
    const { configs } = selectProfileFiles([
      f('package.json'),
      f('tsconfig.json'),
      f('apps/web/package.json'),
      f('apps/web/src/deep/nested/package.json'),
      f('prisma/schema.prisma'),
      f('.github/workflows/ci.yml'),
      f('eslint.config.mjs'),
      f('README.md'),
    ]);
    // Root files first, then by depth, then by name.
    expect(configs).toEqual(['eslint.config.mjs', 'package.json', 'tsconfig.json', 'prisma/schema.prisma', '.github/workflows/ci.yml', 'apps/web/package.json']);
  });

  it('does not take more configuration files than the limit', () => {
    const many = Array.from({ length: 40 }, (_, i) => f(`pkg${i}/package.json`));
    expect(selectProfileFiles(many).configs).toHaveLength(MAX_CONFIGS);
  });

  it('finds design documents', () => {
    expect(selectProfileFiles([f('docs/ARCHITECTURE.md'), f('docs/style-guide.md'), f('docs/random.md')]).designDocs).toEqual([
      'docs/ARCHITECTURE.md',
      'docs/style-guide.md',
    ]);
  });

  it('samples one typical file from each of the busiest folders, not the biggest', () => {
    const tree = [
      f('src/api/a.ts', 500),
      f('src/api/b.ts', 2_000),
      f('src/api/c.ts', 9_000),
      f('src/ui/x.tsx', 1_000),
      f('src/ui/y.tsx', 1_500),
      f('src/lib/one.ts', 800),
    ];
    // src/api has 3 files, src/ui 2, src/lib 1; the middle file by size is taken from each.
    expect(selectProfileFiles(tree).samples).toEqual(['src/api/b.ts', 'src/ui/x.tsx', 'src/lib/one.ts']);
  });

  it('leaves out files that are too small or too big to learn from, tests, and generated files', () => {
    const tree = [f('src/tiny.ts', 50), f('src/huge.ts', 200_000), f('src/a.test.ts', 2_000), f('dist/a.js', 2_000), f('src/ok.ts', 2_000)];
    const { samples, tests } = selectProfileFiles(tree);
    expect(samples).toEqual(['src/ok.ts']);
    expect(tests).toEqual(['src/a.test.ts']);
  });

  it('does not sample more folders than the limit', () => {
    const tree = Array.from({ length: 30 }, (_, i) => f(`src/mod${i}/index.ts`));
    expect(selectProfileFiles(tree).samples).toHaveLength(MAX_SAMPLES);
  });

  it('gives empty lists for an empty repository', () => {
    expect(selectProfileFiles([])).toEqual({ configs: [], designDocs: [], samples: [], tests: [] });
  });
});

describe('folderOutline', () => {
  it('lists folders with the number of files under each, indented by depth, skipping noise', () => {
    const outline = folderOutline([f('README.md'), f('src/a.ts'), f('src/api/b.ts'), f('src/api/c.ts'), f('node_modules/x/y.js'), f('dist/z.js')]);
    expect(outline).toEqual(['(root) README.md', 'src/ (3 files)', '  api/ (2 files)']);
  });

  it('stops at the depth and line limits', () => {
    expect(folderOutline([f('a/b/c/d/e.ts')], 2)).toEqual(['(root)', 'a/ (1 files)', '  b/ (1 files)']);
    const wide = Array.from({ length: 50 }, (_, i) => f(`dir${String(i).padStart(2, '0')}/x.ts`));
    expect(folderOutline(wide, 3, 10)).toHaveLength(11);
  });
});
