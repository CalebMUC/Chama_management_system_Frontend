import { cn } from '@/lib/utils';

/** The platform mark: a vault door in navy and gold. */
export function BrandMark({ dark = true, compact = false, subtitle, className }: { dark?: boolean; compact?: boolean; subtitle?: string | null; className?: string }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="7" className="fill-primary" />
        <circle cx="16" cy="16" r="9" fill="none" stroke="hsl(var(--gold))" strokeWidth="2.2" />
        <circle cx="16" cy="16" r="3" fill="hsl(var(--gold))" />
        <path d="M16 7v4M16 21v4M7 16h4M21 16h4" stroke="hsl(var(--gold))" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className={cn('block text-base font-semibold tracking-tight', dark ? 'text-sidebar-foreground' : 'text-foreground')}>
            Chama<span className="text-gold">Bank</span>
          </span>
          {subtitle && <span className={cn('block truncate text-xs', dark ? 'text-sidebar-muted' : 'text-muted-foreground')}>{subtitle}</span>}
        </span>
      )}
    </div>
  );
}
