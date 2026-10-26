// Choosing which files of a repository the model reads to learn what the project is and how it is written.
// Everything here is pure: it works on the list of paths, so it can be tested without GitHub.

export type TreeFile = { path: string; size: number };

const BINARY_OR_ASSET = /\.(png|jpe?g|gif|webp|ico|svg|bmp|pdf|zip|gz|tgz|tar|7z|rar|woff2?|ttf|otf|eot|mp[34]|mov|wav|ogg|wasm|jar|class|exe|dll|so|dylib|bin|lock|map|snap|min\.(js|css))$/i;
const NOISE_PATH = /(^|\/)(node_modules|dist|build|out|\.next|\.turbo|coverage|vendor|target|__pycache__|\.venv|venv|__snapshots__|__generated__|generated|migrations?\/meta|drizzle\/meta)(\/|$)/i;
const LOCKFILES = /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|Cargo\.lock|go\.sum|poetry\.lock|Gemfile\.lock|composer\.lock|bun\.lockb?)$/;

export const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|astro|py|go|rs|java|kt|kts|scala|rb|php|cs|swift|dart|ex|exs|clj|lua|c|h|cc|cpp|hpp)$/i;
const TEST_PATH = /(^|\/)(__tests__|tests?|spec|e2e)\/|[._-](test|spec)\.[a-z0-9]+$|_test\.go$/i;

// Files that say how the project is built, configured and checked. Read from the root and from one level down
// (for monorepos: apps/web/package.json, packages/core/tsconfig.json).
const CONFIG_NAMES = new Set([
  'package.json',
  'tsconfig.json',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'Cargo.toml',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'composer.json',
  'Gemfile',
  'biome.json',
  'ruff.toml',
  '.editorconfig',
  'Dockerfile',
  'Makefile',
  'justfile',
  '.env.example',
  'pnpm-workspace.yaml',
  'turbo.json',
  'nx.json',
]);
const CONFIG_PATTERNS = [
  /(^|\/)(\.eslintrc[^/]*|eslint\.config\.[a-z]+|\.prettierrc[^/]*|prettier\.config\.[a-z]+)$/,
  /(^|\/)docker-compose[^/]*\.ya?ml$/,
  /(^|\/)(drizzle\.config\.[a-z]+|schema\.prisma)$/,
  /^prisma\/schema\/[^/]+\.prisma$/,
];
const WORKFLOW = /^\.github\/workflows\/[^/]+\.ya?ml$/;
const DESIGN_DOC = /(^|\/)(architecture|design|conventions?|guidelines?|style[-_ ]?guide|principles)[^/]*\.md$/i;

export function isNoise(path: string): boolean {
  return BINARY_OR_ASSET.test(path) || NOISE_PATH.test(path) || LOCKFILES.test(path);
}

const depth = (path: string) => path.split('/').length - 1;
const dirOf = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf('/')));

export type ProfileSelection = {
  configs: string[];
  designDocs: string[];
  // A typical source file for each of the busiest folders, and a few typical tests.
  samples: string[];
  tests: string[];
};

export const MAX_CONFIGS = 14;
export const MAX_DESIGN_DOCS = 4;
export const MAX_SAMPLES = 12;
export const MAX_TESTS = 3;
// A source file far smaller than this says little; far larger is mostly noise for the purpose.
export const MIN_SAMPLE_BYTES = 300;
export const MAX_SAMPLE_BYTES = 12_000;

// The file in the middle of a folder by size: more typical of its folder than the biggest or the smallest.
function typical(files: TreeFile[]): TreeFile {
  const sorted = [...files].sort((a, b) => a.size - b.size || a.path.localeCompare(b.path));
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}

export function selectProfileFiles(tree: TreeFile[]): ProfileSelection {
  const files = tree.filter((file) => !isNoise(file.path));

  const configs = files
    .filter((file) => {
      const name = file.path.split('/').pop()!;
      const nearRoot = depth(file.path) <= 2;
      return (
        (nearRoot && CONFIG_NAMES.has(name)) ||
        (nearRoot && CONFIG_PATTERNS.some((pattern) => pattern.test(file.path))) ||
        WORKFLOW.test(file.path)
      );
    })
    .sort((a, b) => depth(a.path) - depth(b.path) || a.path.localeCompare(b.path))
    .slice(0, MAX_CONFIGS)
    .map((file) => file.path);

  const designDocs = files
    .filter((file) => DESIGN_DOC.test(file.path) && depth(file.path) <= 2)
    .sort((a, b) => depth(a.path) - depth(b.path) || a.path.localeCompare(b.path))
    .slice(0, MAX_DESIGN_DOCS)
    .map((file) => file.path);

  const byFolder = (candidates: TreeFile[]) => {
    const folders = new Map<string, TreeFile[]>();
    for (const file of candidates) folders.set(dirOf(file.path), [...(folders.get(dirOf(file.path)) ?? []), file]);
    return [...folders.entries()].sort(([a, filesA], [b, filesB]) => filesB.length - filesA.length || a.localeCompare(b));
  };
  const inRange = (file: TreeFile) => file.size >= MIN_SAMPLE_BYTES && file.size <= MAX_SAMPLE_BYTES;

  const sources = files.filter((file) => SOURCE_EXTENSIONS.test(file.path) && !TEST_PATH.test(file.path) && inRange(file));
  const samples = byFolder(sources)
    .slice(0, MAX_SAMPLES)
    .map(([, folderFiles]) => typical(folderFiles).path);

  const tests = files.filter((file) => SOURCE_EXTENSIONS.test(file.path) && TEST_PATH.test(file.path) && inRange(file));
  const sampleTests = byFolder(tests)
    .slice(0, MAX_TESTS)
    .map(([, folderFiles]) => typical(folderFiles).path);

  return { configs, designDocs, samples, tests: sampleTests };
}

// An outline of the folder structure: each folder down to `maxDepth` with the number of files under it,
// busiest first within a level, so the model sees how the project is laid out without every path.
export function folderOutline(tree: TreeFile[], maxDepth = 3, maxLines = 120): string[] {
  const counts = new Map<string, number>();
  for (const file of tree) {
    if (isNoise(file.path)) continue;
    const parts = file.path.split('/').slice(0, -1);
    for (let i = 1; i <= Math.min(parts.length, maxDepth); i++) {
      const folder = parts.slice(0, i).join('/');
      counts.set(folder, (counts.get(folder) ?? 0) + 1);
    }
  }
  const rootFiles = tree.filter((file) => !file.path.includes('/') && !isNoise(file.path)).map((file) => file.path);

  const lines = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, maxLines)
    .map(([folder, count]) => `${'  '.repeat(depth(`${folder}/x`) - 1)}${folder.split('/').pop()}/ (${count} files)`);
  return [rootFiles.length > 0 ? `(root) ${rootFiles.slice(0, 40).join(', ')}` : '(root)', ...lines];
}
