'use client';

import { motion } from 'framer-motion';

type DemoStatsProps = {
  done: number;
  totalUnits: number;
  /** Already-formatted "1.4s" or "—". */
  avg: string;
  pubs: number;
};

const TOTAL_STEPS = 60;
const TOTAL_PUBS = 5;

export function DemoStats({ done, totalUnits, avg, pubs }: DemoStatsProps) {
  const items = [
    { v: `${done} / ${TOTAL_STEPS}`, l: 'Paid crawls so far' },
    { v: `$${(totalUnits * 0.0001).toFixed(4)}`, l: 'Total settled USDC' },
    { v: avg, l: 'Avg per fetch' },
    { v: `${pubs} / ${TOTAL_PUBS}`, l: 'Publishers responding' },
  ];
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map((s, i) => (
        <motion.div
          key={s.l}
          className="rounded-card border border-border-subtle bg-bg-surface p-5 text-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.35 }}
        >
          <div className="mono text-[28px] font-medium tracking-tight text-accent">{s.v}</div>
          <div className="mt-2 text-[12.5px] text-ink-secondary">{s.l}</div>
        </motion.div>
      ))}
    </div>
  );
}
