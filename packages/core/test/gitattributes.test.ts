import { describe, expect, it } from 'vitest';
import { parseGeneratedAttributes, patternToRegExp } from '../src/gitattributes.js';

describe('patternToRegExp', () => {
  it.each([
    ['*.pb.go', 'a/b/user.pb.go', true],
    ['*.pb.go', 'user.pb.go', true],
    ['*.pb.go', 'user.go', false],
    ['gen/*.ts', 'gen/a.ts', true],
    ['gen/*.ts', 'src/gen/a.ts', false],
    ['gen/*.ts', 'gen/sub/a.ts', false],
    ['/gen/**', 'gen/sub/a.ts', true],
    ['docs/api/', 'docs/api/index.md', true],
    ['**/generated/*.ts', 'a/b/generated/x.ts', true],
    ['**/generated/*.ts', 'generated/x.ts', true],
    ['file?.txt', 'file1.txt', true],
    ['file?.txt', 'file12.txt', false],
  ])('%s against %s is %s', (pattern, path, expected) => {
    expect(patternToRegExp(pattern).test(path)).toBe(expected);
  });
});

describe('parseGeneratedAttributes', () => {
  it('marks nothing without a file or without the attribute', () => {
    expect(parseGeneratedAttributes(undefined)('a.ts')).toBe(false);
    expect(parseGeneratedAttributes('*.ts text eol=lf')('a.ts')).toBe(false);
  });

  it('understands both spellings of the attribute and ignores comments', () => {
    const isGenerated = parseGeneratedAttributes('# generated code\napi/** linguist-generated\n*.snap linguist-generated=true');
    expect(isGenerated('api/client.ts')).toBe(true);
    expect(isGenerated('x/a.snap')).toBe(true);
    expect(isGenerated('src/a.ts')).toBe(false);
  });

  it('lets a later line take a file back out', () => {
    const isGenerated = parseGeneratedAttributes('api/** linguist-generated\napi/handwritten.ts -linguist-generated');
    expect(isGenerated('api/client.ts')).toBe(true);
    expect(isGenerated('api/handwritten.ts')).toBe(false);
  });
});
