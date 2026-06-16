'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '@/components/ui/ButtonLink';

const easeSmooth = [0.32, 0.72, 0, 1] as const;

export function DemoStrip() {
  const reduced = useReducedMotion();
  return (
    <section className="border-y border-border-subtle bg-bg-elevated py-20 text-center">
      <motion.div
        className="wrap"
        initial={{ y: reduced ? 0 : 16, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5, ease: easeSmooth }}
      >
        <h2 className="h2 mb-6">See it actually work.</h2>
        <ButtonLink href="/demo" size="lg">
          Watch the live demo
          <ArrowRight className="h-4 w-4" aria-hidden />
        </ButtonLink>
        <p className="mono mt-5 text-sm text-ink-secondary">
          Real testnet payments. Real Stellar transactions. Real receipts.
        </p>
      </motion.div>
    </section>
  );
}
