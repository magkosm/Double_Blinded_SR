import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoginForm } from '../components/LoginForm';
import { RubricEditor, RubricPanel } from '../components/RubricPanel';
import { BucketEditor } from '../components/BucketEditor';
import { CreatedCredsModal } from '../components/CreatedCredsModal';
import { ProgressDashboard } from '../components/ProgressDashboard';
import { PageSkeleton } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import * as api from '../lib/api-client';
import {
  decryptJson,
  decryptWithKey,
  encryptJson,
  encryptWithKey,
  generatePassword,
  wrapProjectKey,
  deriveProjectKey,
} from '../lib/crypto';
import { mergeRisRecords } from '../lib/dedupe';
import { parseRis } from '../lib/ris-parser';
import { downloadTextFile, exportRis, filterPapersForRisExport, type RisExportMode } from '../lib/ris-export';
import {
  adminDecryptKeys,
  decryptDecisionPayload,
} from '../lib/admin-crypto';
import { computeStats, decisionsToMap, exportCsv, aggregateDecisionStats } from '../lib/screening';
import type {
  BucketConfig,
  DecisionRecord,
  EncryptedPayload,
  ImportReport,
  ProgressStats,
  ReviewMeta,
  RisBatch,
  ScreeningRecord,
  ScreeningRubric,
} from '../types';
import { DEFAULT_BUCKETS, EMPTY_RUBRIC } from '../types';

function ProjectPasswordPrompt({ onSubmit }: { onSubmit: (password: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) {
      setError('Project password is required');
      return;
    }
    onSubmit(value);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form onSubmit={handleContinue} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card">
        <h2 className="font-display text-xl font-semibold">Project password</h2>
        <p className="mt-2 text-sm text-slate-500">
          Required to decrypt papers and save changes. Stored in this browser session only.
        </p>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Project password"
          autoFocus
        />
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <button type="submit" className="mt-4 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white">
          Continue
        </button>
      </form>
    </div>
  );
}

type ReviewerRow = { id: string; username: string; createdAt: string; stats: ProgressStats };

