import type { Metadata } from 'next';
import { Inter, Fjalla_One, Alfa_Slab_One, Smooch_Sans, JetBrains_Mono } from 'next/font/google';
import '../styles/globals.css';
import { Providers } from '@/components/providers/Providers';

// Typography roles:
//   Inter           — body text, UI controls, navigation, descriptions
//   Fjalla One      — editorial headlines (H1/H2/H3) — condensed display
//   Alfa Slab One   — hero numbers + one-off display moments (404, math)
//   Smooch Sans     — eyebrows + UI micro-labels (variable, condensed sans)
//   JetBrains Mono  — code, addresses, amounts, technical detail
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});
const fjalla = Fjalla_One({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-fjalla',
});
const alfaSlab = Alfa_Slab_One({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-alfa-slab',
});
const smooch = Smooch_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-smooch',
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  // Resolves OG / Twitter image URLs to absolute. Override per-environment
  // via NEXT_PUBLIC_SITE_URL when you deploy (e.g. https://crawlpay.xyz).
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'CrawlPay — Pay-per-crawl infrastructure for the open web',
  description:
    'Open-source pay-per-crawl infrastructure. Publishers charge AI crawlers per URL. Crawlers pay $0.0001 per fetch, gas-free, with a cryptographic receipt.',
  icons: { icon: '/brand/favicon.svg' },
  openGraph: {
    title: 'CrawlPay',
    description: 'Pay-per-crawl infrastructure for the open web.',
    images: ['/brand/og-default.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CrawlPay',
    description: 'Pay-per-crawl infrastructure for the open web.',
    images: ['/brand/og-default.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${fjalla.variable} ${alfaSlab.variable} ${smooch.variable} ${jetbrains.variable}`}
    >
      <body className="bg-bg-base text-ink-primary antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
