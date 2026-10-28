import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

// Where the project root can be, seen from the folder the server runs in (pnpm starts it in apps/server).
const ROOT_CANDIDATES = ['../..', '.'];

// The private key of the GitHub App, read from the file `path` names. A relative path counts from the project root.
export function readAppPrivateKey(path: string, cwd: string = process.cwd()): string {
  const candidates = isAbsolute(path) ? [path] : ROOT_CANDIDATES.map((root) => resolve(cwd, root, path));
  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, 'utf8');
    } catch {
      // try the next place
    }
  }
  throw new Error(`Cannot read the GitHub App private key at ${path} (GITHUB_APP_PRIVATE_KEY_PATH).`);
}
