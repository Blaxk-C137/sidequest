import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import {
  ArrowRight,
  Compass,
  Lightbulb,
  MessageCircle,
  RefreshCw,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { generateFallbackReport } from '@blaxaura/shared';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { ScoreRing } from '@/components/ScoreRing';
import { useFlow } from '@/features/flow/FlowProvider';
import { api, ApiError } from '@/lib/api';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { cn } from '@/lib/utils';

const LOADING_LINES = [
  'Reading the choices you made…',
  'Looking for the thread between your answers…',
  'Writing your style report…',
];

export function Reveal() {
  const navigate = useNavigate();
  const { answers, name, report, sessionId, setReport } = useFlow();
  const reduced = useReducedMotion();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(report ? 'ready' : 'loading');
  const [error, setError] = useState<string | null>(null);
  const [line, setLine] = useState(0);
  const [nonce, setNonce] = useState(0);
  const stage = useRef<HTMLDivElement>(null);

  const load = async () => {
    setStatus('loading');
    setError(null);
    const minimumDelay = reduced ? 0 : 1500;
    const started = Date.now();
    try {
      const result = await api.createReport(answers, sessionId);
      const elapsed = Date.now() - started;
      if (elapsed < minimumDelay) await new Promise((resolve) => setTimeout(resolve, minimumDelay - elapsed));
      setReport(result.report, result.sessionId);
      setStatus('ready');
    } catch (caught) {
      const elapsed = Date.now() - started;
      if (elapsed < 500) await new Promise((resolve) => setTimeout(resolve, 500 - elapsed));
      setError(
        caught instanceof ApiError && caught.status === 0
          ? 'The style writer is not reachable right now. You can still see a complete report built on this device.'
          : 'Your report could not be written just now.',
      );
      setStatus('error');
    }
  };

  useEffect(() => {
    if (report) {
      setStatus('ready');
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  useEffect(() => {
    if (status !== 'loading' || reduced) return;
    const timer = window.setInterval(() => setLine((current) => (current + 1) % LOADING_LINES.length), 1100);
    return () => window.clearInterval(timer);
  }, [status, reduced]);

  useEffect(() => {
    if (status !== 'ready' || reduced || !stage.current) return;
    const context = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: 'power2.out' } });
      timeline
        .from('[data-hero]', { opacity: 0, y: 24, duration: 0.7, stagger: 0.08 })
        .from('[data-card]', { opacity: 0, y: 20, duration: 0.55, stagger: 0.08 }, '-=0.25')
        .from('[data-bar-fill]', { scaleX: 0, transformOrigin: 'left center', duration: 0.7, stagger: 0.1 }, '-=0.4');
    }, stage);
    return () => context.revert();
  }, [status, reduced]);

  const useLocalReport = () => {
    const local = generateFallbackReport(answers);
    setReport(local, sessionId ?? '');
    setStatus('ready');
  };

  if (status === 'loading') {
    return (
      <Screen aurora="bright" className="items-center justify-center text-center">
        <div className="relative flex h-44 w-44 items-center justify-center">
          <div className="animate-halo absolute inset-0 rounded-full bg-[conic-gradient(from_90deg,rgba(255,99,146,0.5),rgba(200,107,216,0.3),rgba(245,166,207,0.5))] blur-2xl" />
          <div className="absolute inset-2 rounded-full border border-blush/25" />
          <div className="absolute inset-7 rounded-full border border-cream/10" />
          <Sparkles className="relative h-9 w-9 text-blush" aria-hidden="true" strokeWidth={1.2} />
        </div>
        <h1 className="mt-9 font-display text-2xl text-cream">Composing your aura</h1>
        <p className="mt-2 h-6 text-[13.5px] text-mist/80" aria-live="polite">
          {LOADING_LINES[line]}
        </p>
        <div className="mt-8 w-full max-w-[240px]">
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-cream/10">
            <div
              className="h-full w-1/3 rounded-full bg-gradient-to-r from-blush to-rose"
              style={{ animation: 'shimmer 1.6s ease-in-out infinite' }}
            />
          </div>
        </div>
      </Screen>
    );
  }

  if (status === 'error' || !report) {
    return (
      <Screen aurora="soft" className="justify-center">
        <div className="rounded-2xl border border-cream/12 bg-midnight/60 p-6 text-center">
          <WifiOff className="mx-auto h-8 w-8 text-blush" aria-hidden="true" strokeWidth={1.4} />
          <h1 className="mt-4 font-display text-2xl text-cream">The writer is offline</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-mist/85">{error}</p>
          <div className="mt-6 space-y-2.5">
            <Button className="w-full" onClick={() => setNonce((current) => current + 1)}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
            <Button variant="secondary" className="w-full" onClick={useLocalReport}>
              Show my report without the writer
            </Button>
            <Button variant="quiet" className="w-full" onClick={() => navigate('/quiz')}>
              Back to the questions
            </Button>
          </div>
        </div>
      </Screen>
    );
  }

  const greeting = name.trim() ? `${name.trim()}, you are` : 'You are';

  return (
    <Screen aurora="normal">
      <div ref={stage} className="flex flex-1 flex-col pb-2">
        <div className="pt-2 text-center" data-hero>
          <p className="kicker">Style report{name.trim() ? ` · ${name.trim()}` : ''}</p>
          <p className="mt-3 text-[13px] text-mist/70">{greeting}</p>
          <h1 className="mt-1 bg-gradient-to-br from-cream via-cream to-blush bg-clip-text font-display text-[2.35rem] leading-[1.05] text-transparent">
            {report.archetype}
          </h1>
          <div className="mx-auto mt-4 h-px w-24 hairline" />
        </div>

        <p className="mt-5 text-[14px] leading-relaxed text-cream/90" data-card>
          {report.summary}
        </p>

        <div
          className="mt-5 flex items-center gap-4 rounded-2xl border border-cream/10 bg-midnight/40 p-4"
          data-card
        >
          <ScoreRing value={report.expressionScore} label="Style-expression index" />
          <div className="min-w-0 flex-1 space-y-3">
            {report.dimensions.map((dimension) => (
              <div key={dimension.key}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="truncate text-[11.5px] font-medium text-cream/90">{dimension.label}</span>
                  <span className="text-[10.5px] tabular-nums text-mist/55">{dimension.score}</span>
                </div>
                <div className="h-[5px] w-full overflow-hidden rounded-full bg-cream/10">
                  <div
                    data-bar-fill
                    className={cn(
                      'h-full rounded-full',
                      dimension.key === 'creative'
                        ? 'bg-gradient-to-r from-blush to-rose'
                        : dimension.key === 'intention'
                          ? 'bg-gradient-to-r from-rose to-[#c86bd8]'
                          : 'bg-gradient-to-r from-[#c86bd8] to-[#8a6be0]',
                    )}
                    style={{ width: `${dimension.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <ul className="mt-3 space-y-1 px-1" aria-label="How to read the index">
          {report.dimensions.map((dimension) => (
            <li key={`${dimension.key}-note`} className="text-[11px] leading-snug text-mist/55">
              <span className="text-mist/80">{dimension.label}:</span> {dimension.note}
            </li>
          ))}
        </ul>

        <section className="mt-7" data-card aria-labelledby="strengths-heading">
          <h2 id="strengths-heading" className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-mist/70">
            <Sparkles className="h-3.5 w-3.5 text-blush" aria-hidden="true" />
            What is working
          </h2>
          <ul className="mt-3 space-y-2.5">
            {report.strengths.map((strength) => (
              <li key={strength} className="rounded-xl border border-cream/10 bg-cream/[0.03] px-3.5 py-3 text-[13px] leading-relaxed text-cream/90">
                {strength}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6" data-card aria-labelledby="experiments-heading">
          <h2 id="experiments-heading" className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-mist/70">
            <Compass className="h-3.5 w-3.5 text-blush" aria-hidden="true" />
            Two things to try
          </h2>
          <div className="mt-3 space-y-2.5">
            {report.experiments.map((experiment, index) => (
              <div key={experiment.title} className="rounded-xl border border-blush/15 bg-[linear-gradient(140deg,rgba(48,32,50,0.55),rgba(23,17,34,0.6))] p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-blush/30 text-[11px] text-blush">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-display text-[17px] leading-snug text-cream">{experiment.title}</h3>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-mist/85">{experiment.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-blush/25 bg-blush/[0.06] p-4" data-card>
          <h2 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-blush/90">
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Ask each other
          </h2>
          <p className="mt-2 font-display text-[18px] leading-snug text-cream">{report.conversationStarter}</p>
        </section>

        <p className="mt-5 flex items-start gap-1.5 text-[11px] leading-relaxed text-mist/50" data-card>
          <Lightbulb className="mt-[2px] h-3 w-3 shrink-0" aria-hidden="true" />
          {report.disclaimer}
          {report.mode === 'fallback' ? ' This report was written on this device without the AI writer.' : ''}
        </p>

        <div className="mt-6 space-y-2.5" data-card>
          <Button size="lg" className="w-full" onClick={() => navigate('/feedback')}>
            Rate the experience
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button variant="quiet" className="w-full" onClick={() => navigate('/connect')}>
            Skip to sharing details
          </Button>
        </div>
      </div>
    </Screen>
  );
}
