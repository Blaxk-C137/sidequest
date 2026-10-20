import { cn } from '@/lib/utils';

export function Wordmark({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-[3.35rem] leading-[0.95] sm:text-[4rem]',
  } as const;
  return (
    <span className={cn('inline-flex items-baseline gap-[0.14em] font-display tracking-tight', sizes[size], className)}>
      <span className="bg-gradient-to-br from-cream via-cream to-blush bg-clip-text text-transparent">BlaX</span>
      <span className="relative bg-gradient-to-br from-blush via-rose to-[#c86bd8] bg-clip-text text-transparent">
        aura
        <span
          aria-hidden="true"
          className="absolute -right-[0.06em] top-[0.12em] h-[0.14em] w-[0.14em] rounded-full bg-rose shadow-[0_0_12px_4px_rgba(255,99,146,0.55)]"
        />
      </span>
    </span>
  );
}
