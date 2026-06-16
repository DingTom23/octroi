'use client';

import { motion, useReducedMotion } from 'framer-motion';

const easeSmooth = [0.32, 0.72, 0, 1] as const;

const PROBLEM = [
  {
    n: '01',
    text: 'A human reads a few pages a day. An',
    strong: 'AI crawler reads hundreds of thousands.',
  },
  {
    n: '02',
    text: 'At that scale, flat subscriptions either',
    strong: 'overcharge small users or undercharge heavy ones.',
  },
  {
    n: '03',
    text: 'Blocking crawlers leaves money on the table for publishers and kills access for crawlers that',
    strong: 'would happily pay.',
  },
];

const FIX = [
  { text: 'Per-request pricing as small as', strong: '$0.0001.', mono: true },
  { text: '', strong: 'Gas-free,', tail: ' settled continuously in the background.' },
  { text: 'Every paid fetch produces a', strong: 'portable cryptographic receipt.' },
  {
    text: 'Drop it in with',
    strong: 'three lines of middleware',
    tail: ' or self-host the whole stack.',
  },
];

export function ProblemFix() {
  const reduced = useReducedMotion();
  const reveal = (delay = 0) => ({
    initial: { y: reduced ? 0 : 16, opacity: 0 },
    whileInView: { y: 0, opacity: 1 },
    viewport: { once: true, margin: '-80px' },
    transition: { duration: 0.5, delay, ease: easeSmooth },
  });

  return (
    <section className="section">
      <div className="wrap">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-12">
          <motion.div {...reveal(0)}>
            <span className="eyebrow">The problem</span>
            <div className="flex flex-col gap-5">
              {PROBLEM.map((p) => (
                <div key={p.n} className="flex gap-4">
                  <span className="mono w-6 flex-none pt-0.5 text-[13px] text-ink-tertiary">
                    {p.n}
                  </span>
                  <p className="text-ink-secondary leading-[1.55]">
                    {p.text} <span className="font-medium text-ink-primary">{p.strong}</span>
                  </p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div {...reveal(0.12)}>
            <span className="eyebrow">
              <span className="relative inline-block">
                The fix
                <span className="absolute -bottom-1.5 left-0 right-0 h-[3px] rounded-sm bg-accent" />
              </span>
            </span>
            <div className="mt-1 flex flex-col gap-5">
              {FIX.map((f, i) => (
                <div key={i} className="flex gap-4">
                  <span className="mono w-6 flex-none pt-0.5 text-[13px] text-ink-tertiary">→</span>
                  <p className="text-ink-secondary leading-[1.55]">
                    {f.text && <>{f.text} </>}
                    <span
                      className={
                        'font-medium text-ink-primary' + (f.mono ? ' mono text-accent' : '')
                      }
                    >
                      {f.strong}
                    </span>
                    {f.tail}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
