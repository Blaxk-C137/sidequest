import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/useReducedMotion';

/** Circular meter used for the playful style-expression index. */
export function ScoreRing({ value, label }: { value: number; label: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const duration = 1200;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(value * eased));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value, reduced]);

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (shown / 100) * circumference;

  return (
    <div className="relative flex h-[112px] w-[112px] shrink-0 items-center justify-center">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f5a6cf" />
            <stop offset="55%" stopColor="#ff6392" />
            <stop offset="100%" stopColor="#c86bd8" />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r={radius} fill="none" stroke="rgba(255,244,248,0.1)" strokeWidth="8" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="url(#scoreGradient)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-150 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[1.7rem] leading-none text-cream" aria-hidden="true">
          {shown}
        </span>
        <span className="mt-1 max-w-[74px] text-center text-[8px] uppercase leading-tight tracking-[0.16em] text-mist/70">
          {label}
        </span>
      </div>
      <span className="sr-only">
        Style-expression index {value} out of 100. A playful number from your own choices, not an assessment of appearance.
      </span>
    </div>
  );
}
