import { useEffect, useState } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wordmark } from '@/components/Wordmark';
import { adminApi, type AdminSession } from './adminApi';
import { ApiError } from '@/lib/api';

export function AdminGate({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi
      .session()
      .then((value) => {
        setSession(value);
        if (value.authenticated) onAuthenticated();
      })
      .catch(() => setSession({ configured: true, authenticated: false, expiresAt: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSetup = session ? !session.configured : false;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (isSetup && password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      if (isSetup) await adminApi.setup(password);
      else await adminApi.login(password);
      setPassword('');
      onAuthenticated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return (
      <Screen className="items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blush" aria-hidden="true" />
        <p className="mt-3 text-[13px] text-mist/70">Checking host session…</p>
      </Screen>
    );
  }

  return (
    <Screen className="justify-center">
      <div className="mb-8 flex items-center justify-between">
        <Wordmark size="sm" />
        <span className="kicker">Host only</span>
      </div>

      <div className="rounded-2xl border border-cream/12 bg-midnight/55 p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-blush/30 bg-blush/10">
          {isSetup ? <ShieldCheck className="h-5 w-5 text-blush" aria-hidden="true" /> : <KeyRound className="h-5 w-5 text-blush" aria-hidden="true" />}
        </div>
        <h1 className="mt-4 font-display text-2xl text-cream">{isSetup ? 'Set a host password' : 'Host dashboard'}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-mist/80">
          {isSetup
            ? 'This password protects saved numbers and feedback on this device. It is hashed with Argon2id and cannot be recovered — store it safely.'
            : 'Enter the host password to see contacts, ratings and feedback stored on this device.'}
        </p>

        <form className="mt-5 space-y-3" onSubmit={submit}>
          <div>
            <label htmlFor="host-password" className="text-[11px] uppercase tracking-[0.18em] text-mist/60">
              {isSetup ? 'New password (min. 10 characters)' : 'Password'}
            </label>
            <Input
              id="host-password"
              type="password"
              autoComplete={isSetup ? 'new-password' : 'current-password'}
              className="mt-2"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={isSetup ? 10 : 1}
            />
          </div>
          {isSetup ? (
            <div>
              <label htmlFor="host-password-confirm" className="text-[11px] uppercase tracking-[0.18em] text-mist/60">
                Confirm password
              </label>
              <Input
                id="host-password-confirm"
                type="password"
                autoComplete="new-password"
                className="mt-2"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
                minLength={10}
              />
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-xl border border-rose/40 bg-rose/10 px-3.5 py-2.5 text-[12.5px] text-[#ffd9e4]">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={busy || password.length === 0}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {isSetup ? 'Create password and open dashboard' : 'Unlock dashboard'}
          </Button>
        </form>
      </div>

      <p className="mt-5 text-center text-[11px] leading-relaxed text-mist/45">
        No default PIN exists. This protects local records only — do not expose this app to the public internet.
      </p>
    </Screen>
  );
}
