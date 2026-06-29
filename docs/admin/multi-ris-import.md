# Multi-RIS import

## Purpose

Append multiple reference exports to the same review without losing reviewer progress.

## Steps

1. Sign in as review admin at `/admin/your-slug`
2. Optionally enter a **batch label** (e.g. `PubMed Dec 2025`)
3. Upload a `.ris` file — records are **merged**, not replaced

## Import report

After upload, the admin panel shows:

- **Added** — new unique records
- **Duplicates** — skipped (matched by DOI or title+year)
- **Failed** — unparseable rows

## Dedupe rules

1. Normalized DOI match
2. Else normalized title + year

## Batch list

The progress dashboard lists all imported batches with counts.

## Remove a batch

Not available if any paper in the batch has reviewer decisions (future: admin purge with confirmation).
