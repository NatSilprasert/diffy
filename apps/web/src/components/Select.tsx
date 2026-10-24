'use client';

import {
  Select as SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type SelectOption<T extends string = string> = { value: T; label: string };

// The select you use in pages: <Select value onChange options /> and nothing else to assemble.
// The pieces it is made of live in components/ui/select.tsx.
export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  label,
  id,
  className,
}: {
  // undefined shows the placeholder.
  value: T | undefined;
  onChange: (value: T) => void;
  options: ReadonlyArray<SelectOption<T>>;
  placeholder?: string;
  // The accessible name, for a select that has no visible <label>.
  label?: string;
  id?: string;
  // Sizing for the trigger, for example "h-10 w-52".
  className?: string;
}) {
  return (
    <SelectRoot value={value ?? ''} onValueChange={(next) => onChange(next as T)}>
      <SelectTrigger id={id} aria-label={label} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
}
