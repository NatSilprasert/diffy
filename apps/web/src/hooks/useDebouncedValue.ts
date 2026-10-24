import { useEffect, useState } from 'react';

// Follows `value`, but only after it has stopped changing for `delayMs`. Used so that a search box asks the
// server once the user pauses typing, not on every keystroke.
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
