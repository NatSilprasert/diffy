import { describe, expect, it } from 'vitest';
import { MAX_WALKTHROUGH_GROUPS, renderWalkthrough, verifyWalkthrough, type WalkthroughGroup } from '../src/walkthrough.js';

const group = (over: Partial<WalkthroughGroup> = {}): WalkthroughGroup => ({
  title: 'Login flow',
  description: 'Adds the form.',
  files: ['src/login.tsx'],
  risk: 'medium',
  ...over,
});

const paths = ['src/login.tsx', 'src/auth.ts', 'src/db.ts', 'docs/a.md'];

describe('verifyWalkthrough', () => {
  it('gives nothing for a small change', () => {
    expect(verifyWalkthrough([group()], ['a.ts', 'b.ts'])).toEqual([]);
    expect(verifyWalkthrough([], paths)).toEqual([]);
  });

  it('puts the riskiest group first, keeping the order of equals', () => {
    const result = verifyWalkthrough(
      [
        group({ title: 'Docs', risk: 'low', files: ['docs/a.md'] }),
        group({ title: 'Auth', risk: 'high', files: ['src/auth.ts'] }),
        group({ title: 'Form', risk: 'medium', files: ['src/login.tsx'] }),
        group({ title: 'Database', risk: 'medium', files: ['src/db.ts'] }),
      ],
      paths,
    );
    expect(result.map((g) => g.title)).toEqual(['Auth', 'Form', 'Database', 'Docs']);
  });

  it('drops files that are not in the review, and a group left with none', () => {
    const result = verifyWalkthrough(
      [group({ files: ['src/login.tsx', 'src/imaginary.ts', './src/auth.ts'] }), group({ title: 'Ghost', files: ['nope.ts'] })],
      paths,
    );
    expect(result[0]!.files).toEqual(['src/login.tsx', 'src/auth.ts']);
    expect(result.map((g) => g.title)).not.toContain('Ghost');
  });

  it('lists a file once, in the riskiest group that names it', () => {
    const result = verifyWalkthrough([group({ title: 'Low', risk: 'low', files: ['src/auth.ts'] }), group({ title: 'High', risk: 'high', files: ['src/auth.ts'] })], paths);
    expect(result.find((g) => g.title === 'High')!.files).toEqual(['src/auth.ts']);
    expect(result.find((g) => g.title === 'Low')).toBeUndefined();
  });

  it('gathers the files no group named into a last group', () => {
    const result = verifyWalkthrough([group({ files: ['src/login.tsx'] })], paths);
    expect(result.at(-1)).toEqual({ title: 'Other files', description: 'Not covered by the groups above.', files: ['src/auth.ts', 'src/db.ts', 'docs/a.md'], risk: 'low' });
  });

  it('adds no "Other files" when every file is covered', () => {
    expect(verifyWalkthrough([group({ files: paths })], paths).map((g) => g.title)).toEqual(['Login flow']);
  });

  it('skips a group without a title, and keeps at most the limit', () => {
    expect(verifyWalkthrough([group({ title: '  ' })], paths)).toEqual([]);
    const many = Array.from({ length: 12 }, (_, i) => group({ title: `G${i}`, files: [`f${i}.ts`] }));
    const fs = many.flatMap((g) => g.files);
    const result = verifyWalkthrough(many, fs);
    expect(result.filter((g) => g.title !== 'Other files')).toHaveLength(MAX_WALKTHROUGH_GROUPS);
  });
});

describe('renderWalkthrough', () => {
  it('is empty for no groups', () => {
    expect(renderWalkthrough([])).toBe('');
  });

  it('writes a table with the risk, what changed and the files', () => {
    const text = renderWalkthrough([group({ risk: 'high', title: 'Auth', description: 'Reads the token.', files: ['src/auth.ts'] })]);
    expect(text).toBe(
      ['### Walkthrough', '', '| Look closely | What changed | Files |', '|---|---|---|', '| High | **Auth**: Reads the token. | `src/auth.ts` |'].join('\n'),
    );
  });

  it('shows the first files of a long list and says how many more there are', () => {
    const files = Array.from({ length: 7 }, (_, i) => `f${i}.ts`);
    expect(renderWalkthrough([group({ files })])).toContain('`f0.ts`, `f1.ts`, `f2.ts`, `f3.ts` and 3 more |');
  });

  it('keeps a title or description from breaking the table: no pipe, no new line', () => {
    const text = renderWalkthrough([group({ title: 'a | b', description: 'line one\nline two' })]);
    const row = text.split('\n').at(-1)!;
    expect(row).toContain('**a \\| b**: line one line two');
    expect(row.split(/(?<!\\)\|/)).toHaveLength(5); // empty, risk, what changed, files, empty
  });
});
