const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

// "1.2M", "3.8K" or "42": a token count that fits in a card. The exact number belongs in a tooltip.
export function formatTokens(count: number): string {
  return compact.format(count);
}
