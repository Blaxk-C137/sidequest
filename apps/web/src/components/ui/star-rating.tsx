import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const LABELS = ['', 'Not for me', 'It was okay', 'Good', 'Really good', 'Loved it'];

export function StarRating({
  value,
  onChange,
  name = 'experience-rating',
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  name?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  return (
    <div className="flex flex-col items-center gap-2">
      <div role="radiogroup" aria-label="How was your BlaXaura experience?" className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const active = star <= shown;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={`${star} ${star === 1 ? 'star' : 'stars'} — ${LABELS[star]}`}
              name={name}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(star)}
              onBlur={() => setHover(null)}
              onClick={() => onChange(value === star ? null : star)}
              className="rounded-full p-1.5 transition-transform hover:scale-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blush"
            >
              <Star
                className={cn(
                  'h-8 w-8 transition-colors duration-150',
                  active ? 'fill-rose text-rose drop-shadow-[0_0_10px_rgba(255,99,146,0.55)]' : 'fill-transparent text-cream/30',
                )}
                aria-hidden="true"
                strokeWidth={1.5}
              />
            </button>
          );
        })}
      </div>
      <p className="h-5 text-[13px] text-blush" aria-live="polite">
        {shown > 0 ? LABELS[shown] : 'Tap a star — or skip'}
      </p>
    </div>
  );
}
