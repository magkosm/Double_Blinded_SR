# Changelog

All notable changes to this project are documented here.

## [0.5.0] — 2026-06-25

First usable release: single-review title/abstract screening.

### Added

- Mobile-first swipe UI (include / exclude / maybe / skip) with keyboard fallback
- Client-side AES-GCM encryption for papers and reviewer decisions
- Cloudflare Worker API: bcrypt auth, JWT, KV storage, CORS, rate limits
- Admin panel: RIS upload, reviewer CRUD with one-time password modal, rubric editor, progress counts, CSV export
- Bootstrap and RIS upload scripts for 786-record Scopus export
- GitHub Pages deploy via `gh-pages` branch; Worker deploy from local machine
- Proprietary LICENSE with no-warranty and unreviewed-reproduction disclaimer
- ROADMAP.md for v0.6+ planning

### Fixed

- CSP `connect-src` for nested Cloudflare Workers subdomain
- Reviewer key wrapping (extractable project key, correct papers salt)
- Swipe card layout (visible title/abstract content)
- Admin session conflict on reviewer route

### Security

- Credentials and API tokens in `.secrets.local` (gitignored)
- No plaintext papers or decisions on server

---

[0.5.0]: https://github.com/magkosm/Double_Blinded_SR/releases/tag/v0.5.0
