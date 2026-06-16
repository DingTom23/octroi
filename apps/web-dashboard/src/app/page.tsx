import { SiteNav } from '@/components/ui/SiteNav';
import { SiteFooter } from '@/components/ui/SiteFooter';
import { Hero } from '@/components/landing/Hero';
import { ProblemFix } from '@/components/landing/ProblemFix';
import { ForPublishers } from '@/components/landing/ForPublishers';
import { ForCrawlers } from '@/components/landing/ForCrawlers';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Pricing } from '@/components/landing/Pricing';
import { DemoStrip } from '@/components/landing/DemoStrip';

/**
 * Landing — feature-complete after Phase 2.
 *
 * Reading order: hero (with animated walkthrough centerpiece) → problem/fix
 * narrative → for-publishers (code + 5 benefits) → for-crawlers (code + 5
 * benefits) → how-it-works interactive flow → pricing → demo CTA → footer.
 */
export default function LandingPage() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <ProblemFix />
        <ForPublishers />
        <ForCrawlers />
        <HowItWorks />
        <Pricing />
        <DemoStrip />
      </main>
      <SiteFooter />
    </>
  );
}
