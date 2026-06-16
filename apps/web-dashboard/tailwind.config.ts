import type { Config } from 'tailwindcss';

/**
 * CrawlPay design system → Tailwind.
 *
 * Color values reference CSS variables defined in src/styles/globals.css.
 * That keeps a single source of truth for colors/fonts that Framer Motion,
 * Tremor, and inline styles can all consume.
 *
 * Tremor note: charts default to Tailwind palette names (amber, blue, …)
 * so we override `amber` here with our brand accent. Passing
 * colors={['amber']} on a Tremor chart produces our brand color.
 */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}', './node_modules/@tremor/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Brand tokens (via CSS variables) ──────────────────────────
        bg: {
          base: 'var(--bg-base)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
        },
        ink: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          disabled: 'var(--text-disabled)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
        },
        steel: 'var(--secondary)',
        sage: 'var(--success)',
        clay: 'var(--error)',

        // ── Override Tailwind's amber palette with brand colors ──────
        // Lets Tremor's color="amber" produce our brand accent. The full
        // 50-900 ramp is computed around #E8A96B (the 500 value).
        amber: {
          50: '#FCF4E6',
          100: '#F8E4C0',
          200: '#F2CD92',
          300: '#EDB672',
          400: '#EAAE6E',
          500: '#E8A96B', // brand accent
          600: '#D08F4F',
          700: '#A8723C',
          800: '#80572C',
          900: '#5C3E1F',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-fjalla)', 'system-ui', 'sans-serif'],
        slab: ['var(--font-alfa-slab)', 'Georgia', 'serif'],
        condensed: ['var(--font-smooch)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      maxWidth: { content: '1280px' },
      borderRadius: {
        chip: '6px',
        card: '12px',
        modal: '16px',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(.32,.72,0,1)',
      },
      keyframes: {
        'live-pulse': {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '70%, 100%': { transform: 'scale(2.6)', opacity: '0' },
        },
        'fresh-row': {
          from: { backgroundColor: 'var(--accent-subtle)' },
          to: { backgroundColor: 'transparent' },
        },
      },
      animation: {
        'live-pulse': 'live-pulse 1.8s cubic-bezier(.32,.72,0,1) infinite',
        'fresh-row': 'fresh-row 800ms cubic-bezier(.32,.72,0,1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
