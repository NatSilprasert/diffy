// Reads the `linguist-generated` marks from a repository's .gitattributes, the same marks GitHub uses to
// collapse generated files in a pull request. Only that attribute is understood; everything else is ignored.

export type IsGenerated = (path: string) => boolean;

export const NOTHING_GENERATED: IsGenerated = () => false;

// A gitattributes pattern as a regular expression over the full path (no leading slash).
// "*.pb.go" matches in any folder; "gen/*.ts" and "/gen/**" are relative to the repository root.
export function patternToRegExp(pattern: string): RegExp {
  let glob = pattern.trim();
  const anchored = glob.startsWith('/') || glob.slice(0, -1).includes('/');
  glob = glob.replace(/^\//, '');
  // A trailing slash means "this folder and everything in it".
  if (glob.endsWith('/')) glob += '**';

  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i]!;
    if (char === '*') {
      if (glob[i + 1] === '*') {
        // "**/" is any number of folders, "**" at the end is anything.
        if (glob[i + 2] === '/') {
          source += '(?:.*/)?';
          i += 2;
        } else {
          source += '.*';
          i += 1;
        }
      } else {
        source += '[^/]*';
      }
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(anchored ? `^${source}$` : `(?:^|/)${source}$`);
}

// The matcher for a .gitattributes file. Later lines win, as in git: "-linguist-generated" or
// "linguist-generated=false" on a later line takes a file back out.
export function parseGeneratedAttributes(text: string | undefined): IsGenerated {
  if (!text) return NOTHING_GENERATED;

  const rules: Array<{ re: RegExp; generated: boolean }> = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const [pattern, ...attributes] = line.split(/\s+/);
    for (const attribute of attributes) {
      if (attribute === 'linguist-generated' || attribute === 'linguist-generated=true') {
        rules.push({ re: patternToRegExp(pattern!), generated: true });
      } else if (attribute === '-linguist-generated' || attribute === 'linguist-generated=false') {
        rules.push({ re: patternToRegExp(pattern!), generated: false });
      }
    }
  }
  if (rules.length === 0) return NOTHING_GENERATED;

  return (path) => {
    let generated = false;
    for (const rule of rules) if (rule.re.test(path)) generated = rule.generated;
    return generated;
  };
}
