import type { LlmWalkthroughGroup, WalkthroughRisk } from '@diffy/shared';

// The walkthrough of a pull request: its files in groups of related changes, riskiest first, so a person knows what
// to read first. The model writes it; this keeps only what is real and fits in a table.

export type WalkthroughGroup = LlmWalkthroughGroup;

export const MAX_WALKTHROUGH_GROUPS = 8;
// A change this small needs no map.
export const MIN_FILES_FOR_WALKTHROUGH = 3;
const MAX_FILES_SHOWN = 4;

const RISK_ORDER: WalkthroughRisk[] = ['high', 'medium', 'low'];
const RISK_LABEL: Record<WalkthroughRisk, string> = { high: 'High', medium: 'Medium', low: 'Low' };

// Keeps only files that are really in the review, each in one group (the riskiest one that names it), drops groups
// left with none, puts the riskiest group first and gathers the files no group mentioned into one last group.
// A change of fewer than 3 files gets no walkthrough.
export function verifyWalkthrough(groups: readonly WalkthroughGroup[], includedPaths: readonly string[]): WalkthroughGroup[] {
  if (includedPaths.length < MIN_FILES_FOR_WALKTHROUGH) return [];
  const known = new Set(includedPaths);

  const sorted = [...groups].sort((a, b) => RISK_ORDER.indexOf(a.risk) - RISK_ORDER.indexOf(b.risk));
  const placed = new Set<string>();
  const kept: WalkthroughGroup[] = [];
  for (const group of sorted) {
    const files = [...new Set(group.files.map((path) => path.replace(/^\.?\//, '')))].filter((path) => known.has(path) && !placed.has(path));
    if (files.length === 0 || group.title.trim() === '') continue;
    files.forEach((path) => placed.add(path));
    kept.push({ ...group, title: group.title.trim(), description: group.description.trim(), files });
    if (kept.length === MAX_WALKTHROUGH_GROUPS) break;
  }
  if (kept.length === 0) return [];

  const rest = includedPaths.filter((path) => !placed.has(path));
  if (rest.length > 0) kept.push({ title: 'Other files', description: 'Not covered by the groups above.', files: rest, risk: 'low' });
  return kept;
}

// Text that goes into a table cell: one line, and no pipe that would end the cell.
const cell = (text: string) => text.replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim();

export function renderWalkthrough(groups: readonly WalkthroughGroup[]): string {
  if (groups.length === 0) return '';
  const rows = groups.map((group) => {
    const shown = group.files.slice(0, MAX_FILES_SHOWN).map((path) => `\`${path}\``);
    const more = group.files.length > MAX_FILES_SHOWN ? ` and ${group.files.length - MAX_FILES_SHOWN} more` : '';
    return `| ${RISK_LABEL[group.risk]} | **${cell(group.title)}**: ${cell(group.description)} | ${shown.join(', ')}${more} |`;
  });
  return ['### Walkthrough', '', '| Look closely | What changed | Files |', '|---|---|---|', ...rows].join('\n');
}
