# Double-Blind Title/Abstract Screening

**v1.0** — Multi-review systematic review screening platform.

- **Live app:** https://magkosm.github.io/Double_Blinded_SR/
- **Reviewer login:** `/`
- **Admin panel:** `/admin`
- **Roadmap:** [ROADMAP.md](./ROADMAP.md)
- **Documentation:** [docs/README.md](./docs/README.md)
- **Checkpoint (paused 2026-06-25):** [CHECKPOINT.md](./CHECKPOINT.md)
- **License:** Proprietary — see [LICENSE](./LICENSE)

## Stack

- React + Vite + Tailwind (GitHub Pages)
- Cloudflare Worker + KV (encrypted blobs, bcrypt auth)
- Web Crypto API (client-side AES-256-GCM)

## Swipe controls

| Gesture | Decision |
|---------|----------|
| Right | Include (Yes) |
| Left | Exclude (No) |
| Down | Maybe |
| Up | Skip for now |

Arrow keys work on desktop. Authors are hidden from reviewers.

## Local development

```bash
npm install
cp .secrets.local.example .secrets.local   # or use existing .secrets.local
echo 'VITE_API_URL=https://double-blinded-sr-api.mixalhs1995.workers.dev' > app/.env.local

npm run dev          # frontend at http://localhost:5173/Double_Blinded_SR/
npm run dev:worker   # worker at http://localhost:8787
npm run test         # RIS parser tests
```

## Deployment (local only — no GitHub Actions)

### GitHub Pages

1. In repo **Settings → Pages**, set source to branch **`gh-pages`** / **`/` (root)**.
2. Ensure `.secrets.local` has `VITE_API_URL` (or `WORKER_URL`).
3. From your machine:

```bash
npm run deploy:pages
```

This builds the app, copies `404.html` for SPA routing, and pushes to the `gh-pages` branch.

**Live URL:** https://magkosm.github.io/Double_Blinded_SR/

### Cloudflare Worker

Deploy from your machine (credentials in `.secrets.local`):

```bash
export CLOUDFLARE_API_TOKEN=$(grep '^CLOUDFLARE_API_TOKEN=' .secrets.local | cut -d= -f2-)
export CLOUDFLARE_ACCOUNT_ID=$(grep '^CLOUDFLARE_ACCOUNT_ID=' .secrets.local | cut -d= -f2-)
npm run deploy:worker
npm run bootstrap      # once, registers admin
npm run upload-ris     # encrypt & upload Scopus .ris file
```

## Admin workflow

1. Sign in at `/admin` with admin credentials + project password.
2. Upload `.ris` export (or run `npm run upload-ris` locally).
3. Create reviewers — **save the one-time password** shown.
4. Monitor progress and export CSV when ready.

## Security

- `.secrets.local` and `credentials.local` are gitignored — never commit credentials.
- Run `npm run sync-credentials` to refresh the human-readable password file from `.secrets.local`.
- Setup guide: [docs/deployment/credentials-and-setup.md](docs/deployment/credentials-and-setup.md)
- Papers and decisions are encrypted before leaving the browser.
- Worker stores ciphertext and bcrypt hashes only.
- Rotate Cloudflare API token if exposed.

## No recovery

Lost admin or reviewer passwords cannot be recovered. Revoke and recreate reviewer accounts from admin.

## License

Copyright (c) 2026 magkosm. All rights reserved. This is **proprietary, private software** — not open source. See [LICENSE](./LICENSE).

The Software is provided as-is, without warranty, and has **not been independently reviewed or reproduced** for validation of systematic review methodology.

## What's next

Planned features (multi-stage screening, PDF review, multi-review tenancy, progress dashboards, exclusion buckets, UI polish) are tracked in [ROADMAP.md](./ROADMAP.md). Release history: [CHANGELOG.md](./CHANGELOG.md).
