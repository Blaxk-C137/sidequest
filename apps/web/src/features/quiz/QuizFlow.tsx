import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ArrowRight, MessageCircle, Sparkles } from 'lucide-react';
import { QUESTIONS } from '@blaxaura/shared';
import { Screen, ScreenHeader } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useFlow } from '@/features/flow/FlowProvider';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { cn } from '@/lib/utils';
import { OptionCard } from './OptionCard';

const TOTAL_STEPS = QUESTIONS.length + 1; // name + questions

export function QuizFlow() {
  const navigate = useNavigate();
  const { name, setName, answers, setAnswer, ensureSession } = useFlow();
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0); // 0 = name, 1..8 = questions
  const [pendingName, setPendingName] = useState(name);
  const [lastCard, setLastCard] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const advanceTimer = useRef<number | null>(null);

  const question = step > 0 ? QUESTIONS[step - 1] : null;
  const answeredCount = useMemo(
    () => QUESTIONS.filter((q) => answers[q.id] && answers[q.id] !== 'skipped').length,
    [answers],
  );

  useEffect(() => {
    void ensureSession();
  }, [ensureSession]);

  useEffect(() => {
    if (reduced || !stageRef.current) return;
    const context = gsap.context(() => {
      gsap.fromTo(
        '[data-stage-item]',
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.42, ease: 'power2.out', stagger: 0.045, overwrite: 'auto' },
      );
    }, stageRef);
    return () => context.revert();
  }, [step, reduced]);

  useEffect(() => () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
  }, []);

  const goNext = () => {
    if (step === 0) {
      setName(pendingName.trim());
      setStep(1);
      return;
    }
    if (step >= QUESTIONS.length) {
      navigate('/reveal');
      return;
    }
    setStep(step + 1);
  };

  const commitAnswer = (questionId: string, optionId: string) => {
    setAnswer(questionId, optionId);
    const card = QUESTIONS.find((q) => q.id === questionId)?.conversationCard ?? null;
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => {
      setLastCard(card);
      if (step >= QUESTIONS.length) {
        navigate('/reveal');
      } else {
        setStep((current) => current + 1);
      }
    }, reduced ? 0 : 320);
  };

  const skipQuestion = () => {
    if (!question) return;
    setAnswer(question.id, 'skipped');
    setLastCard(null);
    if (step >= QUESTIONS.length) navigate('/reveal');
    else setStep((current) => current + 1);
  };

  const goBack = () => {
    setLastCard(null);
    if (step === 0) navigate('/');
    else setStep((current) => current - 1);
  };

  /**
   * Arrow-key support inside the radio group. Navigation is resolved from the
   * DOM rather than React refs so it keeps working across re-renders.
   */
  const onOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const group = event.currentTarget.closest('[role="radiogroup"]');
    if (!group) return;
    const options = Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    const current = options.indexOf(event.currentTarget);
    if (current === -1 || options.length === 0) return;
    event.preventDefault();
    let next = current;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (current + 1) % options.length;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (current - 1 + options.length) % options.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = options.length - 1;
    options[next]?.focus();
  };

  const progress = (step / TOTAL_STEPS) * 100;
  const currentAnswer = question ? answers[question.id] : undefined;

  return (
    <Screen>
      <ScreenHeader onBack={goBack} backLabel={step === 0 ? 'Home' : 'Back'} />

      <div className="mb-6 space-y-2">
        <div className="flex items-center justify-between text-[11px] tracking-[0.16em] text-mist/70 uppercase">
          <span>{step === 0 ? 'First, hello' : `Question ${step} of ${QUESTIONS.length}`}</span>
          <span aria-live="polite">{step === 0 ? 'Optional' : `${answeredCount} answered`}</span>
        </div>
        <Progress value={progress} label="Style check progress" />
      </div>

      <div ref={stageRef} className="flex flex-1 flex-col">
        {step === 0 ? (
          <div className="flex flex-1 flex-col justify-center">
            <p className="kicker" data-stage-item>
              Step one
            </p>
            <h1 className="mt-3 font-display text-[2rem] leading-tight text-cream" data-stage-item>
              What should we call you?
            </h1>
            <p className="mt-2 max-w-[32ch] text-[14px] leading-relaxed text-mist/80" data-stage-item>
              A first name or nickname is plenty — it only appears on your report on this device.
            </p>

            <form
              className="mt-7 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                goNext();
              }}
              data-stage-item
            >
              <label htmlFor="participant-name" className="sr-only">
                Your first name or nickname
              </label>
              <Input
                id="participant-name"
                value={pendingName}
                onChange={(event) => setPendingName(event.target.value)}
                placeholder="e.g. Ada"
                autoComplete="off"
                autoCapitalize="words"
                maxLength={40}
                enterKeyHint="next"
              />
              <Button type="submit" size="lg" className="w-full">
                Continue
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="quiet"
                className="mx-auto block"
                onClick={() => {
                  setPendingName('');
                  setName('');
                  setStep(1);
                }}
              >
                Keep me anonymous
              </Button>
            </form>
          </div>
        ) : null}

        {question ? (
          <div className="flex flex-1 flex-col">
            {lastCard ? (
              <div
                className="mb-4 flex items-start gap-2.5 rounded-xl border border-blush/20 bg-blush/[0.07] px-3.5 py-2.5"
                data-stage-item
                role="note"
              >
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-blush" aria-hidden="true" />
                <p className="text-[12.5px] leading-snug text-blush/90">
                  <span className="font-medium text-blush">Talk about it — </span>
                  {lastCard}
                </p>
              </div>
            ) : null}

            <p className="kicker" data-stage-item>
              {question.kicker}
            </p>
            <h1
              className="mt-2.5 font-display text-[1.85rem] leading-[1.15] text-cream text-balance"
              data-stage-item
              aria-live="polite"
            >
              {question.prompt}
            </h1>
            {question.helper ? (
              <p className="mt-2 text-[13.5px] leading-relaxed text-mist/75" data-stage-item>
                {question.helper}
              </p>
            ) : null}

            <div
              role="radiogroup"
              aria-label={question.prompt}
              className={cn('mt-6 grid gap-2.5', question.options.length > 5 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}
              data-stage-item
            >
              {question.options.map((option, index) => (
                <OptionCard
                  key={option.id}
                  option={option}
                  index={index}
                  total={question.options.length}
                  selected={currentAnswer === option.id}
                  tabIndex={currentAnswer ? (currentAnswer === option.id ? 0 : -1) : index === 0 ? 0 : -1}
                  onSelect={() => commitAnswer(question.id, option.id)}
                  onKeyDown={onOptionKeyDown}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 pb-2">
              <Button variant="quiet" onClick={skipQuestion}>
                Skip this one
              </Button>
              {currentAnswer && currentAnswer !== 'skipped' ? (
                <Button variant="secondary" size="sm" onClick={goNext}>
                  Next
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              ) : (
                <span className="text-[11px] text-mist/45">Tap a card to continue</span>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <footer className="pt-4">
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-mist/50">
          <Sparkles className="mt-[2px] h-3 w-3 shrink-0" aria-hidden="true" />
          No photos, no measurements. Your answers shape a style report — not a rating of how you look.
        </p>
      </footer>
    </Screen>
  );
}
