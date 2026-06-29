import { Link } from 'react-router-dom';
import { useState } from 'react';
import { ThemeToggle } from '../components/ThemeToggle';

export function HomeScreen() {
  const [slug, setSlug] = useState('default');

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-brand-700 to-slate-900 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-card dark:bg-slate-900 dark:text-slate-100">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-2xl text-white">
            SR
          </div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Double-Blinded SR</h1>
          <p className="mt-2 text-sm text-slate-500">Systematic review title/abstract screening</p>
        </div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Review slug</label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3"
          placeholder="default"
        />
        <Link
          to={`/r/${slug || 'default'}`}
          className="mb-3 block w-full rounded-xl bg-brand-600 py-3 text-center font-semibold text-white hover:bg-brand-700"
        >
          Reviewer sign in
        </Link>
        <Link
          to={`/admin/${slug || 'default'}`}
          className="mb-3 block w-full rounded-xl border border-slate-200 py-3 text-center font-semibold text-slate-700 hover:bg-slate-50"
        >
          Review admin
        </Link>
        <Link to="/admin" className="block text-center text-sm text-slate-500 hover:text-brand-600">
          Super-admin
        </Link>
      </div>
    </div>
  );
}
