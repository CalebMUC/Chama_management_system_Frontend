import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Trimmed text, or undefined when empty: optional request fields are left out rather than sent blank. */
export function opt(value: string | null | undefined): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

export function sum<T>(items: readonly T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + (pick(item) || 0), 0);
}
