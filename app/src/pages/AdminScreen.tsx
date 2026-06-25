import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoginForm } from '../components/LoginForm';
import { RubricEditor, RubricPanel } from '../components/RubricPanel';
import * as api from '../lib/api-client';
import { decryptJson, decryptWithKey, encryptJson, encryptWithKey, generatePassword, wrapProjectKey, deriveProjectKey } from '../lib/crypto';
import { parseRis } from '../lib/ris-parser';
import { computeStats, decisionsToMap, exportCsv } from '../lib/screening';
import type { DecisionRecord, ProgressStats, ScreeningRecord, ScreeningRubric } from '../types';
import { EMPTY_RUBRIC } from '../types';

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
        <button
          type="submit"
          className="mt-4 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Continue
        </button>
      </form>
    </div>
  );
}

type ReviewerRow = {
  id: string;
  username: string;
  createdAt: string;
  stats: ProgressStats;
};

export function AdminScreen() {
  const { session, setSession, projectPassword, setProjectPassword, logout } = useAuth();
  const [papers, setPapers] = useState<ScreeningRecord[]>([]);
  const [reviewers, setReviewers] = useState<ReviewerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [createdCreds, setCreatedCreds] = useState<{ username: string; password: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [projectKey, setProjectKey] = useState<CryptoKey | null>(null);
  const [rubric, setRubric] = useState<ScreeningRubric>(EMPTY_RUBRIC);
  const [savingRubric, setSavingRubric] = useState(false);
  const [creatingReviewer, setCreatingReviewer] = useState(false);

  const loadReviewersWithStats = useCallback(
    async (token: string, key: CryptoKey, paperList: ScreeningRecord[]) => {
      const reviewerList = await api.listReviewers(token);
      const rows: ReviewerRow[] = [];

      for (const r of reviewerList) {
        let stats = computeStats(paperList, new Map());
        try {
          const payload = await api.fetchDecisions(r.id, token);
          if (payload) {
            const decisions = await decryptWithKey<DecisionRecord[]>(
              payload as { ciphertext: string; iv: string; salt: string },
              key,
            );
            stats = computeStats(paperList, decisionsToMap(decisions));
          }
        } catch {
          /* no decisions */
        }
        rows.push({ ...r, stats });
      }
      setReviewers(rows);
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (!session || session.role !== 'admin' || !projectPassword) return;
    setLoading(true);
    setMessage('');
    try {
      const [papersPayload, rubricPayload] = await Promise.all([
        api.fetchPapers(session.token).catch(() => null),
        api.fetchRubric(session.token).catch(() => null),
      ]);

      let key: CryptoKey | null = null;

      if (papersPayload) {
        const decrypted = await decryptJson<ScreeningRecord[]>(papersPayload, projectPassword);
        setPapers(decrypted);

        const salt = Uint8Array.from(atob(papersPayload.salt), (c) => c.charCodeAt(0));
        const derived = await deriveProjectKey(projectPassword, salt);
        key = derived.key;
        setProjectKey(key);
        await loadReviewersWithStats(session.token, key, decrypted);
      } else {
        setPapers([]);
        setProjectKey(null);
        const list = await api.listReviewers(session.token);
        setReviewers(list.map((r) => ({ ...r, stats: computeStats([], new Map()) })));
      }

      if (rubricPayload && key) {
        setRubric(await decryptWithKey<ScreeningRubric>(rubricPayload, key));
      } else if (rubricPayload) {
        setRubric(await decryptJson<ScreeningRubric>(rubricPayload, projectPassword));
      } else {
        setRubric(EMPTY_RUBRIC);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [session, projectPassword, loadReviewersWithStats]);

  useEffect(() => {
    if (session?.role === 'admin' && projectPassword) {
      refresh();
    }
  }, [session, projectPassword, refresh]);

  async function handleLogin(username: string, password: string) {
    const auth = await api.login(username, password, 'admin');
    setSession(auth);
  }

  async function handleRisUpload(file: File) {
    if (!session || !projectPassword) {
      setMessage('Enter project password first');
      return;
    }
    setUploading(true);
    setMessage('');
    try {
      const text = await file.text();
      const records = parseRis(text);
      if (records.length === 0) throw new Error('No records found in RIS file');
      const payload = await encryptJson(records, projectPassword);
      await api.uploadPapers(payload, session.token);
      setPapers(records);
      setMessage(`Uploaded ${records.length} papers (encrypted)`);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleCreateReviewer(e?: React.FormEvent) {
    e?.preventDefault();
    if (!session || !projectPassword || !newUsername.trim() || creatingReviewer) return;
    setMessage('Creating reviewer… (key wrapping may take a few seconds)');
    setCreatingReviewer(true);
    const password = generatePassword();
    const username = newUsername.trim();
    try {
      const papersPayload = await api.fetchPapers(session.token).catch(() => null);
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
      );
      setCreatedCreds({ username, password });
      setNewUsername('');
      setMessage(`Reviewer "${username}" created successfully`);
      await refresh();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Failed to create reviewer';
      setMessage(`Failed to create reviewer: ${detail}`);
      console.error('Create reviewer failed', err);
    } finally {
      setCreatingReviewer(false);
    }
  }

  async function handleSaveRubric() {
    if (!session || !projectPassword) return;
    setSavingRubric(true);
    setMessage('');
    try {
      const papersPayload = await api.fetchPapers(session.token).catch(() => null);
      const rubricData = { ...rubric, updatedAt: new Date().toISOString() };
      let payload;
      if (papersPayload) {
        const salt = Uint8Array.from(atob(papersPayload.salt), (c) => c.charCodeAt(0));
        const { key } = await deriveProjectKey(projectPassword, salt);
        payload = await encryptWithKey(rubricData, key, salt);
      } else {
        payload = await encryptJson(rubricData, projectPassword);
      }
      await api.uploadRubric(payload, session.token);
      setMessage('Rubric saved (encrypted)');
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save rubric');
    } finally {
      setSavingRubric(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!session || !confirm('Revoke this reviewer? Their encrypted decisions will be deleted.')) return;
    await api.deleteReviewer(id, session.token);
    setMessage('Reviewer revoked');
    await refresh();
  }

  async function handleExport() {
    if (!session || !projectKey || papers.length === 0) return;
    setLoading(true);
    try {
      const reviewerList = await api.listReviewers(session.token);
      const reviewerDecisions = new Map<string, Map<string, DecisionRecord>>();
      const reviewerNames = new Map<string, string>();

      for (const r of reviewerList) {
        reviewerNames.set(r.id, r.username);
        const map = new Map<string, DecisionRecord>();
        try {
          const payload = await api.fetchDecisions(r.id, session.token);
          if (payload) {
            const decisions = await decryptWithKey<DecisionRecord[]>(
              payload as { ciphertext: string; iv: string; salt: string },
              projectKey,
            );
            for (const d of decisions) map.set(d.paperId, d);
          }
        } catch {
          /* no decisions */
        }
        reviewerDecisions.set(r.id, map);
      }

      const csv = exportCsv(papers, reviewerDecisions, reviewerNames);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `screening-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('Exported CSV with all reviewer decisions');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  }

  if (!session || session.role !== 'admin') {
    return (
      <LoginForm
        title="Admin Panel"
        subtitle="Manage screening library and reviewer access"
        role="admin"
        onSubmit={handleLogin}
        extraFields={
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Project password</label>
            <input
              type="password"
              onChange={(e) => setProjectPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none ring-brand-500 focus:ring-2"
              placeholder="Encrypts paper library"
              required
            />
            <p className="mt-1 text-xs text-slate-400">Required to upload/decrypt papers. Never sent to server.</p>
          </div>
        }
      />
    );
  }

  if (!projectPassword) {
    return (
      <ProjectPasswordPrompt onSubmit={setProjectPassword} />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-semibold text-slate-900">Admin Dashboard</h1>
            <p className="text-sm text-slate-500">{session.username}</p>
          </div>
          <div className="flex gap-3">
            <Link to="/" className="text-sm text-brand-600 hover:underline">
              Reviewer view
            </Link>
            <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-800">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-4">
        {message && (
          <div className={`rounded-xl px-4 py-3 text-sm ${message.toLowerCase().includes('fail') || message.toLowerCase().includes('cannot') || message.toLowerCase().includes('invalid') ? 'bg-rose-50 text-rose-800' : 'bg-brand-50 text-brand-800'}`}>
            {message}
          </div>
        )}

        {loading && (
          <div className="text-center text-sm text-slate-500">Loading dashboard…</div>
        )}

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-800">Paper library</h2>
          <p className="mt-1 text-sm text-slate-500">
            {papers.length > 0 ? `${papers.length} papers loaded` : 'No papers uploaded yet'}
          </p>
          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 px-6 py-10 transition hover:border-brand-400 hover:bg-brand-50/50">
            <span className="text-sm font-medium text-slate-600">
              {uploading ? 'Uploading…' : 'Drop Scopus .ris file or click to upload'}
            </span>
            <input
              type="file"
              accept=".ris,.txt"
              className="hidden"
              disabled={uploading}
              onChange={(e) => e.target.files?.[0] && handleRisUpload(e.target.files[0])}
            />
          </label>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-800">Screening rubric</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review question, criteria, and notes shown to reviewers while screening
          </p>
          <div className="mt-4">
            <RubricEditor
              rubric={rubric}
              onChange={setRubric}
              onSave={handleSaveRubric}
              saving={savingRubric}
            />
          </div>
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Preview</p>
            <RubricPanel rubric={rubric} variant="admin" />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-800">Reviewers</h2>
          <form onSubmit={handleCreateReviewer} className="mt-4 flex gap-2">
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Username"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2"
              disabled={creatingReviewer}
            />
            <button
              type="submit"
              disabled={!newUsername.trim() || creatingReviewer}
              className="rounded-xl bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {creatingReviewer ? 'Creating…' : 'Create'}
            </button>
          </form>

          {createdCreds && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">Save these credentials — shown once</p>
              <p className="mt-2 font-mono text-sm">
                User: {createdCreds.username}
                <br />
                Pass: {createdCreds.password}
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Username: ${createdCreds.username}\nPassword: ${createdCreds.password}`,
                  );
                }}
                className="mt-2 text-sm text-brand-600 hover:underline"
              >
                Copy to clipboard
              </button>
              <button
                onClick={() => setCreatedCreds(null)}
                className="ml-4 text-sm text-slate-500 hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500">
                  <th className="py-2 pr-4">Username</th>
                  <th className="py-2 pr-4">Progress</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviewers.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="py-3 pr-4 font-medium">{r.username}</td>
                    <td className="py-3 pr-4 text-slate-600">
                      {r.stats.total > 0
                        ? `${r.stats.total - r.stats.pending}/${r.stats.total} (${r.stats.include}↑ ${r.stats.exclude}↓ ${r.stats.maybe}?)`
                        : '—'}
                    </td>
                    <td className="py-3 pr-4 text-slate-500">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <button onClick={() => handleRevoke(r.id)} className="text-rose-600 hover:underline">
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
                {reviewers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-slate-400">
                      No reviewers yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-800">Export</h2>
          <p className="mt-1 text-sm text-slate-500">Download merged CSV with all reviewer decisions</p>
          <button
            onClick={handleExport}
            disabled={papers.length === 0 || loading}
            className="mt-4 rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {loading ? 'Exporting…' : 'Export CSV'}
          </button>
        </section>
      </main>
    </div>
  );
}
