import { useEffect, useState } from 'react';
import type { FulltextNotes, ScreeningRecord } from '../types';
import { pdfUrl } from '../lib/api-client';

type Props = {
  paper: ScreeningRecord;
  reviewSlug: string;
  token: string;
  reviewerId: string;
  notes: FulltextNotes;
  onSaveNotes: (notes: FulltextNotes) => void;
  onBack: () => void;
};

export function FullTextScreen({ paper, reviewSlug, token, notes, onSaveNotes, onBack }: Props) {
  const [comment, setComment] = useState('');
  const [localNotes, setLocalNotes] = useState(notes);
  const [annotationLabel, setAnnotationLabel] = useState('highlight');

  useEffect(() => setLocalNotes(notes), [notes]);

  const pdfSrc = `${pdfUrl(reviewSlug, paper.id)}?token=${encodeURIComponent(token)}`;

  function addComment() {
    if (!comment.trim()) return;
    const updated = {
      ...localNotes,
      comments: [
        ...localNotes.comments,
        { id: crypto.randomUUID(), text: comment, page: 1, createdAt: new Date().toISOString() },
      ],
    };
    setLocalNotes(updated);
    onSaveNotes(updated);
    setComment('');
  }

  function addAnnotation() {
    const updated = {
      ...localNotes,
      annotations: [
        ...localNotes.annotations,
        {
          id: crypto.randomUUID(),
          label: annotationLabel,
          page: 1,
          rects: [0, 0, 100, 20],
          createdAt: new Date().toISOString(),
        },
      ],
    };
    setLocalNotes(updated);
    onSaveNotes(updated);
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-100">
      <header className="flex items-center justify-between border-b bg-white px-4 py-3">
        <button onClick={onBack} className="text-sm text-brand-600">
          ← Back
        </button>
        <p className="max-w-[60%] truncate text-sm font-medium">{paper.title}</p>
      </header>
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="flex-1 overflow-hidden bg-slate-800">
          <iframe title="PDF viewer" src={pdfSrc} className="h-full w-full min-h-[50vh]" />
        </div>
        <aside className="w-full border-t border-slate-200 bg-white p-4 lg:w-80 lg:border-t-0 lg:border-l">
          <h3 className="text-sm font-semibold">Comments</h3>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-200 p-2 text-sm"
            rows={3}
            placeholder="Add a comment…"
          />
          <button onClick={addComment} className="mt-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white">
            Add comment
          </button>
          <h3 className="mt-4 text-sm font-semibold">Named annotations</h3>
          <input
            value={annotationLabel}
            onChange={(e) => setAnnotationLabel(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            placeholder="Label"
          />
          <button onClick={addAnnotation} className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
            Add annotation
          </button>
          <ul className="mt-4 max-h-40 space-y-1 overflow-y-auto text-xs">
            {localNotes.comments.map((c) => (
              <li key={c.id} className="rounded bg-slate-50 p-2">
                {c.text}
              </li>
            ))}
            {localNotes.annotations.map((a) => (
              <li key={a.id} className="rounded bg-amber-50 p-2">
                [{a.label}] page {a.page}
              </li>
            ))}
          </ul>
          <h3 className="mt-4 text-sm font-semibold">General notes</h3>
          <textarea
            value={localNotes.generalNotes}
            onChange={(e) => {
              const updated = { ...localNotes, generalNotes: e.target.value };
              setLocalNotes(updated);
              onSaveNotes(updated);
            }}
            className="mt-2 w-full rounded-lg border border-slate-200 p-2 text-sm"
            rows={4}
          />
        </aside>
      </div>
    </div>
  );
}
