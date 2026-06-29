# Changelog

## [1.0.0] — 2026-06-25

Full roadmap implementation: multi-review tenancy, multi-RIS, stages, dashboards, buckets, UI polish.

### Added

- **Multi-review tenancy (v0.7):** super-admin, review-admin, scoped reviewer routes (`/admin`, `/admin/:slug`, `/r/:slug`)
- **Multi-RIS import:** append, dedupe (DOI / title+year), batch provenance, import reports
- **Stage modes:** title-only vs title+abstract; stage 2 full-text UI scaffold with PDF viewer, comments, annotations
- **Progress dashboard:** triage stats, per-reviewer table, RIS batches, conflict detection
- **Exclusion buckets:** configurable labels, post-decision picker, reviewer summary view
- **Usage stats:** privacy-preserving aggregate counters on server
- **Documentation:** `docs/` with how-tos, human QA checklists, screenshot capture script
- **QA:** Vitest (app + worker), Playwright E2E smoke, `npm run qa` / `npm run qa:full`
- Toast notifications, skeleton loaders, dark mode toggle, accessibility label fixes

### Changed

- Worker refactored into modules; review-scoped KV keys with legacy route compatibility
- Bootstrap creates super-admin; migration script for v0.5 → `review:default:*`

---

## [0.5.0] — 2026-06-25

First usable release: single-review title/abstract screening.

[1.0.0]: https://github.com/magkosm/Double_Blinded_SR/releases/tag/v1.0.0
[0.5.0]: https://github.com/magkosm/Double_Blinded_SR/releases/tag/v0.5.0
