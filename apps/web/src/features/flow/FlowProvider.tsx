import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Report } from '@blaxaura/shared';
import { api } from '@/lib/api';

/**
 * Participant flow state.
 *
 * Everything lives in memory and mirrors to `sessionStorage` so an accidental
 * refresh does not lose the report. It is wiped on "finish" and on "restart",
 * and no participant data ever appears in the URL.
 */
const STORAGE_KEY = 'blaxaura.flow.v1';

export type FlowState = {
  sessionId: string | null;
  name: string;
  answers: Record<string, string>;
  report: Report | null;
  feedbackSent: boolean;
};

const EMPTY: FlowState = { sessionId: null, name: '', answers: {}, report: null, feedbackSent: false };

function loadInitial(): FlowState {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<FlowState>;
    return {
      sessionId: typeof parsed.sessionId === 'string' ? parsed.sessionId : null,
      name: typeof parsed.name === 'string' ? parsed.name : '',
      answers: parsed.answers && typeof parsed.answers === 'object' ? (parsed.answers as Record<string, string>) : {},
      report: (parsed.report as Report | null) ?? null,
      feedbackSent: Boolean(parsed.feedbackSent),
    };
  } catch {
    return EMPTY;
  }
}

type FlowContextValue = FlowState & {
  setName: (name: string) => void;
  setAnswer: (questionId: string, optionId: string) => void;
  setReport: (report: Report, sessionId: string) => void;
  markFeedbackSent: () => void;
  reset: () => void;
  ensureSession: () => Promise<string | null>;
};

const FlowContext = createContext<FlowContextValue | null>(null);

export function FlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FlowState>(loadInitial);
  const pending = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage may be unavailable in private modes; the flow still works in memory */
    }
  }, [state]);

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (state.sessionId) return state.sessionId;
    if (pending.current) return pending.current;
    pending.current = api
      .startSession()
      .then((sessionId) => {
        setState((current) => (current.sessionId ? current : { ...current, sessionId }));
        return sessionId;
      })
      .catch(() => null)
      .finally(() => {
        pending.current = null;
      });
    return pending.current;
  }, [state.sessionId]);

  const value = useMemo<FlowContextValue>(
    () => ({
      ...state,
      setName: (name) => setState((current) => ({ ...current, name: name.slice(0, 40) })),
      setAnswer: (questionId, optionId) =>
        setState((current) => ({
          ...current,
          answers: { ...current.answers, [questionId]: optionId },
        })),
      setReport: (report, sessionId) => setState((current) => ({ ...current, report, sessionId })),
      markFeedbackSent: () => setState((current) => ({ ...current, feedbackSent: true })),
      reset: () => {
        try {
          window.sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
        setState(EMPTY);
      },
      ensureSession,
    }),
    [state, ensureSession],
  );

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useFlow(): FlowContextValue {
  const context = useContext(FlowContext);
  if (!context) throw new Error('useFlow must be used inside FlowProvider');
  return context;
}
