import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoginForm } from '../components/LoginForm';
import { CreatedCredsModal } from '../components/CreatedCredsModal';
import { PageSkeleton } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import * as api from '../lib/api-client';
import type { ReviewMeta } from '../types';

type UserDirectory = Awaited<ReturnType<typeof api.listAllUsers>>;

export function SuperAdminScreen() {
  const { session, setSession, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<ReviewMeta[]>([]);
  const [users, setUsers] = useState<UserDirectory | null>(null);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [bootstrapSlug, setBootstrapSlug] = useState('');
  const [bootstrapUser, setBootstrapUser] = useState('');
  const [bootstrapPass, setBootstrapPass] = useState('');
  const [createdCreds, setCreatedCreds] = useState<{ username: string; password: string } | null>(null);

  const load = useCallback(async () => {
    if (!session || session.role !== 'super_admin') return;
    setLoading(true);
    try {
      const [reviewList, userList] = await Promise.all([
        api.listReviews(session.token),
        api.listAllUsers(session.token),
      ]);
      setReviews(reviewList);
      setUsers(userList);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load reviews', 'error');
    } finally {
      setLoading(false);
    }
  }, [session, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleLogin(username: string, password: string) {
    const auth = await api.login(username, password, 'super_admin');
    setSession(auth);
  }

  async function handleCreateReview(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    try {
      const review = await api.createReview({ name: newName, slug: newSlug }, session.token);
      toast(`Review "${review.name}" created`, 'success');
      setNewName('');
      setNewSlug('');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Create failed', 'error');
    }
  }

  async function handleBootstrapAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    try {
      await api.bootstrapReviewAdmin(bootstrapSlug, { username: bootstrapUser, password: bootstrapPass }, session.token);
      toast('Review admin created', 'success');
      setBootstrapUser('');
      setBootstrapPass('');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Bootstrap failed', 'error');
    }
  }

  async function handleResetAdmin(slug: string, username: string) {
    if (!session || !confirm(`Reset password for review admin "${username}" (${slug})?`)) return;
    try {
      const res = await api.resetReviewAdminPassword(slug, session.token);
      setCreatedCreds({ username: res.username, password: res.password });
      toast('Review admin password reset', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Reset failed', 'error');
    }
  }

  async function handleResetReviewer(slug: string, id: string, username: string) {
    if (!session || !confirm(`Reset password for reviewer "${username}"?`)) return;
    try {
      const res = await api.resetReviewerPassword(id, session.token, slug);
      setCreatedCreds({ username: res.username, password: res.password });
      toast('Reviewer password reset', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Reset failed', 'error');
    }
  }

  if (!session || session.role !== 'super_admin') {
    return (
      <LoginForm
        title="Super Admin"
        subtitle="Manage all systematic reviews"
        role="super_admin"
        onSubmit={handleLogin}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {createdCreds && (
        <CreatedCredsModal
          username={createdCreds.username}
          password={createdCreds.password}
          onDismiss={() => setCreatedCreds(null)}
        />
      )}
      <header className="border-b bg-white px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="font-display text-xl font-semibold">Super Admin</h1>
          <div className="flex gap-3">
            <Link to="/" className="text-sm text-brand-600 hover:underline">
              Home
            </Link>
            <button onClick={logout} className="text-sm text-slate-500">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 p-4">
        {loading ? (
          <PageSkeleton />
        ) : (
          <>
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="font-semibold">All users</h2>
              <p className="mt-1 text-sm text-slate-500">
                Super-admin: <strong>{users?.superAdmin || '—'}</strong>
              </p>
              <div className="mt-4 space-y-4">
                {(users?.reviews || []).map((review) => (
                  <div key={review.slug} className="rounded-xl border border-slate-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{review.name}</p>
                        <p className="text-xs text-slate-500">/{review.slug}</p>
                      </div>
                      <button
                        onClick={() => navigate(`/admin/${review.slug}`)}
                        className="text-sm text-brand-600 hover:underline"
                      >
                        Open admin
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                      <span className="text-slate-600">
                        Admin: <strong>{review.adminUsername || 'not set'}</strong>
                      </span>
                      {review.adminUsername && (
                        <button
                          onClick={() => handleResetAdmin(review.slug, review.adminUsername!)}
                          className="text-brand-600 hover:underline"
                        >
                          Reset admin pwd
                        </button>
                      )}
                    </div>
                    {review.reviewers.length > 0 ? (
                      <ul className="mt-3 space-y-2 text-sm">
                        {review.reviewers.map((r) => (
                          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                            <span>
                              Reviewer <strong>{r.username}</strong>
                            </span>
                            <button
                              onClick={() => handleResetReviewer(review.slug, r.id, r.username)}
                              className="text-brand-600 hover:underline"
                            >
                              Reset pwd
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">No reviewers yet</p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="font-semibold">Reviews</h2>
              <ul className="mt-4 space-y-2">
                {reviews.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                    <div>
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-slate-500">/{r.slug}</p>
                    </div>
                    <button
                      onClick={() => navigate(`/admin/${r.slug}`)}
                      className="text-sm text-brand-600 hover:underline"
                    >
                      Open admin
                    </button>
                  </li>
                ))}
                {reviews.length === 0 && <p className="text-sm text-slate-400">No reviews yet</p>}
              </ul>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="font-semibold">Create review</h2>
              <form onSubmit={handleCreateReview} className="mt-4 flex flex-wrap gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Review name"
                  className="flex-1 rounded-xl border px-4 py-2"
                  required
                />
                <input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.toLowerCase())}
                  placeholder="slug"
                  pattern="[a-z0-9][a-z0-9-]*"
                  className="w-40 rounded-xl border px-4 py-2"
                  required
                />
                <button type="submit" className="rounded-xl bg-brand-600 px-4 py-2 text-white">
                  Create
                </button>
              </form>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="font-semibold">Bootstrap review admin</h2>
              <form onSubmit={handleBootstrapAdmin} className="mt-4 space-y-2">
                <input
                  value={bootstrapSlug}
                  onChange={(e) => setBootstrapSlug(e.target.value)}
                  placeholder="Review slug"
                  className="w-full rounded-xl border px-4 py-2"
                  required
                />
                <input
                  value={bootstrapUser}
                  onChange={(e) => setBootstrapUser(e.target.value)}
                  placeholder="Admin username"
                  className="w-full rounded-xl border px-4 py-2"
                  required
                />
                <input
                  type="password"
                  value={bootstrapPass}
                  onChange={(e) => setBootstrapPass(e.target.value)}
                  placeholder="Admin password"
                  className="w-full rounded-xl border px-4 py-2"
                  required
                />
                <button type="submit" className="rounded-xl bg-slate-800 px-4 py-2 text-white">
                  Set review admin
                </button>
              </form>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
