'use client';

import { Input, Label } from '@/components/ui/primitives';
import { todayNairobi } from '@/lib/format';

export interface DateRangeValue {
  from?: string;
  to?: string;
}

/** From/to business dates (plain "YYYY-MM-DD", never shifted). Empty means open-ended. */
export function DateRangeFilter({ value, onChange, maxToday = true }: { value: DateRangeValue; onChange(v: DateRangeValue): void; maxToday?: boolean }) {
  const max = maxToday ? todayNairobi() : undefined;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label className="sr-only" htmlFor="range-from">From</Label>
      <Input id="range-from" type="date" className="w-40" value={value.from ?? ''} max={value.to || max} onChange={(e) => onChange({ ...value, from: e.target.value || undefined })} aria-label="From" />
      <span className="text-sm text-muted-foreground">to</span>
      <Input id="range-to" type="date" className="w-40" value={value.to ?? ''} min={value.from} max={max} onChange={(e) => onChange({ ...value, to: e.target.value || undefined })} aria-label="To" />
    </div>
  );
}
