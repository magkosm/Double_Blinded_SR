# Upload RIS files

## Purpose

Import bibliographic records from reference managers (Scopus, Zotero, etc.) as encrypted paper corpus.

## Prerequisites

- Signed in as review admin with project password entered
- `.ris` export file(s)

## Steps

1. In the admin panel, find **Upload RIS**
2. Choose your `.ris` file
3. Wait for upload to complete — paper count updates

![RIS upload](../images/v0.5/ris-upload.png)

4. Reviewers can sign in immediately after upload

## Multiple RIS files (v0.7.1+)

You can upload additional RIS files to the same review. Duplicates (by DOI or title+year) are skipped; an import report shows added/duplicate counts.

See [Multi-RIS import](./multi-ris-import.md).

## Supported RIS fields

- `TI` title, `T2` journal, `AB` abstract, `PY` year, `DO` DOI, `UR` URL
- Record type `JOUR` (journal articles)

Authors are **not** imported (blinding).

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Parse error | Ensure valid RIS format; try re-export from source |
| Zero papers | Check file is not empty; records must be `TY - JOUR` |
