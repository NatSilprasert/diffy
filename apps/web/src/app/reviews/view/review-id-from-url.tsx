'use client';

import { useSearchParams } from 'next/navigation';

// Reads ?id= in the browser. Proves the query string works in a static export; F6 replaces it with the real data.
export function ReviewIdFromUrl() {
  const id = useSearchParams().get('id');
  return (
    <p className="mb-4 text-sm text-muted-foreground">
      Review id: <code className="rounded bg-muted px-1.5 py-0.5">{id ?? 'none given'}</code>
    </p>
  );
}
