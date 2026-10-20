import { lazy, Suspense, useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { FlowProvider, useFlow } from '@/features/flow/FlowProvider';
import { Welcome } from '@/features/quiz/Welcome';
import { QuizFlow } from '@/features/quiz/QuizFlow';
import { Reveal } from '@/features/report/Reveal';
import { FeedbackScreen } from '@/features/feedback/FeedbackScreen';
import { ConnectScreen } from '@/features/connect/ConnectScreen';
import { DoneScreen } from '@/features/connect/DoneScreen';
// The host dashboard is only ever opened at the counter, so keep it out of the
// participant bundle.
const AdminScreen = lazy(() => import('@/features/admin/AdminScreen').then((module) => ({ default: module.AdminScreen })));
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/Wordmark';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

function RequireAnswers({ children }: { children: React.ReactNode }) {
  const { answers } = useFlow();
  if (Object.keys(answers).length === 0) return <Navigate to="/quiz" replace />;
  return <>{children}</>;
}

function RequireReport({ children }: { children: React.ReactNode }) {
  const { report } = useFlow();
  if (!report) return <Navigate to="/reveal" replace />;
  return <>{children}</>;
}

function NotFound() {
  return (
    <Screen className="items-center justify-center text-center">
      <Wordmark size="md" />
      <h1 className="mt-8 font-display text-3xl text-cream">This page has drifted away</h1>
      <p className="mt-2 max-w-[32ch] text-[13.5px] leading-relaxed text-mist/75">
        Nothing here is broken — the link just does not exist. Start again from the welcome screen.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Back to the start</Link>
      </Button>
    </Screen>
  );
}

export function App() {
  return (
    <FlowProvider>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/quiz" element={<QuizFlow />} />
        <Route
          path="/reveal"
          element={
            <RequireAnswers>
              <Reveal />
            </RequireAnswers>
          }
        />
        <Route
          path="/feedback"
          element={
            <RequireReport>
              <FeedbackScreen />
            </RequireReport>
          }
        />
        <Route
          path="/connect"
          element={
            <RequireReport>
              <ConnectScreen />
            </RequireReport>
          }
        />
        <Route path="/done" element={<DoneScreen />} />
        <Route
          path="/admin"
          element={
            <Suspense fallback={<Screen className="items-center justify-center"><Wordmark size="sm" /></Screen>}>
              <AdminScreen />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </FlowProvider>
  );
}
