import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoginForm } from '../components/LoginForm';
import { SwipeCard } from '../components/SwipeCard';
import { RubricPanel } from '../components/RubricPanel';
import { BucketReviewStage } from '../components/BucketReviewStage';
import { SummaryView } from '../components/SummaryView';
import { FullTextScreen } from '../components/FullTextScreen';
import { PageSkeleton } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import * as api from '../lib/api-client';
import { decryptWithKey, encryptWithKey, unwrapProjectKey } from '../lib/crypto';
import { buildQueue, computeStats, decisionsToMap } from '../lib/screening';
import type {
  Decision,
  DecisionRecord,
  FulltextNotes,
  ReviewMeta,
  ScreeningRecord,
  ScreeningRubric,
} from '../types';
import { DEFAULT_BUCKETS, EMPTY_RUBRIC } from '../types';

const EMPTY_NOTES: FulltextNotes = {
  comments: [],
  annotations: [],
  customFields: {},
  generalNotes: '',
};

export function ReviewerScreen() {
  const { reviewSlug: paramSlug } = useParams<{ reviewSlug: string }>();
  const reviewSlug = paramSlug || 'default';
  const { session, setSession, reviewerPassword, setReviewerPassword, logout } = useAuth();
  const { toast } = useToast();

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
  const [reviewMeta, setReviewMeta] = useState<ReviewMeta | null>(null);
  const [bucketLabels, setBucketLabels] = useState<string[]>(DEFAULT_BUCKETS);
  const [bucketReviewDone, setBucketReviewDone] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [fulltextPaper, setFulltextPaper] = useState<ScreeningRecord | null>(null);
  const [fulltextNotes, setFulltextNotes] = useState<FulltextNotes>(EMPTY_NOTES);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const handleDecisionRef = useRef<(d: Decision, buckets?: string[]) => void>(() => {});

  const loadData = useCallback(
    async (token: string, userId: string, password: string, slug: string) => {
      setLoading(true);
      setError('');
      try {
        const [meta, papersPayload, decisionsPayload, rubricPayload, publicMeta, buckets] =
          await Promise.all([
            api.fetchReviewerMeta(userId, token, slug),
            api.fetchPapers(token, slug),
            api.fetchDecisions(userId, token, slug),
            api.fetchRubric(token, slug),
            api.fetchReviewPublic(slug).catch(() => null),
            api.fetchBuckets(token, slug).catch(() => ({ labels: DEFAULT_BUCKETS })),
          ]);

        if (publicMeta) {
          setReviewMeta(publicMeta as ReviewMeta);
        }
        setBucketLabels(buckets.labels);

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
          setRubric(await decryptWithKey<ScreeningRubric>(rubricPayload, key));
        }

        await api.patchStats(token, slug, { logins: 1 }).catch(() => {});
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load screening data');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (session?.role === 'reviewer' && reviewerPassword) {
      loadData(session.token, session.userId, reviewerPassword, session.reviewSlug || reviewSlug);
    }
  }, [session, reviewerPassword, loadData, reviewSlug]);

  useEffect(() => {
    if (history.length >= 3) setShowHints(false);
  }, [history.length]);

  const persistDecisions = useCallback(
    async (
      updated: Map<string, DecisionRecord>,
      key: CryptoKey,
      salt: Uint8Array,
      token: string,
      userId: string,
      slug: string,
    ) => {
      const records = [...updated.values()];
      const payload = await encryptWithKey(records, key, salt);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await api.saveDecisions(userId, payload, token, slug);
        } catch (err) {
          toast('Failed to save — check connection', 'error');
          console.error(err);
        }
      }, 500);
    },
    [toast],
  );

  const finalizeDecision = useCallback(
    (record: DecisionRecord) => {
      if (!session || !projectKey || !projectSalt) return;
      const slug = session.reviewSlug || reviewSlug;
      const updated = new Map(decisions);
      updated.set(record.paperId, record);
      setDecisions(updated);
      setHistory((h) => [...h.slice(-9), record]);
      persistDecisions(updated, projectKey, projectSalt, session.token, session.userId, slug);
      api.patchStats(session.token, slug, { decisionType: record.decision, papersScreened: 1 }).catch(() => {});

      const newQueue = buildQueue(papers, updated);
      setQueueIndex((i) => Math.min(i, Math.max(0, newQueue.length - 1)));
    },
    [session, projectKey, projectSalt, decisions, papers, persistDecisions, reviewSlug],
  );

  const handleDecision = useCallback(
    (decision: Decision, buckets?: string[]) => {
      const queue = buildQueue(papers, decisions);
      const paper = queue[queueIndex];
      if (!paper || !session) return;

      const record: DecisionRecord = {
        paperId: paper.id,
        decision,
        decidedAt: new Date().toISOString(),
        ...(buckets && buckets.length > 0 ? { buckets } : {}),
      };
      finalizeDecision(record);
    },
    [papers, decisions, queueIndex, session, finalizeDecision],
  );

  handleDecisionRef.current = handleDecision;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!session || loading || showSummary) return;
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
  }, [session, loading, showSummary]);

  async function handleLogin(username: string, password: string) {
    const auth = await api.login(username, password, 'reviewer', reviewSlug);
    setReviewerPassword(password);
    setSession(auth);
  }

  function handleUndo() {
    if (history.length === 0 || !session || !projectKey || !projectSalt) return;
    const slug = session.reviewSlug || reviewSlug;
    const last = history[history.length - 1];
    const updated = new Map(decisions);
    updated.delete(last.paperId);
    setDecisions(updated);
    setHistory((h) => h.slice(0, -1));
    persistDecisions(updated, projectKey, projectSalt, session.token, session.userId, slug);
    api.patchStats(session.token, slug, { undos: 1 }).catch(() => {});
  }

  async function saveFulltextNotes(notes: FulltextNotes) {
    if (!session || !projectKey || !projectSalt || !fulltextPaper) return;
    const slug = session.reviewSlug || reviewSlug;
    const payload = await encryptWithKey(notes, projectKey, projectSalt);
    await api.saveFulltextNotes(session.token, slug, session.userId, fulltextPaper.id, payload);
    setFulltextNotes(notes);
  }

  if (session?.role === 'review_admin' || session?.role === 'super_admin') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-4">
        <p className="max-w-sm text-center text-slate-600">
          You are signed in as admin. Sign out before using the reviewer view, or use incognito.
        </p>
        <button onClick={logout} className="rounded-xl bg-brand-600 px-4 py-2 text-white">
          Sign out
        </button>
      </div>
    );
  }

  if (!session || session.role !== 'reviewer') {
    return (
      <LoginForm
        title="Title & Abstract Screening"
        subtitle={reviewMeta?.name || `Review: ${reviewSlug}`}
        role="reviewer"
        onSubmit={handleLogin}
      />
    );
  }

  if (fulltextPaper && session) {
    return (
      <FullTextScreen
        paper={fulltextPaper}
        reviewSlug={session.reviewSlug || reviewSlug}
        token={session.token}
        reviewerId={session.userId}
        notes={fulltextNotes}
        onSaveNotes={saveFulltextNotes}
        onBack={() => setFulltextPaper(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <PageSkeleton />
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

  if (showSummary) {
    return <SummaryView papers={papers} decisions={decisions} onClose={() => setShowSummary(false)} />;
  }

  const queue = buildQueue(papers, decisions);
  const stats = computeStats(papers, decisions);
  const current = queue[queueIndex] ?? null;
  const done = queue.length === 0;
  const titleOnly = reviewMeta?.stageConfig?.stage1Mode === 'title_only';

  const excludeMaybeCount = papers.filter((p) => {
    const d = decisions.get(p.id);
    return d && (d.decision === 'exclude' || d.decision === 'maybe');
  }).length;

  const needsBucketReview = done && !bucketReviewDone && excludeMaybeCount > 0;

  function completeBucketReview(updated: Map<string, DecisionRecord>) {
    if (!session || !projectKey || !projectSalt) return;
    const slug = session.reviewSlug || reviewSlug;
    setDecisions(updated);
    persistDecisions(updated, projectKey, projectSalt, session.token, session.userId, slug);
    setBucketReviewDone(true);
  }

  if (needsBucketReview) {
    return (
      <BucketReviewStage
        papers={papers}
        decisions={decisions}
        buckets={bucketLabels}
        onComplete={completeBucketReview}
      />
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-screen flex-col overflow-hidden overscroll-none bg-gradient-to-b from-slate-100 to-slate-200">
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
        <div className="flex gap-2">
          <button onClick={() => setShowSummary(true)} className="text-xs text-brand-600">
            Summary
          </button>
          <button onClick={logout} className="text-sm text-slate-500">
            Sign out
          </button>
        </div>
      </header>

      {showHints && !done && (
        <div className="mx-4 mb-2 rounded-xl bg-white/80 px-4 py-2 text-center text-xs text-slate-500">
          → Include · ← Exclude · ↓ Maybe · ↑ Skip · Far ← drop in left zones
        </div>
      )}

      <RubricPanel rubric={rubric} variant="reviewer" />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-2">
        {done ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 text-5xl" aria-hidden>
              ✓
            </div>
            <h2 className="font-display text-2xl font-semibold text-slate-800">All done!</h2>
            <p className="mt-2 text-slate-500">You&apos;ve screened and tagged all papers.</p>
            <button
              onClick={() => setShowSummary(true)}
              className="mt-4 rounded-xl bg-brand-600 px-4 py-2 text-sm text-white"
            >
              View summary
            </button>
          </div>
        ) : current ? (
          <SwipeCard
            key={current.id}
            paper={current}
            onDecision={handleDecision}
            index={stats.total - stats.pending}
            total={stats.total}
            titleOnly={titleOnly}
            bucketLabels={bucketLabels}
          />
        ) : null}
      </main>

      <footer className="flex items-center justify-between border-t border-slate-200 bg-white/80 px-4 py-3">
        <button
          onClick={handleUndo}
          disabled={history.length === 0}
          className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          aria-label="Undo last decision"
        >
          Undo last
        </button>
        {reviewMeta?.stageConfig?.stage2Enabled && current && (
          <button
            onClick={() => {
              setFulltextPaper(current);
              setFulltextNotes(EMPTY_NOTES);
            }}
            className="text-xs text-brand-600"
          >
            Full text
          </button>
        )}
        <Link to="/" className="text-xs text-slate-400">
          {session.username}
        </Link>
      </footer>
    </div>
  );
}
