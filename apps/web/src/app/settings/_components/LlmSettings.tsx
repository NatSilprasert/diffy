'use client';

import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { getGetSettingsQueryKey, useGetSettings, useTestLlmSettings, useUpdateLlmSettings } from '@/api/generated/diffy';
import { Select } from '@/components/Select';
import { SettingsSection } from '@/components/SettingsSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PROVIDERS, defaultModel, modelOptions, providerInfo, type ProviderValue } from '@/lib/llmProviders';

export function LlmSettings() {
  const queryClient = useQueryClient();
  const settings = useGetSettings();
  const saved = settings.data?.llm;

  // What the user changed. Anything not changed shows the saved value, so the form needs no "load" step.
  const [edits, setEdits] = useState<{ provider?: ProviderValue; model?: string; apiKey?: string }>({});
  const provider = edits.provider ?? saved?.provider ?? undefined;
  // A model belongs to its provider: another provider starts on its own default model.
  const model = edits.model ?? (provider && provider === saved?.provider ? (saved?.model ?? '') : provider ? defaultModel(provider) : '');
  const apiKey = edits.apiKey ?? '';
  const dirty = provider !== (saved?.provider ?? undefined) || model !== (saved?.model ?? '') || apiKey.trim() !== '';

  // The saved key only works for the provider it was saved with.
  const keepsSavedKey = Boolean(saved?.configured) && provider === saved?.provider;
  const canSave = Boolean(provider) && model !== '' && (keepsSavedKey || apiKey.trim() !== '');

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

  const current = providerInfo(provider);
  const result = test.data;

  return (
    <SettingsSection
      title="AI model"
      description="The model that reviews your pull requests, and the API key diffy uses to reach it. The key is stored encrypted and never shown again."
      badge={saved?.configured ? <Badge className="bg-success/15 text-success">Configured</Badge> : undefined}
    >
      {settings.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {settings.isError && <p className="text-sm text-destructive">{settings.error.message}</p>}

      {settings.isSuccess && (
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!provider) return;
            update.mutate({ data: { provider, model, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) } });
          }}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="llm-provider">Provider</Label>
              <Select
                id="llm-provider"
                className="h-10 w-full"
                placeholder="Choose a provider"
                value={provider}
                // Another provider starts again from its own default model.
                onChange={(value) => setEdits((e) => ({ ...e, provider: value, model: undefined }))}
                options={PROVIDERS}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="llm-model">Model</Label>
              <Select
                id="llm-model"
                className="h-10 w-full"
                placeholder={provider ? 'Choose a model' : 'Choose a provider first'}
                value={provider ? model : undefined}
                onChange={(value) => setEdits((e) => ({ ...e, model: value }))}
                options={provider ? modelOptions(provider, model) : []}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="llm-key">API key</Label>
            <Input
              id="llm-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              className="h-10"
              placeholder={keepsSavedKey ? '•••••••• saved (leave empty to keep it)' : 'Paste your API key'}
              value={apiKey}
              onChange={(event) => setEdits((e) => ({ ...e, apiKey: event.target.value }))}
            />
            {provider && !keepsSavedKey && saved?.provider && provider !== saved.provider && (
              <p className="text-xs text-muted-foreground">
                A new key is needed because the provider changed; the saved one belongs to {providerInfo(saved.provider)?.label}.
              </p>
            )}
            {current && (
              <p className="text-xs text-muted-foreground">
                Get a key at{' '}
                <a className="underline" href={current.keyUrl} target="_blank" rel="noreferrer">
                  {new URL(current.keyUrl).host}
                </a>
                .
              </p>
            )}
          </div>

          {update.isError && (
            <p role="alert" className="text-sm text-destructive">
              {update.error.message}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t pt-5">
            <Button type="submit" className="h-10 px-5" disabled={!canSave || !dirty || update.isPending}>
              {update.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 px-5"
              disabled={!saved?.configured || dirty || test.isPending}
              onClick={() => test.mutate()}
            >
              {test.isPending ? 'Testing…' : 'Test connection'}
            </Button>
            {saved?.configured && dirty && <span className="text-xs text-muted-foreground">Save first, then test.</span>}
          </div>

          <div aria-live="polite" className="text-sm">
            {/* A test result describes the saved settings. Once the form is edited it no longer applies. */}
            {!dirty && test.isError && <p className="text-destructive">{test.error.message}</p>}
            {!dirty && result?.ok && (
              <p className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-success" aria-hidden />
                Works: the model answered in {result.latencyMs} ms.
              </p>
            )}
            {!dirty && result && !result.ok && (
              <p className="flex items-start gap-2 text-destructive">
                <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {result.error}
              </p>
            )}
          </div>
        </form>
      )}
    </SettingsSection>
  );
}
