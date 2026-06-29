# Progress dashboard

## Purpose

Monitor screening health: triage counts, RIS batches, per-reviewer progress, and conflicts.

## Location

Review admin panel → **Progress** section (top of dashboard).

## Metrics

- **Pending / Include / Exclude / Maybe** — corpus-level placeholders; see per-reviewer table for real progress
- **RIS batches** — source files and record counts
- **Conflicts** — papers where two or more reviewers disagree (computed client-side from decrypted decisions)
- **Stage 2 funnel** — count of include + maybe papers eligible for full-text stage

## Super-admin

Global overview at `/admin` lists all reviews with summary progress metadata.
