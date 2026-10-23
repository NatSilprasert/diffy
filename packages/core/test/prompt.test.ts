import { describe, expect, it } from 'vitest';
import { LlmProvider } from '@diffy/shared';
import { createModel } from '../src/llm.js';
import { MAX_PR_BODY_CHARS, SYSTEM_PROMPT, buildUserPrompt } from '../src/prompt.js';
import type { PullRequestInfo } from '../src/github.js';

const pr: PullRequestInfo = {
  owner: 'acme',
  repo: 'api',
  number: 7,
  title: 'Add login',
  body: 'Adds login.',
  url: 'https://github.com/acme/api/pull/7',
  headSha: 'abc1234',
  isDraft: false,
  authorLogin: 'dev',
  authorIsBot: false,
};

describe('buildUserPrompt', () => {
  const diff = { text: '### a.ts (modified)\n   1 + x', included: ['a.ts'], skipped: [{ path: 'pnpm-lock.yaml', reason: 'lockfile' }] };

  it('includes PR metadata, file counts and the diff', () => {
    const prompt = buildUserPrompt(pr, diff);
    expect(prompt).toContain('Repository: acme/api');
    expect(prompt).toContain('PR #7: Add login');
    expect(prompt).toContain('Changed files (2; 1 skipped');
    expect(prompt).toContain('- a.ts');
    expect(prompt).toContain('<diff>\n### a.ts (modified)');
  });

  it('truncates a very long description', () => {
    const prompt = buildUserPrompt({ ...pr, body: 'x'.repeat(MAX_PR_BODY_CHARS + 500) }, diff);
    expect(prompt).toContain('[truncated]');
    expect(prompt).not.toContain('x'.repeat(MAX_PR_BODY_CHARS + 1));
  });

  it('marks an empty description', () => {
    expect(buildUserPrompt({ ...pr, body: '' }, diff)).toContain('(empty)');
  });
});

describe('SYSTEM_PROMPT', () => {
  it('tells the model to treat PR content as untrusted', () => {
    expect(SYSTEM_PROMPT).toContain('untrusted input');
  });
});

describe('createModel', () => {
  it.each(LlmProvider.options)('builds a model for %s without calling the network', (provider) => {
    const model = createModel({ provider, model: 'some-model', apiKey: 'test-key' });
    expect(model).toMatchObject({ modelId: 'some-model' });
  });
});
