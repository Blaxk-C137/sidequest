import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, Phone, ShieldCheck } from 'lucide-react';
import { CONSENT_TEXT } from '@blaxaura/shared';
import { Screen, ScreenHeader } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useFlow } from '@/features/flow/FlowProvider';
import { api, ApiError } from '@/lib/api';

export function ConnectScreen() {
  const navigate = useNavigate();
  const { name } = useFlow();
  const [displayName, setDisplayName] = useState(name);
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const canSave = consent && displayName.trim().length > 0 && phone.trim().length >= 6 && !saving;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.saveContact({ displayName: displayName.trim(), phone: phone.trim(), consent: true });
      setSaved(true);
      window.setTimeout(() => navigate('/done', { state: { shared: true } }), 900);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That number could not be saved. You can still finish.');
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <Screen className="items-center justify-center text-center">
        <CheckCircle2 className="h-12 w-12 text-blush" aria-hidden="true" strokeWidth={1.3} />
        <h1 className="mt-5 font-display text-2xl text-cream">Saved on this device</h1>
        <p className="mt-2 max-w-[30ch] text-[13.5px] leading-relaxed text-mist/80">
          Nothing was added to the host&apos;s contact list or sent anywhere else.
        </p>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader backTo="/feedback" backLabel="Back" />
      <div className="flex flex-1 flex-col">
        <p className="kicker">Completely optional</p>
        <h1 className="mt-2.5 font-display text-[1.9rem] leading-tight text-cream text-balance">Want to keep in touch?</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-mist/80">
          If you would like the person who showed you BlaXaura to reach you, you can leave a number. If not, that is
          completely fine — you still get the whole experience.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="connect-name" className="text-[11px] uppercase tracking-[0.18em] text-mist/60">
              Name to save
            </label>
            <Input
              id="connect-name"
              className="mt-2"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value.slice(0, 60))}
              placeholder="First name or nickname"
              autoComplete="off"
              maxLength={60}
            />
          </div>

          <div>
            <label htmlFor="connect-phone" className="text-[11px] uppercase tracking-[0.18em] text-mist/60">
              Phone number
            </label>
            <div className="relative mt-2">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mist/50" aria-hidden="true" />
              <Input
                id="connect-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="pl-10"
                value={phone}
                onChange={(event) => setPhone(event.target.value.slice(0, 24))}
                placeholder="+234 803 123 4567"
                aria-describedby="phone-help"
              />
            </div>
            <p id="phone-help" className="mt-1.5 text-[11.5px] text-mist/55">
              Any international format works. Nigerian numbers can start with 0.
            </p>
          </div>

          <label htmlFor="connect-consent" className="flex cursor-pointer items-start gap-3 rounded-xl border border-cream/12 bg-cream/[0.03] p-3.5">
            <Checkbox
              id="connect-consent"
              checked={consent}
              onCheckedChange={(value) => setConsent(value === true)}
              aria-describedby="consent-copy"
            />
            <span id="consent-copy" className="text-[12.5px] leading-relaxed text-mist/85">
              {CONSENT_TEXT}
            </span>
          </label>

          <p className="flex items-start gap-2 rounded-xl border border-cream/10 bg-midnight/40 px-3.5 py-3 text-[11.5px] leading-relaxed text-mist/60">
            <ShieldCheck className="mt-[1px] h-3.5 w-3.5 shrink-0 text-blush/80" aria-hidden="true" />
            The host can see and export whatever you save here, and delete it later. It is never sent to the AI writer and
            never synced to a phone&apos;s contact list.
          </p>

          {error ? (
            <p role="alert" className="rounded-xl border border-rose/40 bg-rose/10 px-3.5 py-3 text-[12.5px] text-[#ffd9e4]">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-auto space-y-2.5 pt-8">
          <Button size="lg" className="w-full" onClick={save} disabled={!canSave}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Save my number
          </Button>
          <Button variant="secondary" size="lg" className="w-full" onClick={() => navigate('/done', { state: { shared: false } })}>
            No thanks — finish
          </Button>
          <p className="pt-1 text-center text-[11px] text-mist/45">Both options end the experience the same way.</p>
        </div>
      </div>
    </Screen>
  );
}
