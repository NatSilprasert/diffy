import { defineConfig } from 'orval';

// Turns the server's openapi.json into typed fetch functions and React Query hooks.
// Change a DTO on the server, run `pnpm gen:api`, and every page that used the old shape stops compiling.
export default defineConfig({
  diffy: {
    input: { target: '../server/openapi.json' },
    output: {
      mode: 'single',
      target: './src/api/generated/diffy.ts',
      schemas: './src/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        mutator: { path: './src/api/fetcher.ts', name: 'apiFetch' },
      },
    },
  },
});
