import { cn } from '@/lib/utils';

/** Simple, dependency-free progress bar with correct semantics. */
export function Progress({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-1 w-full overflow-hidden rounded-full bg-cream/12', className)}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-blush via-rose to-rose transition-[width] duration-500 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
