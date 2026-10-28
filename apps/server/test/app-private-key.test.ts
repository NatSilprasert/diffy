import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readAppPrivateKey } from '../src/infra/github/app-private-key';

describe('readAppPrivateKey', () => {
  const root = mkdtempSync(join(tmpdir(), 'diffy-root-'));
  const server = join(root, 'apps', 'server');
  mkdirSync(server, { recursive: true });
  writeFileSync(join(root, 'app.pem'), 'KEY-AT-ROOT');

  it('reads a relative path from the project root, seen from apps/server', () => {
    expect(readAppPrivateKey('app.pem', server)).toBe('KEY-AT-ROOT');
  });

  it('reads a relative path from the folder the server runs in, when that is the root', () => {
    expect(readAppPrivateKey('app.pem', root)).toBe('KEY-AT-ROOT');
  });

  it('reads an absolute path as it is', () => {
    expect(readAppPrivateKey(join(root, 'app.pem'), '/nowhere')).toBe('KEY-AT-ROOT');
  });

  it('says which setting is wrong when the file is missing', () => {
    expect(() => readAppPrivateKey('missing.pem', server)).toThrow('Cannot read the GitHub App private key at missing.pem (GITHUB_APP_PRIVATE_KEY_PATH).');
  });
});
