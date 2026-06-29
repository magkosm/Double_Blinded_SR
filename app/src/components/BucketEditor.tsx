import { useState } from 'react';
import type { BucketConfig } from '../types';
import { DEFAULT_BUCKETS } from '../types';

type Props = {
  buckets: BucketConfig;
  onChange: (config: BucketConfig) => void;
  onSave: () => void;
  saving?: boolean;
};

export function BucketEditor({ buckets, onChange, onSave, saving }: Props) {
  const [draft, setDraft] = useState('');

  function addLabel() {
    const label = draft.trim();
    if (!label || buckets.labels.includes(label)) return;
    onChange({ labels: [...buckets.labels, label] });
    setDraft('');
  }

  function removeLabel(label: string) {
    onChange({ labels: buckets.labels.filter((l) => l !== label) });
  }

  function resetDefaults() {
    onChange({ labels: [...DEFAULT_BUCKETS] });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {buckets.labels.map((label) => (
          <span
            key={label}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm text-slate-800"
          >
            {label}
            <button
              type="button"
              onClick={() => removeLabel(label)}
              className="rounded-full px-2 py-0.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600"
              aria-label={`Remove ${label}`}
            >
              ×
            </button>
          </span>
        ))}
        {buckets.labels.length === 0 && (
          <p className="text-sm text-slate-400">No buckets yet — add one below.</p>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLabel())}
          placeholder="New bucket name…"
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm"
        />
        <button
          type="button"
          onClick={addLabel}
          disabled={!draft.trim()}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save buckets'}
        </button>
        <button type="button" onClick={resetDefaults} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          Reset defaults
        </button>
      </div>
    </div>
  );
}
