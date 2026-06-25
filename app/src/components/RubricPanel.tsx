import { useState } from 'react';
import type { ScreeningRubric } from '../types';

interface RubricPanelProps {
  rubric: ScreeningRubric;
  variant?: 'reviewer' | 'admin';
}

function hasContent(rubric: ScreeningRubric): boolean {
  return Boolean(
    rubric.reviewQuestion.trim() ||
      rubric.inclusionCriteria.trim() ||
      rubric.exclusionCriteria.trim() ||
      rubric.generalNotes.trim(),
  );
}

export function RubricPanel({ rubric, variant = 'reviewer' }: RubricPanelProps) {
  const [open, setOpen] = useState(variant === 'admin');

  if (!hasContent(rubric) && variant === 'reviewer') return null;

  const fields = [
    { label: 'Review question', value: rubric.reviewQuestion, highlight: true },
    { label: 'Inclusion criteria', value: rubric.inclusionCriteria },
    { label: 'Exclusion criteria', value: rubric.exclusionCriteria },
    { label: 'General notes', value: rubric.generalNotes },
  ].filter((f) => f.value.trim());

  if (fields.length === 0 && variant === 'reviewer') return null;

  return (
    <div className={variant === 'reviewer' ? 'mx-4 mb-2' : ''}>
      {variant === 'reviewer' && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-xl bg-white/90 px-4 py-2.5 text-left shadow-sm ring-1 ring-slate-200/80"
        >
          <span className="text-sm font-medium text-brand-700">Screening rubric</span>
          <span className="text-xs text-slate-400">{open ? 'Hide' : 'Show'}</span>
        </button>
      )}

      {(open || variant === 'admin') && (
        <div
          className={
            variant === 'reviewer'
              ? 'mt-2 max-h-48 overflow-y-auto rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80'
              : 'space-y-4'
          }
        >
          {fields.length === 0 ? (
            <p className="text-sm text-slate-400">No rubric content yet.</p>
          ) : (
            fields.map(({ label, value, highlight }) => (
              <div key={label}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p
                  className={`mt-1 whitespace-pre-wrap text-sm leading-relaxed ${
                    highlight ? 'font-medium text-slate-900' : 'text-slate-700'
                  }`}
                >
                  {value}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface RubricEditorProps {
  rubric: ScreeningRubric;
  onChange: (rubric: ScreeningRubric) => void;
  onSave: () => void;
  saving: boolean;
}

export function RubricEditor({ rubric, onChange, onSave, saving }: RubricEditorProps) {
  const fields: { key: keyof ScreeningRubric; label: string; placeholder: string; rows: number }[] = [
    {
      key: 'reviewQuestion',
      label: 'Review question',
      placeholder: 'e.g. What methods are used to evaluate energy performance in buildings?',
      rows: 2,
    },
    {
      key: 'inclusionCriteria',
      label: 'Inclusion criteria',
      placeholder: 'Studies that meet…',
      rows: 4,
    },
    {
      key: 'exclusionCriteria',
      label: 'Exclusion criteria',
      placeholder: 'Exclude if…',
      rows: 4,
    },
    {
      key: 'generalNotes',
      label: 'General notes',
      placeholder: 'Reminders for reviewers, PICO elements, etc.',
      rows: 4,
    },
  ];

  return (
    <div className="space-y-4">
      {fields.map(({ key, label, placeholder, rows }) => (
        <div key={key}>
          <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
          <textarea
            value={rubric[key] as string}
            onChange={(e) => onChange({ ...rubric, [key]: e.target.value })}
            placeholder={placeholder}
            rows={rows}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none ring-brand-500 focus:ring-2"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save rubric'}
      </button>
    </div>
  );
}
