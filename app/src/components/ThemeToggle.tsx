import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('sr_theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    const saved = localStorage.getItem('sr_theme');
    if (saved === 'dark') setDark(true);
  }, []);

  return (
    <button
      type="button"
      onClick={() => setDark((d) => !d)}
      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? 'Light' : 'Dark'}
    </button>
  );
}
