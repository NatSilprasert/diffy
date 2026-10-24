import { useEffect, useState } from 'react';

// The value, but only after it has stopped changing for `delayMs`. For search boxes: one request per pause, not per key.
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
