interface CreatedCredsModalProps {
  username: string;
  password: string;
  onDismiss: () => void;
}

export function CreatedCredsModal({ username, password, onDismiss }: CreatedCredsModalProps) {
  const text = `Username: ${username}\nPassword: ${password}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="font-display text-xl font-semibold text-slate-900">Reviewer created</h3>
        <p className="mt-2 text-sm text-amber-700">
          Save these credentials now — they will not be shown again.
        </p>
        <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Username</p>
            <p className="mt-1 break-all font-mono text-base text-slate-900">{username}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Password</p>
            <p className="mt-1 break-all font-mono text-base text-slate-900">{password}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(text)}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Copy credentials
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Done — I saved them
          </button>
        </div>
      </div>
    </div>
  );
}
