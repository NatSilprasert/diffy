import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// openapi.json is what the web app's client is generated from, so a wrong description here becomes a wrong
// type there that still compiles. These checks read the committed file; regenerate it with
// `pnpm --filter @diffy/server gen:openapi` after changing a DTO.
const doc = JSON.parse(readFileSync(new URL('../openapi.json', import.meta.url), 'utf8')) as {
  paths: Record<string, Record<string, { operationId?: string }>>;
  components: { schemas: Record<string, unknown> };
};

type Schema = { type?: string; items?: { type?: string }; properties?: Record<string, Schema> };

function* properties(schema: Schema, path: string): Generator<{ path: string; schema: Schema }> {
  for (const [name, child] of Object.entries(schema.properties ?? {})) {
    yield { path: `${path}.${name}`, schema: child };
    yield* properties(child, `${path}.${name}`);
    if (child.items) yield* properties(child.items as Schema, `${path}.${name}[]`);
  }
}

describe('openapi.json', () => {
  it('has no property described as a plain array of strings', () => {
    // A top-level `z.string().nullable()` is turned into exactly this by @nestjs/swagger, dropping the null.
    // Give the string a .describe() (Zod then writes anyOf, which survives). If a DTO really holds a list of
    // strings, add it to an allow-list here.
    const suspects = Object.entries(doc.components.schemas).flatMap(([name, schema]) =>
      [...properties(schema as Schema, name)]
        .filter(({ schema: s }) => s.type === 'array' && s.items?.type === 'string')
        .map(({ path }) => path),
    );
    expect(suspects).toEqual([]);
  });

  it('gives every operation a unique operationId (they become the web hooks\' names)', () => {
    const ids = Object.values(doc.paths).flatMap((methods) => Object.values(methods).map((op) => op.operationId));
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
