import { describe, expect, it } from 'vitest';
import { PROVIDERS, defaultModel, modelOptions } from './llmProviders';

describe('PROVIDERS', () => {
  it('offers the four providers the server knows', () => {
    expect(PROVIDERS.map((p) => p.value).sort()).toEqual(['anthropic', 'google', 'openai', 'openrouter']);
  });

  it('has models for each provider, none twice', () => {
    for (const provider of PROVIDERS) {
      expect(provider.models.length).toBeGreaterThan(0);
      const ids = provider.models.map((m) => m.value);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('writes OpenRouter ids as vendor/model', () => {
    const openrouter = PROVIDERS.find((p) => p.value === 'openrouter')!;
    expect(openrouter.models.every((m) => /^[a-z0-9-]+\/[a-z0-9.-]+$/.test(m.value))).toBe(true);
  });

  it('writes the other ids without a vendor prefix', () => {
    for (const provider of PROVIDERS.filter((p) => p.value !== 'openrouter')) {
      expect(provider.models.every((m) => !m.value.includes('/'))).toBe(true);
    }
  });
});

describe('defaultModel', () => {
  it('is the first model of the provider', () => {
    expect(defaultModel('anthropic')).toBe('claude-sonnet-5-5');
  });
});

describe('modelOptions', () => {
  it('is just the list when the current model is on it, or empty', () => {
    expect(modelOptions('openai', 'gpt-6-luna')).toBe(PROVIDERS.find((p) => p.value === 'openai')!.models);
    expect(modelOptions('openai', '')).toBe(PROVIDERS.find((p) => p.value === 'openai')!.models);
  });

  it('keeps a saved model that is no longer listed, first and marked', () => {
    const options = modelOptions('google', 'gemini-3.5-flash');
    expect(options[0]).toEqual({ value: 'gemini-3.5-flash', label: 'gemini-3.5-flash · not in the list' });
    expect(options).toHaveLength(PROVIDERS.find((p) => p.value === 'google')!.models.length + 1);
  });
});
