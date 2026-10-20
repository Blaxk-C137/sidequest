import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ArrowRight, Lock, Sparkles, Timer, Users } from 'lucide-react';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Wordmark } from '@/components/Wordmark';
import { useFlow } from '@/features/flow/FlowProvider';
import { useReducedMotion } from '@/lib/useReducedMotion';

export function Welcome() {
  const navigate = useNavigate();
  const { reset, report } = useFlow();
  const reduced = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  useEffect(() => {
    if (reduced || !stage.current) return;
    const context = gsap.context(() => {
      gsap.from('[data-rise]', {
        y: 18,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.09,
        delay: 0.05,
      });
      gsap.from('[data-halo]', { scale: 0.86, opacity: 0, duration: 1.6, ease: 'power2.out' });
    }, stage);
    return () => context.revert();
  }, [reduced]);

  const start = () => {
    if (report) reset();
    navigate('/quiz');
  };

  return (
    <Screen className="justify-between" aurora="bright">
      <div className="flex items-center justify-between">
        <Wordmark size="sm" />
        <span className="kicker">Style check</span>
      </div>

      <div ref={stage} className="flex flex-1 flex-col justify-center py-5">
        <div className="relative mx-auto mb-7 flex h-32 w-32 items-center justify-center" data-rise>
          <div
            data-halo
            className="animate-halo absolute inset-0 rounded-full bg-[conic-gradient(from_180deg,rgba(255,99,146,0.55),rgba(200,107,216,0.35),rgba(245,166,207,0.5),rgba(255,99,146,0.55))] blur-[26px]"
            aria-hidden="true"
          />
          <div className="absolute inset-3 rounded-full border border-blush/25" aria-hidden="true" />
          <div className="absolute inset-8 rounded-full border border-cream/10" aria-hidden="true" />
          <Wordmark size="md" className="relative z-10 scale-110" />
        </div>

        <h1 className="text-balance text-center font-display text-[2.6rem] leading-[1.02] tracking-tight text-cream sm:text-5xl" data-rise>
          Your Style.
          <br />
          <span className="bg-gradient-to-r from-blush via-rose to-[#c86bd8] bg-clip-text text-transparent">Your Aura.</span>
        </h1>

        <p className="mx-auto mt-4 max-w-[34ch] text-balance text-center text-[15px] leading-relaxed text-mist/90" data-rise>
          Eight playful questions about what you wear and why — then a style report to talk about. No photos, no measurements.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2" data-rise>
          {[
            { icon: Timer, label: '2 minutes' },
            { icon: Sparkles, label: '8 questions' },
            { icon: Lock, label: 'Skip anything' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl border border-cream/10 bg-cream/[0.03] px-1 py-2.5">
              <Icon className="h-4 w-4 text-blush" aria-hidden="true" strokeWidth={1.6} />
              <span className="text-[11px] tracking-wide text-mist/85">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4" data-rise>
        <Button size="lg" className="w-full" onClick={start}>
          Start the style check
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>

        <div className="rounded-2xl border border-cream/10 bg-midnight/45 p-4">
          <p className="text-[12.5px] leading-relaxed text-mist/85">
            <strong className="font-semibold text-cream">Before you start:</strong> your first name or nickname is used only
            to personalise your report. Sharing a phone number is optional and comes at the very end. The person holding
            this phone can see anything you type here.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
              <DialogTrigger asChild>
                <Button variant="quiet" size="sm" className="px-0">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  What happens to my answers?
                </Button>
              </DialogTrigger>
              <DialogContent title="Nothing here is required" description="BlaXaura is an icebreaker, not a form.">
                <ul className="space-y-3 text-[13px] leading-relaxed text-mist/90">
                  <li>
                    <span className="text-cream">Answers</span> are used to build your style report. If this device has a
                    Gemini key configured, the selected options (not your name or number) are sent to Google to help write
                    the report; otherwise a built-in report is used.
                  </li>
                  <li>
                    <span className="text-cream">Your name</span> stays on this device and is never sent to the AI.
                  </li>
                  <li>
                    <span className="text-cream">A phone number</span> is only saved if you tick the consent box, and it is
                    kept inside this app on the host&apos;s device — never in their contacts or address book.
                  </li>
                  <li>
                    <span className="text-cream">Feedback</span> is optional and stored locally, without your number.
                  </li>
                  <li>You can skip any question, decline the number, and restart at any time. Your state is cleared when you finish.</li>
                </ul>
              </DialogContent>
            </Dialog>
            <Link to="/admin" className="inline-flex items-center gap-1 text-[12px] text-mist/45 transition-colors hover:text-mist">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              Host dashboard
            </Link>
          </div>
        </div>
      </div>
    </Screen>
  );
}