export function AdminScreen() {
  const { reviewSlug: paramSlug } = useParams<{ reviewSlug: string }>();
  /** Review shown in the URL — always use this for API calls, not session.reviewSlug. */
  const activeSlug = paramSlug || 'default';
  const { session, setSession, projectPassword, setProjectPassword, logout } = useAuth();
  const { toast } = useToast();

  const [papers, setPapers] = useState<ScreeningRecord[]>([]);
  const [reviewers, setReviewers] = useState<ReviewerRow[]>([]);
  const [aggregateStats, setAggregateStats] = useState<ProgressStats>({
    include: 0,
    exclude: 0,
    maybe: 0,
    skip: 0,
    pending: 0,
    total: 0,
  });
  const [batches, setBatches] = useState<RisBatch[]>([]);
  const [reviewMeta, setReviewMeta] = useState<ReviewMeta | null>(null);
  const [buckets, setBuckets] = useState<BucketConfig>({ labels: DEFAULT_BUCKETS });
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [conflicts, setConflicts] = useState<{ paperId: string; decisions: Record<string, string> }[]>([]);
  const [loading, setLoading] = useState(false);
  const [risExportMode, setRisExportMode] = useState<RisExportMode>('any');
  const [newUsername, setNewUsername] = useState('');
  const [batchLabel, setBatchLabel] = useState('');
  const [createdCreds, setCreatedCreds] = useState<{ username: string; password: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [projectKey, setProjectKey] = useState<CryptoKey | null>(null);
  const [rubric, setRubric] = useState<ScreeningRubric>(EMPTY_RUBRIC);
  const [savingRubric, setSavingRubric] = useState(false);
  const [creatingReviewer, setCreatingReviewer] = useState(false);

  const isAdmin =
    session?.role === 'review_admin' || session?.role === 'super_admin';

  const loadReviewersWithStats = useCallback(
    async (
      token: string,
      paperList: ScreeningRecord[],
      slug: string,
      papersPayload: EncryptedPayload | null,
    ) => {
      const reviewerList = await api.listReviewers(token, slug);
      const rows: ReviewerRow[] = [];
      const decisionMaps: Map<string, DecisionRecord>[] = [];
      const conflictInputs: { id: string; decisions: Record<string, string> }[] = [];

      for (const r of reviewerList) {
        let stats = computeStats(paperList, new Map());
        try {
          const payload = await api.fetchDecisions(r.id, token, slug);
          if (payload && projectPassword) {
            let wrapped = null;
            try {
              const meta = await api.fetchReviewerMeta(r.id, token, slug);
              wrapped = meta.wrappedProjectKey;
            } catch {
              /* reviewer meta optional for decrypt fallback */
            }
            const keys = await adminDecryptKeys(projectPassword, papersPayload, wrapped);
            const decisions = await decryptDecisionPayload(payload, projectPassword, keys);
            const map = decisionsToMap(decisions);
            stats = computeStats(paperList, map);
            decisionMaps.push(map);
            conflictInputs.push({
              id: r.id,
              decisions: Object.fromEntries(decisions.map((d) => [d.paperId, d.decision])),
            });
          }
        } catch (err) {
          console.warn(`Failed to decrypt decisions for ${r.username}`, err);
        }
        rows.push({ ...r, stats });
      }

      setReviewers(rows);
      setAggregateStats(aggregateDecisionStats(paperList, decisionMaps));

      if (conflictInputs.length >= 2) {
        try {
          const res = await api.postConflicts(token, { reviewers: conflictInputs });
          setConflicts(res.conflicts);
        } catch {
          setConflicts([]);
        }
      } else {
        setConflicts([]);
      }
    },
    [projectPassword],
  );

  const refresh = useCallback(async () => {
    if (!session || !isAdmin || !projectPassword) return;
    setLoading(true);
    try {
      const slug = activeSlug;
      const [papersPayload, rubricPayload, batchList, meta, bucketConfig] = await Promise.all([
        api.fetchPapers(session.token, slug).catch(() => null),
        api.fetchRubric(session.token, slug).catch(() => null),
        api.listRisBatches(session.token, slug).catch(() => []),
        api.fetchReviewMeta(session.token, slug).catch(() => null),
        api.fetchBuckets(session.token, slug).catch(() => ({ labels: DEFAULT_BUCKETS })),
      ]);

      setBatches(batchList);
      setReviewMeta(meta);
      setBuckets(bucketConfig);

      let key: CryptoKey | null = null;

      if (papersPayload) {
        const decrypted = await decryptJson<ScreeningRecord[]>(papersPayload, projectPassword);
        setPapers(decrypted);
        const salt = Uint8Array.from(atob(papersPayload.salt), (c) => c.charCodeAt(0));
        const derived = await deriveProjectKey(projectPassword, salt);
        key = derived.key;
        setProjectKey(key);
        await loadReviewersWithStats(session.token, decrypted, slug, papersPayload);
      } else {
        setPapers([]);
        setProjectKey(null);
        await loadReviewersWithStats(session.token, [], slug, null);
      }

      if (rubricPayload && key) {
        setRubric(await decryptWithKey<ScreeningRubric>(rubricPayload, key));
      } else if (rubricPayload) {
        setRubric(await decryptJson<ScreeningRubric>(rubricPayload, projectPassword));
      } else {
        setRubric(EMPTY_RUBRIC);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load admin data', 'error');
    } finally {
      setLoading(false);
    }
  }, [session, isAdmin, projectPassword, activeSlug, loadReviewersWithStats, toast]);

  useEffect(() => {
    if (isAdmin && projectPassword && session) refresh();
  }, [isAdmin, projectPassword, session, refresh]);

  async function handleLogin(username: string, password: string) {
    try {
      const auth = await api.login(username, password, 'review_admin', activeSlug);
      setSession(auth);
    } catch {
      const auth = await api.login(username, password, 'super_admin');
      setSession(auth);
    }
  }

  async function handleResetReviewerPassword(id: string, username: string) {
    if (!session || !confirm(`Reset password for reviewer "${username}"?`)) return;
    const slug = activeSlug;
    try {
      const res = await api.resetReviewerPassword(id, session.token, slug);
      setCreatedCreds({ username: res.username, password: res.password });
      toast('Reviewer password reset', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Reset failed', 'error');
    }
  }

  async function handleRisUpload(file: File) {
    if (!session || !projectPassword) {
      toast('Enter project password first', 'error');
      return;
    }
    const slug = activeSlug;
    setUploading(true);
    try {
      const text = await file.text();
      const incoming = parseRis(text);
      if (incoming.length === 0) throw new Error('No records found in RIS file');

      const batchId = crypto.randomUUID();
      const merge = mergeRisRecords(papers, incoming, batchId);
      const papersPayload = await api.fetchPapers(session.token, slug).catch(() => null);
      let payload;
      if (papersPayload) {
        const salt = Uint8Array.from(atob(papersPayload.salt), (c) => c.charCodeAt(0));
        const { key } = await deriveProjectKey(projectPassword, salt);
        payload = await encryptWithKey(merge.merged, key, salt);
      } else {
        payload = await encryptJson(merge.merged, projectPassword);
      }
      await api.uploadPapers(payload, session.token, slug);

      const newBatch: RisBatch = {
        id: batchId,
        label: batchLabel || file.name,
        filename: file.name,
        uploadedAt: new Date().toISOString(),
        recordCount: merge.added,
      };
      const updatedBatches = [...batches, newBatch];
      await api.saveRisBatches(session.token, slug, updatedBatches);

      setImportReport({
        batchId,
        added: merge.added,
        duplicates: merge.duplicates,
        failed: merge.failed,
        totalInFile: merge.totalInFile,
      });
      setBatchLabel('');
      toast(`Import: ${merge.added} added, ${merge.duplicates} duplicates`, 'success');
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleCreateReviewer(e?: React.FormEvent) {
    e?.preventDefault();
    if (!session || !projectPassword || !newUsername.trim() || creatingReviewer) return;
    const slug = activeSlug;
    setCreatingReviewer(true);
    const password = generatePassword();
    const username = newUsername.trim();
    try {
      const papersPayload = await api.fetchPapers(session.token, slug).catch(() => null);
      const projectSalt = papersPayload
        ? Uint8Array.from(atob(papersPayload.salt), (c) => c.charCodeAt(0))
        : undefined;
      const wrapped = await wrapProjectKey(projectPassword, password, projectSalt);
      await api.createReviewer(
        {
          username,
          password,
          wrappedProjectKey: {
            wrappedKey: wrapped.wrappedKey,
            iv: wrapped.iv,
            salt: wrapped.salt,
            projectSalt: wrapped.projectSalt,
          },
        },
        session.token,
        slug,
      );
      setCreatedCreds({ username, password });
      setNewUsername('');
      toast('Reviewer created', 'success');
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create reviewer', 'error');
    } finally {
      setCreatingReviewer(false);
    }
  }

  async function handleSaveRubric() {
    if (!session || !projectPassword) return;
    const slug = activeSlug;
    setSavingRubric(true);
    try {
      const papersPayload = await api.fetchPapers(session.token, slug).catch(() => null);
      const rubricData = { ...rubric, updatedAt: new Date().toISOString() };
      let payload;
      if (papersPayload) {
        const salt = Uint8Array.from(atob(papersPayload.salt), (c) => c.charCodeAt(0));
        const { key } = await deriveProjectKey(projectPassword, salt);
        payload = await encryptWithKey(rubricData, key, salt);
      } else {
        payload = await encryptJson(rubricData, projectPassword);
      }
      await api.uploadRubric(payload, session.token, slug);
      toast('Rubric saved', 'success');
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save rubric', 'error');
    } finally {
      setSavingRubric(false);
    }
  }

  async function handleStageModeChange(mode: 'title_only' | 'title_abstract') {
    if (!session || !reviewMeta) return;
    const slug = activeSlug;
    const updated = (await api.updateReviewMeta(session.token, slug, {
      stageConfig: { ...reviewMeta.stageConfig, stage1Mode: mode },
    })) as ReviewMeta;
    setReviewMeta(updated);
    toast('Stage mode updated', 'success');
  }

  async function handleSaveBuckets() {
    if (!session) return;
    const slug = activeSlug;
    await api.saveBuckets(session.token, slug, buckets);
    toast('Buckets saved', 'success');
  }

  async function handleRevoke(id: string) {
    if (!session || !confirm('Revoke this reviewer?')) return;
    const slug = activeSlug;
    await api.deleteReviewer(id, session.token, slug);
    toast('Reviewer revoked', 'success');
    await refresh();
  }

  async function loadReviewerDecisions() {
    if (!session || !projectKey) return null;
    const slug = activeSlug;
    const reviewerList = await api.listReviewers(session.token, slug);
    const reviewerDecisions = new Map<string, Map<string, DecisionRecord>>();
    const reviewerNames = new Map<string, string>();

    for (const r of reviewerList) {
      reviewerNames.set(r.id, r.username);
      const map = new Map<string, DecisionRecord>();
      const payload = await api.fetchDecisions(r.id, session.token, slug);
      if (payload) {
        const decisions = await decryptWithKey<DecisionRecord[]>(
          payload as { ciphertext: string; iv: string; salt: string },
          projectKey,
        );
        for (const d of decisions) map.set(d.paperId, d);
      }
      reviewerDecisions.set(r.id, map);
    }

    return { reviewerDecisions, reviewerNames };
  }

  async function handleExport() {
    if (!session || !projectKey || papers.length === 0) return;
    setLoading(true);
    try {
      const data = await loadReviewerDecisions();
      if (!data) return;
      const csv = exportCsv(papers, data.reviewerDecisions, data.reviewerNames);
      const slug = activeSlug;
      downloadTextFile(
        csv,
        `screening-${slug}-${new Date().toISOString().slice(0, 10)}.csv`,
        'text/csv;charset=utf-8',
      );
      toast('CSV exported', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Export failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleExportRis() {
    if (!session || !projectKey || papers.length === 0) return;
    setLoading(true);
    try {
      const data = await loadReviewerDecisions();
      if (!data) return;
      const filtered = filterPapersForRisExport(papers, data.reviewerDecisions, risExportMode);
      if (filtered.length === 0) {
        toast('No include/maybe papers to export', 'error');
        return;
      }
      const ris = exportRis(filtered);
      const slug = activeSlug;
      downloadTextFile(
        ris,
        `included-maybe-${slug}-${new Date().toISOString().slice(0, 10)}.ris`,
        'application/x-research-info-systems;charset=utf-8',
      );
      toast(`RIS exported (${filtered.length} records)`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'RIS export failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  const stage2Count = aggregateStats.include + aggregateStats.maybe;

  if (!session || !isAdmin) {
    return (
      <LoginForm
        title="Admin Panel"
        subtitle={`Review: ${activeSlug}`}
        role="review_admin"
        onSubmit={handleLogin}
      />
    );
  }

  if (!projectPassword) return <ProjectPasswordPrompt onSubmit={setProjectPassword} />;

  return (
    <div className="min-h-screen bg-slate-50">
      {createdCreds && (
        <CreatedCredsModal
          username={createdCreds.username}
          password={createdCreds.password}
          onDismiss={() => setCreatedCreds(null)}
        />
      )}
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-semibold">{reviewMeta?.name || 'Admin Dashboard'}</h1>
            <p className="text-sm text-slate-500">
              {session.username} · /{activeSlug}
            </p>
          </div>
          <div className="flex gap-3">
            <Link to={`/r/${activeSlug}`} className="text-sm text-brand-600 hover:underline">
              Reviewer view
            </Link>
            <Link to="/admin" className="text-sm text-slate-500 hover:underline">
              Super-admin
            </Link>
            <button onClick={logout} className="text-sm text-slate-500">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-4">
        {loading && <PageSkeleton />}

        {!loading && (
          <>
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="font-semibold">Progress</h2>
              <div className="mt-4">
                <ProgressDashboard
                  papers={papers}
                  reviewers={reviewers}
                  batches={batches}
                  stats={aggregateStats}
                  conflicts={conflicts}
                  stage2Count={stage2Count}
                />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="font-semibold">Stage configuration</h2>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleStageModeChange('title_abstract')}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    reviewMeta?.stageConfig.stage1Mode === 'title_abstract'
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100'
                  }`}
                >
                  Title + abstract
                </button>
                <button
                  onClick={() => handleStageModeChange('title_only')}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    reviewMeta?.stageConfig.stage1Mode === 'title_only'
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100'
                  }`}
                >
                  Title only
                </button>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="font-semibold">Exclusion buckets</h2>
              <p className="mt-1 text-sm text-slate-500">
                Reason tags for exclude/maybe — reviewers assign these after screening or via deep-left swipe
              </p>
              <div className="mt-4">
                <BucketEditor
                  buckets={buckets}
                  onChange={setBuckets}
                  onSave={handleSaveBuckets}
                />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="font-semibold">Paper library</h2>
              <p className="mt-1 text-sm text-slate-500">{papers.length} papers · {batches.length} batches</p>
              <input
                value={batchLabel}
                onChange={(e) => setBatchLabel(e.target.value)}
                placeholder="Batch label (optional)"
                className="mt-3 w-full rounded-xl border px-4 py-2 text-sm"
              />
              <label className="mt-4 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-slate-200 px-6 py-10 hover:border-brand-400">
                <span className="text-sm font-medium text-slate-600">
                  {uploading ? 'Uploading…' : 'Drop .ris file (append + dedupe)'}
                </span>
                <input
                  type="file"
                  accept=".ris,.txt"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => e.target.files?.[0] && handleRisUpload(e.target.files[0])}
                />
              </label>
              {importReport && (
                <p className="mt-2 text-sm text-brand-700">
                  Last import: {importReport.added} added, {importReport.duplicates} duplicates, {importReport.failed}{' '}
                  failed
                </p>
              )}
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="font-semibold">Screening rubric</h2>
              <div className="mt-4">
                <RubricEditor rubric={rubric} onChange={setRubric} onSave={handleSaveRubric} saving={savingRubric} />
              </div>
              <div className="mt-6 border-t pt-4">
                <RubricPanel rubric={rubric} variant="admin" />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="font-semibold">Reviewers</h2>
              <form onSubmit={handleCreateReviewer} className="mt-4 flex gap-2">
                <input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Username"
                  className="flex-1 rounded-xl border px-4 py-2"
                  disabled={creatingReviewer}
                />
                <button
                  type="submit"
                  disabled={!newUsername.trim() || creatingReviewer}
                  className="rounded-xl bg-brand-600 px-4 py-2 text-white disabled:opacity-50"
                >
                  {creatingReviewer ? 'Creating…' : 'Create'}
                </button>
              </form>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white text-slate-500">
                    <tr className="border-b">
                      <th className="py-2 pr-4">Username</th>
                      <th className="py-2 pr-4">Progress</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewers.map((r) => (
                      <tr key={r.id} className="border-b border-slate-50">
                        <td className="py-3 pr-4 font-medium">{r.username}</td>
                        <td className="py-3 pr-4 text-slate-600">
                          {r.stats.total > 0
                            ? `${r.stats.total - r.stats.pending}/${r.stats.total}`
                            : '—'}
                        </td>
                        <td className="py-3">
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleResetReviewerPassword(r.id, r.username)}
                              className="text-brand-600 hover:underline"
                            >
                              Reset pwd
                            </button>
                            <button onClick={() => handleRevoke(r.id)} className="text-rose-600 hover:underline">
                              Revoke
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="font-semibold">Export</h2>
              <p className="mt-1 text-sm text-slate-500">
                Download decisions or a RIS file of include + maybe papers for the next screening stage.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={handleExport}
                  disabled={papers.length === 0 || loading}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  Export CSV
                </button>
                <button
                  onClick={handleExportRis}
                  disabled={papers.length === 0 || loading}
                  className="rounded-xl bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  Export RIS (include + maybe)
                </button>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <span>RIS filter:</span>
                <select
                  value={risExportMode}
                  onChange={(e) => setRisExportMode(e.target.value as RisExportMode)}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                >
                  <option value="any">Any reviewer marked include/maybe</option>
                  <option value="all">All reviewers marked include/maybe</option>
                </select>
              </label>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
