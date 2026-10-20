import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Heart, RotateCcw, Sparkles } from 'lucide-react';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/Wordmark';
import { useFlow } from '@/features/flow/FlowProvider';

export function DoneScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { reset } = useFlow();
  const [shared] = useState<boolean>(Boolean((location.state as { shared?: boolean } | null)?.shared));

  // Wipe this participant's state as soon as the flow ends.
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restart = () => {
    reset();
    navigate('/');
  };

  return (
    <Screen className="justify-between" aurora="bright">
      <div className="flex items-center justify-between">
        <Wordmark size="sm" />
        <span className="kicker">Done</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <div className="animate-halo absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,99,146,0.5),transparent_70%)] blur-xl" />
          <Heart className="relative h-9 w-9 text-blush" aria-hidden="true" strokeWidth={1.3} />
        </div>
        <h1 className="mt-6 font-display text-[2.1rem] leading-tight text-cream">Thank you.</h1>
        <p className="mt-3 max-w-[32ch] text-[14px] leading-relaxed text-mist/85">
          {shared
            ? 'Your number is saved on this device only. Nothing was added to a contact list or sent anywhere else.'
            : 'You finished without leaving a number — and that is a perfectly complete BlaXaura experience.'}
        </p>
        <p className="mt-4 flex items-center gap-1.5 text-[12px] text-mist/55">
          <Sparkles className="h-3.5 w-3.5 text-blush/70" aria-hidden="true" />
          Your answers have been cleared from this screen.
        </p>
      </div>

      <div className="space-y-3">
        <Button size="lg" className="w-full" onClick={restart}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Start fresh for someone new
        </Button>
        <p className="text-center text-[11px] leading-relaxed text-mist/45">
          The next person sees an empty welcome screen — no previous answers, no saved name.
        </p>
      </div>
    </Screen>
  );
}
