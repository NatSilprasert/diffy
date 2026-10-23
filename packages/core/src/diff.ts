export type PatchLine = {
  type: 'context' | 'add' | 'del';
  // Line number in the new file. Undefined for deleted lines (they only exist on the old side).
  newLine: number | undefined;
  text: string;
};

export type Hunk = {
  header: string;
  newStart: number;
  lines: PatchLine[];
};

export type CommentableHunk = {
  hunkId: number;
  lines: Set<number>;
};

// path -> hunks. GitHub accepts RIGHT-side comments on any added or context line inside a hunk.
export type CommentableIndex = Map<string, CommentableHunk[]>;

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parsePatch(patch: string): Hunk[] {
  const hunks: Hunk[] = [];
  let current: Hunk | undefined;
  let newLine = 0;

  for (const raw of patch.split('\n')) {
    const header = HUNK_HEADER.exec(raw);
    if (header) {
      newLine = Number(header[1]);
      current = { header: raw, newStart: newLine, lines: [] };
      hunks.push(current);
      continue;
    }
    if (!current) continue;

    const marker = raw[0];
    const text = raw.slice(1);
    if (marker === '+') {
      current.lines.push({ type: 'add', newLine, text });
      newLine++;
    } else if (marker === '-') {
      current.lines.push({ type: 'del', newLine: undefined, text });
    } else if (marker === ' ') {
      current.lines.push({ type: 'context', newLine, text });
      newLine++;
    }
    // "\ No newline at end of file" and the empty string after the final \n are ignored.
  }
  return hunks;
}

export function buildCommentableIndex(
  files: ReadonlyArray<{ path: string; patch: string | undefined }>,
): CommentableIndex {
  const index: CommentableIndex = new Map();
  for (const file of files) {
    if (file.patch === undefined) continue;
    const hunks = parsePatch(file.patch).map((hunk, hunkId) => ({
      hunkId,
      lines: new Set(hunk.lines.flatMap((l) => (l.newLine === undefined ? [] : [l.newLine]))),
    }));
    index.set(file.path, hunks);
  }
  return index;
}
