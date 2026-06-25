# Roadmap — Double-Blinded SR

**Current release:** v0.5 — single-review, title/abstract screening (swipe UI, encrypted storage, admin panel).

This document tracks planned work toward multi-stage, multi-review systematic review tooling.

---

## v0.5 (shipped)

- [x] Title & abstract screening with swipe gestures
- [x] Client-side encryption (papers + decisions)
- [x] Admin panel: RIS upload, reviewer CRUD, rubric, CSV export
- [x] Cloudflare Worker + KV backend; GitHub Pages frontend
- [x] Mobile-first reviewer UI with resume / undo

---

## v0.6 — Multi-stage screening

Stage 1 uses a full RIS export but controls **what reviewers see** per stage. Journal and year are always visible.

### Stage 1 modes (configurable per review)

- [ ] **Title only** — show journal, year, title; hide abstract
- [ ] **Title + abstract** — current behavior; journal and year always shown
- [ ] Admin selects stage mode when creating or configuring a review
- [ ] Reviewer UI adapts card layout per mode (no abstract section in title-only mode)

### Stage 2 — Full text + structured review

Reference layout: local `SR-1/` example (gitignored) — RIS with `L1` paths to `files/{paperId}/{filename}.pdf`.

- [ ] Admin upload: RIS + PDF bundle (folder structure like `SR-1/files/{id}/…`)
- [ ] Map RIS `L1` / `L2` links to stored PDFs (HTML fallbacks optional)
- [ ] Stage gate: only papers passing stage 1 (e.g. include/maybe) enter stage 2 queue
- [ ] PDF viewer in reviewer UI (in-browser)
- [ ] **Comments** on PDFs (per reviewer, encrypted)
- [ ] **Named annotations** on PDFs (highlights, notes with labels)
- [ ] **Custom table per paper** — admin-defined columns (e.g. study design, N, outcome)
- [ ] **General notes** field per paper (reviewer + optional admin-only notes)
- [ ] Storage: extend Worker/KV or R2 for PDF blobs; metadata in KV

### Data model (sketch)

- [ ] `Review` → `Stage` (1 | 2) → `ScreeningMode` (title | title_abstract | fulltext)
- [ ] `Paper` → optional `pdfKey`, `customFields`, `stage1Decision` aggregation rules

---

## v0.7 — Multi-review tenancy

Each systematic review is an isolated project with its own admin; one **super-admin** manages all reviews.

- [ ] **Review** entity: name, slug, project password, stage config, rubric
- [ ] **Review admin** — scoped to one review (RIS upload, reviewers, progress for that review only)
- [ ] **Super-admin** — create/delete reviews, assign review admins, global usage overview
- [ ] Auth: JWT claims include `reviewId` + role (`super_admin` | `review_admin` | `reviewer`)
- [ ] KV key namespace per review (e.g. `review:{id}:papers`, `review:{id}:decisions:{userId}`)
- [ ] URL routing: `/admin` (super) vs `/admin/:reviewSlug` vs reviewer `/r/:reviewSlug`
- [ ] Bootstrap script: create super-admin + first review

---

## v0.8 — Progress panel & dashboards

Tables and charts for admins (and super-admin) to see screening health at a glance.

- [ ] **Triage counts** — pending / include / exclude / maybe / skip per stage
- [ ] **Per-reviewer progress** — completed, remaining, last active
- [ ] **Conflict preview** — papers where reviewers disagree (when ≥2 reviewers)
- [ ] **Stage funnel** — stage 1 → stage 2 pipeline counts
- [ ] **Time metrics** — median time per paper, sessions per reviewer
- [ ] Export dashboard snapshot (CSV / printable summary)
- [ ] Super-admin: cross-review comparison table

---

## v0.9 — Post-screening buckets & usage stats

After yes/no/maybe, reviewers organize decisions into **reason buckets** (custom labels).

### Exclusion / maybe buckets

- [ ] Admin defines bucket labels (multi-select allowed per paper)
- [ ] Default buckets: **Off topic**, **Wrong subject population** (editable)
- [ ] Shown after initial decision or in a dedicated **summary / review** view
- [ ] **Summary view** — grouped by decision + bucket; filter and search
- [ ] **Per-paper view** — decision, buckets, notes, link to PDF (stage 2)
- [ ] Encrypted bucket assignments per reviewer (blinded until export)

### Usage statistics (privacy-preserving)

- [ ] Aggregate counts: logins, papers screened, decisions by type, undo rate
- [ ] No plaintext titles/authors in stats blobs
- [ ] Admin dashboard widgets; optional super-admin global stats
- [ ] Retention policy / export for audit

---

## v1.0 — UI polish & UX

- [ ] Smoother swipe animations and card transitions (spring tuning, reduced jank on mobile)
- [ ] Consistent spacing, typography scale, dark-mode option
- [ ] Loading skeletons instead of spinners
- [ ] Toast notifications for save errors / offline retry
- [ ] Accessible focus states and screen-reader labels for swipe alternatives
- [ ] Admin panel: responsive tables, sticky headers, bulk reviewer actions
- [ ] Empty states and onboarding hints for first-time reviewers

---

## Infrastructure & quality (ongoing)

- [ ] E2E tests (Playwright): login → screen → export
- [ ] PDF annotation library evaluation (PDF.js + overlay vs dedicated viewer)
- [ ] R2 bucket for PDFs; size limits and virus-scan note in docs
- [ ] Rate limits and audit log for super-admin actions
- [ ] Migration path from single-tenant v0.5 KV layout to multi-review keys

---

## Reference: SR-1 bundle layout (local example)

Not committed to git. Structure for stage-2 uploads:

```
SR-1/
  SR-1.ris          # RIS records with L1  - files/{id}/{filename}.pdf
  files/
    12/
      Li et al. - ....pdf
    15/
      Hejda et al. - ....pdf
    …
```

RIS `L1` field links each record to its PDF relative path. Stage-2 importer should validate paths, dedupe by DOI/title, and report missing PDFs.

---

## How to use this roadmap

1. Pick a version milestone (e.g. v0.6 stage modes first).
2. Open a tracking issue or project board item per checkbox group.
3. Update checkboxes here when features ship.

Questions or priority changes — edit this file or discuss in repo issues.
