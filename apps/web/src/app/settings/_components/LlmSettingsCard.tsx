'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  getGetSettingsQueryKey,
  useGetSettings,
  useTestLlmSettings,
  useUpdateLlmSettings,
} from '@/api/generated/diffy';
import { UpdateLlmSettingsRequestDtoProvider as Provider } from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/Select';

type ProviderValue = (typeof Provider)[keyof typeof Provider];

// Model names are only examples (any model the provider offers can be typed). OpenRouter has too many to list.
const PROVIDERS: ReadonlyArray<{ value: ProviderValue; label: string; keyUrl: string; models: string[] }> = [
  { value: 'openai', label: 'OpenAI', keyUrl: 'https://platform.openai.com/api-keys', models: ['gpt-4o-mini', 'gpt-4o'] },
  { value: 'anthropic', label: 'Anthropic', keyUrl: 'https://console.anthropic.com', models: ['claude-sonnet-5-5', 'claude-haiku-5-5'] },
  { value: 'google', label: 'Google Gemini', keyUrl: 'https://aistudio.google.com/apikey', models: ['gemini-2.5-flash', 'gemini-2.5-pro'] },
  { value: 'openrouter', label: 'OpenRouter', keyUrl: 'https://openrouter.ai/keys', models: [] },
];

export function LlmSettingsCard() {
  const queryClient = useQueryClient();
  const settings = useGetSettings();
  const saved = settings.data?.llm;

  // What the user typed. Anything not edited shows the saved value, so the form needs no "load" step.
  const [edits, setEdits] = useState<{ provider?: ProviderValue; model?: string; apiKey?: string }>({});
  const provider = edits.provider ?? saved?.provider ?? undefined;
  const model = edits.model ?? saved?.model ?? '';
  const apiKey = edits.apiKey ?? '';
  const dirty = edits.provider !== undefined || edits.model !== undefined || edits.apiKey !== undefined;

  // The saved key only works for the provider it was saved with.
  const keepsSavedKey = Boolean(saved?.configured) && provider === saved?.provider;
  const needsKey = !keepsSavedKey;
  const canSave = Boolean(provider) && model.trim() !== '' && (!needsKey || apiKey.trim() !== '');

  const update = useUpdateLlmSettings({
    mutation: {
      onSuccess: async () => {
        setEdits({});
        test.reset();
        await queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      },
    },
  });
  const test = useTestLlmSettings();

  const current = PROVIDERS.find((p) => p.value === provider);
  const result = test.data;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Model</CardTitle>
          {saved?.configured && <Badge className="bg-success/15 text-success">Configured</Badge>}
        </div>
        <CardDescription>The model that reviews your pull requests, and the key diffy uses to reach it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {settings.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {settings.isError && <p className="text-sm text-destructive">{settings.error.message}</p>}

        {settings.isSuccess && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!provider) return;
              update.mutate({
                data: { provider, model: model.trim(), ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) },
              });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="llm-provider">Provider</Label>
              <Select
                id="llm-provider"
                className="w-full sm:w-72"
                placeholder="Choose a provider"
                value={provider}
                onChange={(value) => setEdits((e) => ({ ...e, provider: value }))}
                options={PROVIDERS}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="llm-model">Model</Label>
              <Input
                id="llm-model"
                list="llm-model-examples"
                autoComplete="off"
                spellCheck={false}
                className="sm:w-72"
                placeholder={current?.models[0] ?? 'model name'}
                value={model}
                onChange={(event) => setEdits((e) => ({ ...e, model: event.target.value }))}
              />
              <datalist id="llm-model-examples">
                {current?.models.map((name) => <option key={name} value={name} />)}
              </datalist>
              <p className="text-xs text-muted-foreground">Type any model name the provider offers; the list holds examples.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="llm-key">API key</Label>
              <Input
                id="llm-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                className="sm:w-72"
                placeholder={keepsSavedKey ? '•••••••• saved (leave empty to keep it)' : 'Paste your API key'}
                value={apiKey}
                onChange={(event) => setEdits((e) => ({ ...e, apiKey: event.target.value }))}
              />
              {provider && needsKey && saved?.provider && provider !== saved.provider && (
                <p className="text-xs text-muted-foreground">
                  A key is needed because the provider changed; the saved one belongs to{' '}
                  {PROVIDERS.find((p) => p.value === saved.provider)?.label}.
                </p>
              )}
              {current && (
                <p className="text-xs text-muted-foreground">
                  Get a key at{' '}
                  <a className="underline" href={current.keyUrl} target="_blank" rel="noreferrer">
                    {new URL(current.keyUrl).host}
                  </a>
                  . It is stored encrypted and never shown again.
                </p>
              )}
            </div>

            {update.isError && (
              <p role="alert" className="text-sm text-destructive">
                {update.error.message}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={!canSave || !dirty || update.isPending}>
                {update.isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!saved?.configured || dirty || test.isPending}
                onClick={() => test.mutate()}
              >
                {test.isPending ? 'Testing…' : 'Test'}
              </Button>
              {saved?.configured && dirty && <span className="text-xs text-muted-foreground">Save first, then test.</span>}
            </div>

            <div aria-live="polite" className="text-sm">
              {/* A test result describes the saved settings. Once the form is edited it no longer applies. */}
              {!dirty && test.isError && <p className="text-destructive">{test.error.message}</p>}
              {!dirty && result?.ok && <p>Works: the model answered in {result.latencyMs} ms.</p>}
              {!dirty && result && !result.ok && <p className="text-destructive">{result.error}</p>}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
