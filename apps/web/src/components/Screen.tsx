import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Aurora } from './Aurora';
import { Wordmark } from './Wordmark';
import { cn } from '@/lib/utils';

export function Screen({
  children,
  className,
  aurora = 'normal',
}: {
  children: ReactNode;
  className?: string;
  aurora?: 'soft' | 'normal' | 'bright';
}) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <Aurora intensity={aurora} />
      <div className={cn('mx-auto flex w-full max-w-[520px] flex-1 flex-col px-5 pb-8 pt-5 sm:px-7', className)}>
        {children}
      </div>
    </div>
  );
}

export function ScreenHeader({
  backTo,
  backLabel = 'Back',
  onBack,
  step,
}: {
  backTo?: string;
  backLabel?: string;
  onBack?: () => void;
  step?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3 pb-6">
      <div className="flex items-center gap-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-full py-2 pr-3 text-[13px] text-mist transition-colors hover:text-cream"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </button>
        ) : backTo ? (
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 rounded-full py-2 pr-3 text-[13px] text-mist transition-colors hover:text-cream"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </Link>
        ) : (
          <Wordmark size="sm" />
        )}
      </div>
      {step}
    </header>
  );
}
