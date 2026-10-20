import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, MessageSquareHeart } from 'lucide-react';
import { FEEDBACK_TAGS } from '@blaxaura/shared';
import { Screen, ScreenHeader } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { StarRating } from '@/components/ui/star-rating';
import { Textarea } from '@/components/ui/input';
import { useFlow } from '@/features/flow/FlowProvider';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

export function FeedbackScreen() {
  const navigate = useNavigate();
  const { sessionId, feedbackSent, markFeedbackSent } = useFlow();
  const [stars, setStars] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [retryIntent, setRetryIntent] = useState<'yes' | 'maybe' | 'no' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (tag: string) => {
    setTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.sendFeedback({
        sessionId,
        stars,
        tags,
        comment: comment.trim() ? comment.trim() : null,
        retryIntent,
      });
      markFeedbackSent();
      navigate('/connect');
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Your feedback could not be saved just now. You can still finish.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader backTo="/reveal" backLabel="Report" />
      <div className="flex flex-1 flex-col">
        <p className="kicker">Optional</p>
        <h1 className="mt-2.5 font-display text-[1.9rem] leading-tight text-cream text-balance">
          How was your BlaXaura experience?
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-mist/80">
          This rates the app, not you. It is stored on this device without your phone number.
        </p>

        <div className="mt-7">
          <StarRating value={stars} onChange={setStars} />
        </div>

        <fieldset className="mt-6">
          <legend className="text-[11px] uppercase tracking-[0.18em] text-mist/60">Anything that stood out?</legend>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {FEEDBACK_TAGS.map((tag) => {
              const active = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] transition-all',
                    active
                      ? 'border-rose/70 bg-rose/15 text-cream'
                      : 'border-cream/15 bg-cream/[0.03] text-mist/85 hover:border-blush/40 hover:text-cream',
                  )}
                >
                  {active ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                  {tag}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-6">
          <label htmlFor="feedback-comment" className="text-[11px] uppercase tracking-[0.18em] text-mist/60">
            A sentence or two (optional)
          </label>
          <Textarea
            id="feedback-comment"
            className="mt-2.5"
            value={comment}
            maxLength={500}
            onChange={(event) => setComment(event.target.value.slice(0, 500))}
            placeholder="What worked, what felt off…"
          />
          <p className="mt-1 text-right text-[11px] tabular-nums text-mist/45">{comment.length}/500</p>
        </div>

        <fieldset className="mt-2">
          <legend className="text-[11px] uppercase tracking-[0.18em] text-mist/60">Would you try BlaXaura again?</legend>
          <div className="mt-2.5 flex gap-2">
            {(['yes', 'maybe', 'no'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={retryIntent === value}
                onClick={() => setRetryIntent(retryIntent === value ? null : value)}
                className={cn(
                  'flex-1 rounded-xl border px-3 py-2.5 text-[13px] capitalize transition-all',
                  retryIntent === value
                    ? 'border-rose/70 bg-rose/15 text-cream'
                    : 'border-cream/15 bg-cream/[0.03] text-mist/85 hover:border-blush/40',
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </fieldset>

        {error ? (
          <p role="alert" className="mt-4 rounded-xl border border-rose/40 bg-rose/10 px-3.5 py-3 text-[12.5px] text-[#ffd9e4]">
            {error}
          </p>
        ) : null}

        <div className="mt-auto space-y-2.5 pt-8">
          <Button size="lg" className="w-full" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MessageSquareHeart className="h-4 w-4" aria-hidden="true" />}
            {feedbackSent ? 'Send again' : 'Send feedback'}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => navigate('/connect')}>
            Skip — no feedback
          </Button>
        </div>
      </div>
    </Screen>
  );
}
