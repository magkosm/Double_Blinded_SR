# Double-Blind Title/Abstract Screening

Mobile-first web app for systematic review title/abstract screening with encrypted storage and per-reviewer blinded decisions.

- **Live app:** https://magkosm.github.io/Double_Blinded_SR/
- **Reviewer login:** `/`
- **Admin panel:** `/admin`

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
# Set VITE_API_URL in app/.env.local for dev:
echo 'VITE_API_URL=https://double-blinded-sr-api.mixalhs1995.workers.dev' > app/.env.local

npm run dev          # frontend at http://localhost:5173
npm run dev:worker   # worker at http://localhost:8787
npm run test         # RIS parser tests
```

## Deployment

### GitHub secrets (repo Settings → Secrets)

| Secret | Value |
|--------|-------|
| `VITE_API_URL` | Worker URL |
| `CLOUDFLARE_API_TOKEN` | CF API token |
| `CLOUDFLARE_ACCOUNT_ID` | `ec566f2d5d1cd4910b024bef3519ccf0` |

### Cloudflare Worker

```bash
npm run deploy:worker
npm run bootstrap      # once, registers admin from .secrets.local
npm run upload-ris     # encrypt & upload Scopus .ris file
```

### GitHub Pages

Push to `main` — `.github/workflows/deploy.yml` builds and deploys automatically.

Enable Pages: **Settings → Pages → Source: GitHub Actions**.

## Admin workflow

1. Sign in at `/admin` with admin credentials + project password.
2. Upload `.ris` export (or run `npm run upload-ris` locally).
3. Create reviewers — **save the one-time password** shown.
4. Monitor progress and export CSV when ready.

## Security

- `.secrets.local` is gitignored — never commit credentials.
- Papers and decisions are encrypted before leaving the browser.
- Worker stores ciphertext and bcrypt hashes only.
- Rotate Cloudflare API token if exposed.

## No recovery

Lost admin or reviewer passwords cannot be recovered. Revoke and recreate reviewer accounts from admin.
