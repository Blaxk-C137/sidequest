import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  Loader2,
  LogOut,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Settings2,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Wordmark } from '@/components/Wordmark';
import { useFlow } from '@/features/flow/FlowProvider';
import { formatDate, pluralize, cn } from '@/lib/utils';
import { adminApi, type Contact, type FeedbackEntry, type Stats } from './adminApi';
import { ApiError } from '@/lib/api';

type Tab = 'overview' | 'contacts' | 'feedback' | 'retention';

const TABS: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  { id: 'retention', label: 'Retention', icon: Settings2 },
];

export function AdminDashboard({ onSignedOut }: { onSignedOut: () => void }) {
  const { reset } = useFlow();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [purgeDays, setPurgeDays] = useState(30);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsResult, contactsResult, feedbackResult] = await Promise.all([
        adminApi.stats(),
        adminApi.contacts(query),
        adminApi.feedback(),
      ]);
      setStats(statsResult);
      setContacts(contactsResult.contacts);
      setFeedback(feedbackResult.feedback);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        onSignedOut();
        return;
      }
      setError(caught instanceof ApiError ? caught.message : 'Could not load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [query, onSignedOut]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3200);
  };

  const act = async (action: () => Promise<unknown>, message: string) => {
    setError(null);
    try {
      await action();
      flash(message);
      await refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        onSignedOut();
        return;
      }
      setError(caught instanceof ApiError ? caught.message : 'That action failed.');
    }
  };

  const signOut = async () => {
    try {
      await adminApi.logout();
    } catch {
      /* the cookie is cleared client-side on reload anyway */
    }
    reset();
    onSignedOut();
  };

  const maxStars = useMemo(
    () => Math.max(1, ...(stats?.feedback.distribution.map((entry) => entry.count) ?? [1])),
    [stats],
  );

  return (
    <Screen className="max-w-[720px]">
      <header className="flex items-center justify-between pb-5">
        <div className="flex items-center gap-2.5">
          <Wordmark size="sm" />
          <span className="rounded-full border border-blush/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-blush/80">
            Host
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          Sign out
        </Button>
      </header>

      <div className="mb-5 grid grid-cols-4 gap-1.5" role="tablist" aria-label="Dashboard sections">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            onClick={() => setTab(id)}
            aria-selected={tab === id}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-[11.5px] transition-colors',
              tab === id
                ? 'border-rose/60 bg-rose/15 text-cream'
                : 'border-cream/12 bg-cream/[0.03] text-mist/80 hover:border-blush/40 hover:text-cream',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {notice ? (
        <p role="status" className="mb-4 rounded-xl border border-blush/30 bg-blush/10 px-3.5 py-2.5 text-[12.5px] text-cream">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-4 rounded-xl border border-rose/40 bg-rose/10 px-3.5 py-2.5 text-[12.5px] text-[#ffd9e4]">
          {error}
        </p>
      ) : null}

      {loading && !stats ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-blush" aria-hidden="true" />
        </div>
      ) : null}

      {tab === 'overview' && stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Completed reports" value={String(stats.sessions.completed)} hint={`${stats.sessions.started} started`} />
            <StatCard
              label="Completion rate"
              value={stats.sessions.completionRate === null ? '—' : `${stats.sessions.completionRate}%`}
              hint="reports / starts"
            />
            <StatCard label="Feedback entries" value={String(stats.feedback.total)} hint={`${stats.feedback.unrated} unrated`} />
            <StatCard
              label="Average rating"
              value={stats.feedback.averageRating === null ? '—' : `${stats.feedback.averageRating} ★`}
              hint="out of 5"
            />
          </div>

          <section className="rounded-2xl border border-cream/12 bg-midnight/50 p-4">
            <h2 className="text-[11px] uppercase tracking-[0.18em] text-mist/60">Ratings</h2>
            <div className="mt-3 space-y-2">
              {[...stats.feedback.distribution].reverse().map((entry) => (
                <div key={entry.stars} className="flex items-center gap-2.5">
                  <span className="w-8 shrink-0 text-[11px] tabular-nums text-mist/70">{entry.stars} ★</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blush to-rose"
                      style={{ width: `${(entry.count / maxStars) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-[11px] tabular-nums text-mist/60">{entry.count}</span>
                </div>
              ))}
            </div>
            {stats.feedback.topTags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {stats.feedback.topTags.map((tag) => (
                  <span key={tag.tag} className="rounded-full border border-cream/12 bg-cream/[0.04] px-2.5 py-1 text-[11px] text-mist/80">
                    {tag.tag} · {tag.count}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[12px] text-mist/50">No tags yet.</p>
            )}
          </section>

          <section className="rounded-2xl border border-cream/12 bg-midnight/50 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] uppercase tracking-[0.18em] text-mist/60">Recent comments</h2>
              <span className="text-[11px] text-mist/45">{pluralize(stats.contacts.total, 'contact')} saved</span>
            </div>
            <div className="mt-3 space-y-2.5">
              {stats.feedback.recentComments.length === 0 ? (
                <p className="text-[12px] text-mist/50">No written feedback yet.</p>
              ) : (
                stats.feedback.recentComments.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-cream/10 bg-cream/[0.02] px-3 py-2.5">
                    <p className="text-[12.5px] leading-relaxed text-cream/90">“{entry.comment}”</p>
                    <p className="mt-1 text-[10.5px] text-mist/45">
                      {entry.stars ? `${entry.stars} ★ · ` : ''}
                      {formatDate(entry.created_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          {stats.sessions.modes.length > 0 ? (
            <p className="text-[11px] text-mist/45">
              Report modes: {stats.sessions.modes.map((mode) => `${mode.report_mode} ${mode.count}`).join(' · ')}
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === 'contacts' ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mist/50" aria-hidden="true" />
              <Input
                className="pl-10"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void refresh();
                }}
                placeholder="Search name or number"
                aria-label="Search saved contacts"
              />
            </div>
            <Button variant="secondary" size="icon" className="h-12 w-12" onClick={() => void refresh()} aria-label="Search">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/api/admin/export/contacts" download>
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Export CSV
              </a>
            </Button>
            <ConfirmButton
              label="Clear all contacts"
              title="Delete every saved number?"
              description="This permanently removes all contacts saved on this device. It cannot be undone, and exported copies are not affected."
              confirmLabel="Delete all contacts"
              onConfirm={() => act(() => adminApi.clearContacts(), 'All contacts deleted.')}
            />
          </div>

          {contacts.length === 0 ? (
            <EmptyState icon={Users} title="No saved numbers" body="Contacts appear here only when someone ticks the consent box and saves a number." />
          ) : (
            <ul className="space-y-2">
              {contacts.map((contact) => (
                <li key={contact.id} className="flex items-center gap-3 rounded-xl border border-cream/12 bg-midnight/45 px-3.5 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-blush/25 bg-blush/10 text-[12px] text-blush">
                    {contact.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] text-cream">{contact.displayName}</p>
                    <p className="flex items-center gap-1.5 text-[12px] tabular-nums text-mist/70">
                      <Phone className="h-3 w-3" aria-hidden="true" />
                      {contact.phone}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-mist/40">
                      consented {formatDate(contact.consentedAt)} · terms v{contact.consentTextVersion.replace(/^\d{4}-\d{2}-/, '')}
                    </p>
                  </div>
                  <ConfirmButton
                    iconOnly
                    label=""
                    title={`Delete ${contact.displayName}?`}
                    description="This removes the saved number from this device. It does not notify the person."
                    confirmLabel="Delete contact"
                    onConfirm={() => act(() => adminApi.deleteContact(contact.id), 'Contact deleted.')}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === 'feedback' ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <ConfirmButton
              label="Clear all feedback"
              title="Delete all feedback?"
              description="Ratings, tags and comments saved on this device will be permanently removed."
              confirmLabel="Delete all feedback"
              onConfirm={() => act(() => adminApi.clearFeedback(), 'All feedback deleted.')}
            />
          </div>
          {feedback.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No feedback yet" body="Participants can rate the experience, add tags and leave a comment — all optional." />
          ) : (
            <ul className="space-y-2">
              {feedback.map((entry) => (
                <li key={entry.id} className="rounded-xl border border-cream/12 bg-midnight/45 px-3.5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 text-[13px] text-blush">
                        {entry.stars ? (
                          <>
                            {Array.from({ length: entry.stars }).map((_, index) => (
                              <Star key={index} className="h-3.5 w-3.5 fill-rose text-rose" aria-hidden="true" />
                            ))}
                            <span className="ml-1 text-[11px] text-mist/50">{entry.stars}/5</span>
                          </>
                        ) : (
                          <span className="text-[11.5px] text-mist/50">No rating</span>
                        )}
                      </p>
                      {entry.comment ? <p className="mt-1.5 text-[13px] leading-relaxed text-cream/90">“{entry.comment}”</p> : null}
                      {entry.tags.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {entry.tags.map((tag) => (
                            <span key={tag} className="rounded-full border border-cream/12 px-2 py-0.5 text-[10.5px] text-mist/70">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-2 text-[10.5px] text-mist/40">
                        {formatDate(entry.createdAt)}
                        {entry.retryIntent ? ` · would return: ${entry.retryIntent}` : ''}
                      </p>
                    </div>
                    <ConfirmButton
                      iconOnly
                      label=""
                      title="Delete this feedback?"
                      description="This permanently removes the rating, tags and comment."
                      confirmLabel="Delete"
                      onConfirm={() => act(() => adminApi.deleteFeedback(entry.id), 'Feedback deleted.')}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === 'retention' ? (
        <div className="space-y-4">
          <section className="rounded-2xl border border-cream/12 bg-midnight/50 p-4">
            <h2 className="font-display text-lg text-cream">Retention control</h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-mist/80">
              BlaXaura keeps only names, numbers, consent timestamps, ratings and comments. Delete anything older than a
              window you choose — for example, purge everything after an event.
            </p>
            <div className="mt-4 flex items-end gap-2">
              <div className="flex-1">
                <label htmlFor="purge-days" className="text-[11px] uppercase tracking-[0.18em] text-mist/60">
                  Older than (days)
                </label>
                <Input
                  id="purge-days"
                  type="number"
                  min={1}
                  max={3650}
                  className="mt-2"
                  value={purgeDays}
                  onChange={(event) => setPurgeDays(Math.max(1, Math.min(3650, Number(event.target.value) || 1)))}
                />
              </div>
              <ConfirmButton
                label="Purge now"
                title={`Delete data older than ${purgeDays} days?`}
                description="Contacts, feedback and session counts older than the window will be permanently deleted from this device."
                confirmLabel="Purge data"
                onConfirm={() =>
                  act(async () => {
                    const result = await adminApi.purge(purgeDays);
                    flash(`Purged ${result.contacts} contacts and ${result.feedback} feedback entries.`);
                  }, 'Retention purge complete.')
                }
              />
            </div>
          </section>

          <section className="rounded-2xl border border-cream/12 bg-midnight/50 p-4">
            <h2 className="font-display text-lg text-cream">What is stored here</h2>
            <ul className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-mist/80">
              <li>• Contacts: name, normalised number, consent text version, consent timestamp.</li>
              <li>• Feedback: stars, tags, comment, retry intent, timestamp, optional session id (never a phone number).</li>
              <li>• Sessions: a random id, timestamps and report mode. Quiz answers are not stored.</li>
              <li>• Nothing is sent to a third-party analytics service, and phone numbers never reach the AI writer.</li>
            </ul>
            <p className="mt-3 text-[11.5px] text-mist/50">
              The database file is{' '}
              <code className="rounded bg-cream/10 px-1 py-0.5 text-[11px]">data/blaxaura.sqlite</code> and is excluded from
              git.
            </p>
          </section>
        </div>
      ) : null}
    </Screen>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-cream/12 bg-[linear-gradient(150deg,rgba(48,32,50,0.6),rgba(23,17,34,0.7))] p-4">
      <p className="text-[10.5px] uppercase tracking-[0.16em] text-mist/55">{label}</p>
      <p className="mt-1.5 font-display text-[1.9rem] leading-none text-cream">{value}</p>
      <p className="mt-1 text-[10.5px] text-mist/45">{hint}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }: { icon: typeof Users; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-cream/15 bg-midnight/30 px-5 py-10 text-center">
      <Icon className="mx-auto h-7 w-7 text-mist/40" aria-hidden="true" strokeWidth={1.4} />
      <p className="mt-3 font-display text-lg text-cream">{title}</p>
      <p className="mx-auto mt-1.5 max-w-[36ch] text-[12.5px] leading-relaxed text-mist/60">{body}</p>
    </div>
  );
}

function ConfirmButton({
  label,
  title,
  description,
  confirmLabel,
  onConfirm,
  iconOnly = false,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {iconOnly ? (
          <Button variant="ghost" size="icon" aria-label="Delete" className="text-mist/50 hover:text-rose">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button variant="danger" size="sm">
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={title} description={description}>
        <div className="flex gap-2">
          <DialogClose asChild>
            <Button variant="secondary" className="flex-1" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="danger"
            className="flex-1"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
