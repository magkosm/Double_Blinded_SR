import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { LoginForm } from '../components/LoginForm';
import { SwipeCard } from '../components/SwipeCard';
import { RubricPanel } from '../components/RubricPanel';
import * as api from '../lib/api-client';
import { decryptWithKey, encryptWithKey, unwrapProjectKey } from '../lib/crypto';
import { buildQueue, computeStats, decisionsToMap } from '../lib/screening';
import type { Decision, DecisionRecord, ScreeningRecord, ScreeningRubric } from '../types';
import { EMPTY_RUBRIC } from '../types';

export function ReviewerScreen() {
  const { session, setSession, reviewerPassword, setReviewerPassword, logout } = useAuth();
  const [papers, setPapers] = useState<ScreeningRecord[]>([]);
  const [decisions, setDecisions] = useState<Map<string, DecisionRecord>>(new Map());
  const [projectKey, setProjectKey] = useState<CryptoKey | null>(null);
  const [projectSalt, setProjectSalt] = useState<Uint8Array | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [queueIndex, setQueueIndex] = useState(0);
  const [history, setHistory] = useState<DecisionRecord[]>([]);
  const [showHints, setShowHints] = useState(true);
  const [rubric, setRubric] = useState<ScreeningRubric>(EMPTY_RUBRIC);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const handleDecisionRef = useRef<(d: Decision) => void>(() => {});

  const loadData = useCallback(async (token: string, userId: string, password: string) => {
    setLoading(true);
    setError('');
    try {
      const [meta, papersPayload, decisionsPayload, rubricPayload] = await Promise.all([
        api.fetchReviewerMeta(userId, token),
        api.fetchPapers(token),
        api.fetchDecisions(userId, token),
        api.fetchRubric(token),
      ]);

      const { key } = await unwrapProjectKey(meta.wrappedProjectKey, password);
      const salt = Uint8Array.from(atob(papersPayload.salt), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
      setProjectKey(key);
      setProjectSalt(salt);

      const decryptedPapers = await decryptWithKey<ScreeningRecord[]>(
        papersPayload as { ciphertext: string; iv: string; salt: string },
        key,
      );
      setPapers(decryptedPapers);

      if (decisionsPayload) {
        const decryptedDecisions = await decryptWithKey<DecisionRecord[]>(
          decisionsPayload as { ciphertext: string; iv: string; salt: string },
          key,
        );
        setDecisions(decisionsToMap(decryptedDecisions));
      }

      if (rubricPayload) {
        const decryptedRubric = await decryptWithKey<ScreeningRubric>(
          rubricPayload as { ciphertext: string; iv: string; salt: string },
          key,
        );
        setRubric(decryptedRubric);
      } else {
        setRubric(EMPTY_RUBRIC);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load screening data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.role === 'reviewer' && reviewerPassword) {
      loadData(session.token, session.userId, reviewerPassword);
    }
  }, [session, reviewerPassword, loadData]);

  useEffect(() => {
    if (history.length >= 3) setShowHints(false);
  }, [history.length]);

  const persistDecisions = useCallback(
    async (updated: Map<string, DecisionRecord>, key: CryptoKey, salt: Uint8Array, token: string, userId: string) => {
      const records = [...updated.values()];
      const payload = await encryptWithKey(records, key, salt);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await api.saveDecisions(userId, payload, token);
        } catch (err) {
          console.error('Save failed', err);
        }
      }, 500);
    },
    [],
  );

  const handleDecision = useCallback(
    (decision: Decision) => {
      const queue = buildQueue(papers, decisions);
      const paper = queue[queueIndex];
      if (!paper || !session || !projectKey || !projectSalt) return;

      const record: DecisionRecord = {
        paperId: paper.id,
        decision,
        decidedAt: new Date().toISOString(),
      };

      const updated = new Map(decisions);
      updated.set(paper.id, record);
      setDecisions(updated);
      setHistory((h) => [...h.slice(-9), record]);
      persistDecisions(updated, projectKey, projectSalt, session.token, session.userId);

      const newQueue = buildQueue(papers, updated);
      setQueueIndex((i) => Math.min(i, Math.max(0, newQueue.length - 1)));
    },
    [papers, decisions, queueIndex, session, projectKey, projectSalt, persistDecisions],
  );

  handleDecisionRef.current = handleDecision;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!session || loading) return;
      const map: Record<string, Decision> = {
        ArrowRight: 'include',
        ArrowLeft: 'exclude',
        ArrowDown: 'maybe',
        ArrowUp: 'skip',
      };
      if (map[e.key]) {
        e.preventDefault();
        handleDecisionRef.current(map[e.key]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, loading]);

  async function handleLogin(username: string, password: string) {
    const auth = await api.login(username, password, 'reviewer');
    setReviewerPassword(password);
    setSession(auth);
  }

  function handleUndo() {
    if (history.length === 0 || !session || !projectKey || !projectSalt) return;
    const last = history[history.length - 1];
    const updated = new Map(decisions);
    updated.delete(last.paperId);
    setDecisions(updated);
    setHistory((h) => h.slice(0, -1));
    persistDecisions(updated, projectKey, projectSalt, session.token, session.userId);
  }

  if (!session || session.role !== 'reviewer') {
    return (
      <LoginForm
        title="Title & Abstract Screening"
        subtitle="Sign in with credentials provided by the study admin"
        role="reviewer"
        onSubmit={handleLogin}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          <p className="text-slate-600">Loading papers…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-4">
        <p className="text-rose-600">{error}</p>
        <button onClick={logout} className="rounded-xl bg-slate-800 px-4 py-2 text-white">
          Sign out
        </button>
      </div>
    );
  }

  const queue = buildQueue(papers, decisions);
  const stats = computeStats(papers, decisions);
  const current = queue[queueIndex] ?? null;
  const done = queue.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-100 to-slate-200">
      <header className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Screening</p>
          <p className="text-sm font-semibold text-slate-800">
            {stats.total - stats.pending} / {stats.total} reviewed
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">{stats.include} yes</span>
          <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">{stats.exclude} no</span>
          <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">{stats.maybe} maybe</span>
        </div>
        <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-800">
          Sign out
        </button>
      </header>

      {showHints && !done && (
        <div className="mx-4 mb-2 rounded-xl bg-white/80 px-4 py-2 text-center text-xs text-slate-500">
          Swipe or use arrows: → Include · ← Exclude · ↓ Maybe · ↑ Skip
        </div>
      )}

      <RubricPanel rubric={rubric} variant="reviewer" />

      <main className="relative flex-1 px-4 pb-6 pt-2" style={{ minHeight: '60vh' }}>
        {done ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 text-5xl">✓</div>
            <h2 className="font-display text-2xl font-semibold text-slate-800">All done!</h2>
            <p className="mt-2 text-slate-500">You&apos;ve screened all papers in your queue.</p>
          </div>
        ) : current ? (
          <SwipeCard
            key={current.id}
            paper={current}
            onDecision={handleDecision}
            index={stats.total - stats.pending}
            total={stats.total}
          />
        ) : null}
      </main>

      <footer className="flex items-center justify-between border-t border-slate-200 bg-white/80 px-4 py-3">
        <button
          onClick={handleUndo}
          disabled={history.length === 0}
          className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        >
          Undo last
        </button>
        <p className="text-xs text-slate-400">{session.username}</p>
      </footer>
    </div>
  );
}
