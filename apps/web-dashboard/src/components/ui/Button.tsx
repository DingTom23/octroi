'use client';

import * as React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

type ButtonProps = HTMLMotionProps<'button'> & {
  variant?: Variant;
  size?: Size;
};

const base =
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap ' +
  'rounded-lg border border-transparent cursor-pointer ' +
  'transition-[background-color,border-color,color,box-shadow] duration-150 ease-smooth ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-glow)] focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-[#0A0A0B] font-semibold hover:bg-accent-hover',
  secondary: 'bg-bg-surface text-ink-primary border-border-strong hover:bg-bg-elevated',
  ghost: 'text-ink-secondary hover:text-ink-primary',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-[15px]',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...rest }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.975 }}
        transition={{ duration: 0.12, ease: [0.32, 0.72, 0, 1] }}
        className={cn(base, variants[variant], sizes[size], className)}
        {...rest}
      >
        {children}
      </motion.button>
    );
  },
);
Button.displayName = 'Button';
