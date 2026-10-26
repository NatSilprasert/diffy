import { describe, expect, it } from 'vitest';
import { parseInline, parseProfileMarkdown } from './profileMarkdown';

const text = (value: string) => ({ type: 'text', value });

describe('parseInline', () => {
  it('leaves plain text as it is', () => {
    expect(parseInline('Just words.')).toEqual([text('Just words.')]);
  });

  it('finds bold, code and italic, in order, with the text between them', () => {
    expect(parseInline('a **b** c `d` e _f_ g')).toEqual([
      text('a '),
      { type: 'bold', children: [text('b')] },
      text(' c '),
      { type: 'code', value: 'd' },
      text(' e '),
      { type: 'italic', children: [text('f')] },
      text(' g'),
    ]);
  });

  it('reads the evidence the profile writes after each rule: italic holding code', () => {
    expect(parseInline('Rule. _(`a.ts`, `b.ts`)_')).toEqual([
      text('Rule. '),
      { type: 'italic', children: [text('('), { type: 'code', value: 'a.ts' }, text(', '), { type: 'code', value: 'b.ts' }, text(')')] },
    ]);
  });

  it('does not take underscores inside words for italics', () => {
    expect(parseInline('use snake_case_names here')).toEqual([text('use snake_case_names here')]);
  });

  it('leaves markers that never close as text', () => {
    expect(parseInline('a **b and `c')).toEqual([text('a **b and `c')]);
  });

  it('keeps tags and links as text', () => {
    expect(parseInline('<script>alert(1)</script> [x](http://y)')).toEqual([text('<script>alert(1)</script> [x](http://y)')]);
  });
});

describe('parseProfileMarkdown', () => {
  it('reads headings, lists and paragraphs', () => {
    expect(parseProfileMarkdown('## Overview\n\nA shop.\nFor students.\n\n## Rules\n- one\n- **two**\n')).toEqual([
      { type: 'heading', children: [text('Overview')] },
      { type: 'paragraph', children: [text('A shop. For students.')] },
      { type: 'heading', children: [text('Rules')] },
      { type: 'list', items: [[text('one')], [{ type: 'bold', children: [text('two')] }]] },
    ]);
  });

  it('reads a list that follows a heading directly, as the profile writes it', () => {
    const blocks = parseProfileMarkdown('## Conventions\n- a\n- b');
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'list']);
  });

  it('ends a list at a paragraph, and takes * as a bullet too', () => {
    expect(parseProfileMarkdown('* a\nthen text').map((b) => b.type)).toEqual(['list', 'paragraph']);
  });

  it('is empty for empty text', () => {
    expect(parseProfileMarkdown('')).toEqual([]);
    expect(parseProfileMarkdown('  \n\n ')).toEqual([]);
  });
});
