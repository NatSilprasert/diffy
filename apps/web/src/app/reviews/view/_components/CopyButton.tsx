'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function CopyButton({ text, label, variant = 'outline' }: { text: string; label: string; variant?: 'outline' | 'ghost' }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  // Go back to the normal label after a moment. Cleaned up if the page closes first.
  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), 2_000);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      // Blocked by the browser (for instance on a page served over plain http from another machine).
      setState('failed');
    }
  }

  return (
    <Button type="button" size="sm" variant={variant} onClick={copy} aria-live="polite">
      {state === 'copied' ? <Check aria-hidden /> : <Copy aria-hidden />}
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Could not copy: select the text instead' : label}
    </Button>
  );
}
