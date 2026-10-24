import type { UpdateLlmSettingsRequestDtoProvider as Provider } from '@/api/generated/model';

export type ProviderValue = (typeof Provider)[keyof typeof Provider];
export type ModelOption = { value: string; label: string };
export type ProviderInfo = { value: ProviderValue; label: string; keyUrl: string; models: ModelOption[] };

// The models offered in Settings. The first one of each provider is the default for that provider.
// Checked against the providers' own model pages and OpenRouter's catalogue on 2026-10-25; retired models and
// previews are left out, and every model here can return structured output, which a review needs.
// Models change often. When one is added or retired, this list is the only place to edit.
export const PROVIDERS: ReadonlyArray<ProviderInfo> = [
  {
    value: 'anthropic',
    label: 'Anthropic',
    keyUrl: 'https://platform.claude.com/settings/keys',
    models: [
      { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 · fast, balanced' },
      { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 · fastest, cheapest' },
      { value: 'claude-opus-5-5', label: 'Claude Opus 5.5 · long-running coding work' },
      { value: 'claude-fable-5-1', label: 'Claude Fable 5.1 · most capable' },
    ],
  },
  {
    value: 'openai',
    label: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    models: [
      { value: 'gpt-6.1-sol', label: 'GPT-6.1 Sol · balanced' },
      { value: 'gpt-6-luna', label: 'GPT-6 Luna · efficient' },
      { value: 'gpt-6-astra', label: 'GPT-6 Astra · most capable' },
    ],
  },
  {
    value: 'google',
    label: 'Google Gemini',
    keyUrl: 'https://aistudio.google.com/apikey',
    models: [
      { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash · fast, balanced' },
      { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
      { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite · cheapest' },
      { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite' },
      { value: 'gemini-4-argon', label: 'Gemini 4 Argon · most capable' },
    ],
  },
  {
    value: 'openrouter',
    label: 'OpenRouter',
    keyUrl: 'https://openrouter.ai/keys',
    models: [
      { value: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5' },
      { value: 'anthropic/claude-haiku-5.5', label: 'Claude Haiku 5.5' },
      { value: 'anthropic/claude-opus-5.5', label: 'Claude Opus 5.5' },
      { value: 'anthropic/claude-fable-5.1', label: 'Claude Fable 5.1' },
      { value: 'openai/gpt-6.1-sol', label: 'GPT-6.1 Sol' },
      { value: 'openai/gpt-6-luna', label: 'GPT-6 Luna' },
      { value: 'openai/gpt-6-astra', label: 'GPT-6 Astra' },
      { value: 'google/gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
      { value: 'google/gemini-4-argon', label: 'Gemini 4 Argon' },
      { value: 'x-ai/grok-4.7', label: 'Grok 4.7' },
      { value: 'deepseek/deepseek-v4.1-flash', label: 'DeepSeek V4.1 Flash' },
      { value: 'mistralai/mistral-large-4-0', label: 'Mistral Large 4' },
      { value: 'qwen/qwen3.8-max-0902', label: 'Qwen3.8 Max' },
    ],
  },
];

export const providerInfo = (value: string | null | undefined) => PROVIDERS.find((p) => p.value === value);

export const defaultModel = (provider: ProviderValue) => providerInfo(provider)!.models[0]!.value;

// The models of a provider as the dropdown shows them. A model that is saved but no longer on the list stays
// selectable, marked, so opening Settings never silently swaps the model for another one.
export function modelOptions(provider: ProviderValue, current: string): ModelOption[] {
  const models = providerInfo(provider)!.models;
  return current === '' || models.some((m) => m.value === current)
    ? models
    : [{ value: current, label: `${current} · not in the list` }, ...models];
}
