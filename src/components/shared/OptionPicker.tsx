'use client';

import { forwardRef, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/primitives';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlays';
import { cn } from '@/lib/utils';

export interface PickerOption {
  id: string;
  label: string;
  /** A muted second line (phone, status). */
  sub?: string;
  /** Extra text the search matches but doesn't show (email, member number). */
  keywords?: string;
}

export interface OptionPickerProps {
  value: string | null | undefined;
  onChange(id: string | null): void;
  options: PickerOption[];
  /** The selected option's label when it isn't among `options` (e.g. filtered out). */
  selectedLabel?: string;
  loading?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  searchLabel?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/** A searchable single-choice picker in a popover, filtered on the client. */
export const OptionPicker = forwardRef<HTMLButtonElement, OptionPickerProps>(function OptionPicker(
  { value, onChange, options, selectedLabel, loading, placeholder = 'Choose', searchPlaceholder = 'Search…', searchLabel = 'Search', emptyText = 'Nothing matches.', disabled, className, ...aria },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? options.filter((o) => [o.label, o.sub, o.keywords].join(' ').toLowerCase().includes(q)) : options;
  }, [options, search]);
  const selected = value ? options.find((o) => o.id === value)?.label ?? selectedLabel : undefined;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(''); }}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          ref={ref}
          type="button"
          {...aria}
          className={cn(
            'flex h-control w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-2.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 aria-[invalid=true]:border-destructive',
            className,
          )}
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>{selected ?? (loading ? 'Loading…' : placeholder)}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0">
        <div className="relative border-b p-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder={searchPlaceholder} className="pl-8" aria-label={searchLabel} />
        </div>
        <ul role="listbox" className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 && <li className="px-2 py-3 text-center text-sm text-muted-foreground">{loading ? 'Loading…' : emptyText}</li>}
          {filtered.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={o.id === value}
                onClick={() => { onChange(o.id); setOpen(false); setSearch(''); }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
              >
                <Check className={cn('size-4 shrink-0', o.id === value ? 'opacity-100' : 'opacity-0')} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{o.label}</span>
                  {o.sub && <span className="block truncate text-xs text-muted-foreground">{o.sub}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
});
