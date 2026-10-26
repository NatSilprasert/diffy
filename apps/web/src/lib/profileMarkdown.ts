// The project profile is markdown, but only a small part of it: ## headings, "- " lists, paragraphs, and inside
// them **bold**, `code` and _italic_. This turns that text into plain data, so the page can build its elements
// from it. Nothing here produces HTML: whatever else the text holds (tags, links) stays text.

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'bold'; children: Inline[] }
  | { type: 'italic'; children: Inline[] }
  | { type: 'code'; value: string };

export type Block =
  | { type: 'heading'; children: Inline[] }
  | { type: 'list'; items: Inline[][] }
  | { type: 'paragraph'; children: Inline[] };

// `_` only opens or closes italics at the edge of a word, so snake_case_names stay as they are.
const INLINE = /\*\*(.+?)\*\*|`([^`]+)`|(?<![A-Za-z0-9])_(?!\s)(.+?)(?<!\s)_(?![A-Za-z0-9])/;

export function parseInline(text: string): Inline[] {
  const nodes: Inline[] = [];
  let rest = text;
  while (rest.length > 0) {
    const match = INLINE.exec(rest);
    if (!match) {
      nodes.push({ type: 'text', value: rest });
      break;
    }
    if (match.index > 0) nodes.push({ type: 'text', value: rest.slice(0, match.index) });
    if (match[1] !== undefined) nodes.push({ type: 'bold', children: parseInline(match[1]) });
    else if (match[2] !== undefined) nodes.push({ type: 'code', value: match[2] });
    else nodes.push({ type: 'italic', children: parseInline(match[3]!) });
    rest = rest.slice(match.index + match[0].length);
  }
  return nodes;
}

export function parseProfileMarkdown(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: Inline[][] = [];

  const endParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: 'paragraph', children: parseInline(paragraph.join(' ')) });
    paragraph = [];
  };
  const endList = () => {
    if (list.length > 0) blocks.push({ type: 'list', items: list });
    list = [];
  };

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    const item = /^[-*]\s+(.+)$/.exec(line);

    if (line === '') {
      endParagraph();
      endList();
    } else if (heading) {
      endParagraph();
      endList();
      blocks.push({ type: 'heading', children: parseInline(heading[1]!) });
    } else if (item) {
      endParagraph();
      list.push(parseInline(item[1]!));
    } else {
      endList();
      paragraph.push(line);
    }
  }
  endParagraph();
  endList();
  return blocks;
}
