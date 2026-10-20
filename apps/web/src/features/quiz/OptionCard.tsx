import type { KeyboardEvent } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OptionIcon } from '@/components/OptionIcon';
import type { QuestionOption } from '@blaxaura/shared';

export function OptionCard({
  option,
  selected,
  onSelect,
  onKeyDown,
  tabIndex,
  index,
  total,
}: {
  option: QuestionOption;
  selected: boolean;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  tabIndex: number;
  index: number;
  total: number;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabIndex}
      data-index={index}
      data-total={total}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={cn(
        'group relative flex w-full items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-all duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blush',
        selected
          ? 'border-rose/80 bg-[linear-gradient(120deg,rgba(255,99,146,0.16),rgba(48,32,50,0.7))] rose-glow'
          : 'border-cream/12 bg-midnight/45 hover:border-blush/40 hover:bg-plum/40 active:scale-[0.99]',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors',
          selected ? 'border-rose/50 bg-rose/15 text-blush' : 'border-cream/12 bg-cream/[0.04] text-mist group-hover:text-blush',
        )}
        aria-hidden="true"
      >
        <OptionIcon name={option.icon} />
      </span>

      <span className="min-w-0 flex-1">
        <span className={cn('block text-[15px] font-medium leading-snug', selected ? 'text-cream' : 'text-cream/95')}>
          {option.label}
        </span>
        {option.note ? <span className="mt-0.5 block text-[12px] leading-snug text-mist/70">{option.note}</span> : null}
      </span>

      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all',
          selected ? 'border-rose bg-rose text-[#22060f]' : 'border-cream/20 text-transparent',
        )}
        aria-hidden="true"
      >
        <Check className="h-3 w-3 stroke-[3]" />
      </span>
    </button>
  );
}
