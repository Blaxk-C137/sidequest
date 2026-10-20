import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-12 w-full rounded-xl border border-cream/15 bg-midnight/60 px-4 text-[15px] text-cream placeholder:text-mist/45 transition-colors',
        'focus:border-blush/70 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blush',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[96px] w-full resize-none rounded-xl border border-cream/15 bg-midnight/60 px-4 py-3 text-[15px] leading-relaxed text-cream placeholder:text-mist/45 transition-colors',
        'focus:border-blush/70 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blush',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
