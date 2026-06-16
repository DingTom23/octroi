'use client';

import { motion } from 'framer-motion';
import { Check, Receipt as ReceiptIcon } from 'lucide-react';

export interface DemoReceipt {
  pubId: string;
  dom: string;
  units: number;
  tx: string;
  wallet: string;
  ts: number;
}

type DemoReceiptGridProps = {
  receipts: DemoReceipt[];
  onSelect: (r: DemoReceipt) => void;
};

export function DemoReceiptGrid({ receipts, onSelect }: DemoReceiptGridProps) {
  if (receipts.length === 0) {
    return (
      <div className="rounded-card border border-border-subtle bg-bg-surface p-12 text-center">
        <ReceiptIcon
          className="mx-auto mb-3 h-10 w-10 text-ink-tertiary"
          strokeWidth={1.5}
          aria-hidden
        />
        <p className="text-sm text-ink-secondary">
          Receipts appear here as the demo settles each fetch.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
      {receipts.map((r, i) => (
        <motion.button
          key={`${r.tx}-${r.ts}`}
          type="button"
          onClick={() => onSelect(r)}
          className="cursor-pointer rounded-card border border-border-subtle bg-bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:border-border-strong"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[13.5px] font-medium">{r.dom}</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-accent">
              <Check className="h-3 w-3" strokeWidth={2} aria-hidden />
              Verified
            </span>
          </div>
          <div className="mono flex justify-between gap-2 text-[12px] text-ink-tertiary">
            <span>{r.wallet}</span>
            <span className="text-accent">${(r.units * 0.0001).toFixed(4)}</span>
          </div>
          <div className="mono mt-1.5 flex justify-between gap-2 text-[12px] text-ink-tertiary">
            <span>tx {r.tx}</span>
            <span>{i === 0 ? 'just now' : `${i}s ago`}</span>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
