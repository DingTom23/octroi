import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/brand';
import { SiteNav } from '@/components/ui/SiteNav';

export default function NotFound() {
  return (
    <>
      <SiteNav />
      <main className="relative flex min-h-[calc(100vh-var(--nav-h))] flex-col items-center justify-center gap-5 overflow-hidden px-10 text-center">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 60%, rgba(232,169,107,.06), transparent 60%)',
          }}
          aria-hidden
        />
        <Logo variant="mark" className="mb-2 h-16 text-accent opacity-90" aria-label="" />
        <h1 className="num-display text-[80px] leading-none text-ink-primary md:text-[112px]">
          404
        </h1>
        <p className="text-[17px] text-ink-secondary">Couldn&apos;t find that page.</p>
        <Link
          href="/"
          className="mt-2 inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong bg-bg-surface px-4 text-sm text-ink-primary transition-colors hover:bg-bg-elevated"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to home
        </Link>
      </main>
    </>
  );
}
