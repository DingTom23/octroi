import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'accent' | 'steel' | 'success' | 'mono';

type ChipProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
  dot?: 'accent' | 'steel' | 'success' | 'warning' | 'error' | 'live';
};

const base =
  'inline-flex items-center gap-2 h-6 px-2.5 rounded-chip text-xs font-medium whitespace-nowrap';

const variants: Record<Variant, string> = {
  default: 'bg-bg-elevated text-ink-secondary border border-border-subtle',
  accent: 'bg-[color:var(--accent-subtle)] text-accent',
  steel: 'bg-[color:var(--secondary-subtle)] text-[color:var(--secondary)]',
  success: 'bg-[color:rgba(142,182,138,0.12)] text-[color:var(--success)]',
  mono: 'font-mono bg-bg-elevated text-ink-secondary border border-border-subtle tracking-[0.01em]',
};

const dots: Record<NonNullable<ChipProps['dot']>, string> = {
  accent: 'bg-accent',
  steel: 'bg-[color:var(--secondary)]',
  success: 'bg-[color:var(--success)]',
  warning: 'bg-[color:var(--warning)]',
  error: 'bg-[color:var(--error)]',
  live: 'bg-accent',
};

export function Chip({ variant = 'default', dot, className, children, ...rest }: ChipProps) {
  return (
    <span className={cn(base, variants[variant], className)} {...rest}>
      {dot === 'live' ? (
        <span className="relative inline-block h-2 w-2 rounded-full bg-accent">
          <span
            className="absolute inset-0 rounded-full bg-accent"
            style={{ animation: 'live-pulse 1.8s cubic-bezier(.32,.72,0,1) infinite' }}
          />
        </span>
      ) : dot ? (
        <span className={cn('inline-block h-[7px] w-[7px] rounded-full', dots[dot])} />
      ) : null}
      {children}
    </span>
  );
}
