# Credentials and online setup

This app uses **two local files** (both gitignored):

| File | Purpose |
|------|---------|
| [`.secrets.local`](../.secrets.local.example) | Machine-readable — deploy scripts, bootstrap, API tokens |
| [`credentials.local`](../../credentials.local.example) | Human-readable — URLs, usernames, passwords for day-to-day use |

Refresh the credentials file after changing secrets:

```bash
npm run sync-credentials
```

---

## Current deployment (legacy → v1.0)

Your Worker was bootstrapped before super-admin existed. Two options:

### Option A — Login fix (already in Worker)

Legacy `auth:admin` accepts **super-admin login** at `/admin` until KV is upgraded.

### Option B — Permanent KV upgrade (recommended once)

```bash
npm run upgrade-super-admin
```

This copies `auth:admin` → `auth:super_admin` using your `BOOTSTRAP_TOKEN`.

Then deploy Worker if you haven’t:

```bash
npm run deploy:worker
```

---

## Fresh online setup (new environment)

1. **Secrets file**

   ```bash
   cp .secrets.local.example .secrets.local
   # Fill: ADMIN_*, PROJECT_PASSWORD, CLOUDFLARE_*, WORKER_URL, etc.
   npm run sync-credentials
   ```

2. **Deploy**

   ```bash
   npm run deploy:worker
   npm run bootstrap          # creates auth:super_admin (once only)
   npm run deploy:pages
   ```

3. **Super-admin**

   - Open `{PAGES_URL}/admin`
   - Sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`

4. **First review**

   - Create review (name + slug, e.g. `ice-2026`)
   - Bootstrap review admin (or reuse super-admin credentials for small teams)
   - Open `/admin/ice-2026` → enter **project password** → upload RIS

5. **Reviewers**

   - Create accounts → save modal credentials to `credentials.local`
   - Share `{PAGES_URL}/r/ice-2026` + reviewer login only

---

## Password security

- **Never commit** `.secrets.local` or `credentials.local`
- Rotate `CLOUDFLARE_API_TOKEN` if exposed
- Reviewer passwords are shown **once** — store in `credentials.local` or a password manager
- Project password cannot be recovered — keep a backup offline

### Brute-force protection (current)

- Login rate limits: **30 attempts/min per IP**, **10/min per username**
- Generic error message: `Invalid credentials` (no username enumeration)

### Planned hardening

See [ROADMAP.md — Security hardening](../../ROADMAP.md#security-hardening-brute-force--auth).

---

## Rotating admin password

1. Generate new password locally
2. Update `.secrets.local` and run `npm run sync-credentials`
3. Use Cloudflare dashboard or a future admin script to update KV bcrypt hash
4. Until then: create a new review admin via super-admin and retire the old account

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Super-admin login fails | Run `npm run upgrade-super-admin`; or use `/admin/default` |
| Bootstrap returns 409 | Already bootstrapped — use upgrade script, not bootstrap |
| Project password wrong | Check `credentials.local`; no server-side recovery |
| Too many login attempts | Wait 1 minute; limits reset per IP/username window |
