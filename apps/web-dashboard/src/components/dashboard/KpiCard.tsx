'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { TrendingDown, TrendingUp, type LucideProps } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

const easeSmooth = [0.32, 0.72, 0, 1] as const;

export interface KpiTrend {
  direction: 'up' | 'down' | 'flat';
  text: string;
}

type KpiCardProps = {
  label: string;
  value: ReactNode;
  trend?: KpiTrend;
  /** When true, the value renders in the accent color (used for headline KPIs). */
  highlight?: boolean;
  /** Render arbitrary content below the trend (e.g. the daily budget bar). */
  footer?: ReactNode;
  /** Optional reveal delay so a row of KPIs cascades in. */
  delay?: number;
};

const TREND_COLOR: Record<KpiTrend['direction'], string> = {
  up: 'text-sage',
  down: 'text-clay',
  flat: 'text-ink-tertiary',
};

const TREND_ICON: Record<KpiTrend['direction'], ComponentType<LucideProps> | null> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: null,
};

export function KpiCard({ label, value, trend, highlight, footer, delay = 0 }: KpiCardProps) {
  const reduced = useReducedMotion();
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null;

  return (
    <motion.div
      initial={{ y: reduced ? 0 : 8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay, ease: easeSmooth }}
      className="rounded-card border border-border-subtle bg-bg-surface p-5"
    >
      <div className="mb-2.5 text-[13px] text-ink-secondary">{label}</div>
      <div
        className={cn(
          'mono text-[30px] font-medium leading-none tracking-[-0.02em]',
          highlight && 'text-accent',
        )}
      >
        {value}
      </div>
      {trend && (
        <div
          className={cn(
            'mt-2.5 flex items-center gap-1.5 text-[12.5px]',
            TREND_COLOR[trend.direction],
          )}
        >
          {TrendIcon && <TrendIcon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />}
          {trend.text}
        </div>
      )}
      {footer}
    </motion.div>
  );
}
