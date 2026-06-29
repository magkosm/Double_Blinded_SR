# Human QA checklist (all releases)

Master checklist — use version-specific files for scoped tests.

## Environment setup

- [ ] Fresh browser profile (or incognito)
- [ ] Local OR staging Worker + Pages deployed
- [ ] Test credentials prepared (super-admin, review-admin, 2 reviewers)
- [ ] Sample RIS files ready (small + large; duplicate DOI pair for multi-RIS)

## Authentication and roles

- [ ] Super-admin can log in at `/admin`
- [ ] Super-admin can create a review with slug + project password
- [ ] Review-admin scoped to one review only; cannot access another review's data
- [ ] Reviewer login at `/r/:slug` works; wrong slug/password rejected
- [ ] JWT expires gracefully (8h) with clear re-login prompt
- [ ] Admin session blocks reviewer route with sign-out message

## Screening (reviewer)

- [ ] Paper card shows journal and year always
- [ ] Title-only mode hides abstract; title+abstract shows abstract
- [ ] Swipe gestures work on mobile (or DevTools mobile emulation)
- [ ] Arrow keys work on desktop
- [ ] Include / exclude / maybe / skip persist after refresh
- [ ] Undo reverses last decision
- [ ] Rubric panel visible and readable
- [ ] Progress counter updates correctly

## Admin workflows

- [ ] Project password required after admin login
- [ ] First RIS import loads papers; reviewer sees queue
- [ ] Second RIS import appends; duplicates reported; prior decisions preserved
- [ ] Import report numbers match expectation
- [ ] Create reviewer → modal shows credentials → copy works
- [ ] Delete reviewer removes access
- [ ] Rubric save/load round-trip
- [ ] CSV export decrypts and opens in Excel/Numbers

## Stage 2 / PDF (v0.8+)

- [ ] PDF bundle upload maps L1 paths correctly
- [ ] Stage gate: only include/maybe papers in stage 2 queue
- [ ] PDF renders in browser (Chrome + Safari)
- [ ] Comment saves and reloads
- [ ] Named annotation visible after reload
- [ ] Custom table fields save per paper

## Dashboards (v0.8.1+)

- [ ] Triage counts match manual count on test set
- [ ] Per-reviewer progress accurate
- [ ] Conflict row appears when 2 reviewers disagree
- [ ] Funnel counts consistent (stage 1 → stage 2)

## Buckets and stats (v0.9+)

- [ ] Default buckets present; admin can add/edit
- [ ] Exclude/maybe prompts bucket selection
- [ ] Summary view groups correctly
- [ ] Admin cannot see reviewer bucket choices pre-export (blinding)

## Security and edge cases

- [ ] Network tab: no plaintext titles/decisions in API payloads
- [ ] Wrong project password shows error, no partial decrypt
- [ ] Rate limit triggers after repeated failed logins (20/min)
- [ ] CSP allows Worker API on deployed Pages URL
- [ ] Offline / failed save shows user-visible error (v1.0 toasts)

## Documentation

- [ ] Every new feature has a `docs/` page
- [ ] Screenshots in `docs/images/vX.Y/` match current UI
- [ ] README links to docs index

## Sign-off

| Role | Name | Date | Version |
|------|------|------|---------|
| Developer | | | |
| Product owner | | | |
