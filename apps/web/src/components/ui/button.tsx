import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-blush active:scale-[0.985] select-none',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-rose to-[#ff86ad] text-[#22060f] font-semibold shadow-[0_18px_40px_-18px_rgba(255,99,146,0.9)] hover:shadow-[0_20px_46px_-14px_rgba(255,99,146,1)] hover:brightness-[1.06]',
        secondary: 'bg-plum/80 text-cream border border-blush/25 hover:border-blush/45 hover:bg-plum-light',
        outline: 'border border-cream/25 text-cream hover:border-blush/60 hover:text-blush bg-transparent',
        ghost: 'text-mist hover:text-cream hover:bg-cream/5',
        quiet: 'text-mist/80 hover:text-cream underline-offset-4 hover:underline px-1',
        danger: 'bg-[#42222f] text-[#ffd9e4] border border-rose/40 hover:bg-[#55293a]',
      },
      size: {
        sm: 'h-9 px-4 text-[13px]',
        md: 'h-12 px-6 text-[15px]',
        lg: 'h-14 px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Component = asChild ? Slot : 'button';
    return (
      <Component
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...(asChild ? {} : { type: type ?? 'button' })}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
