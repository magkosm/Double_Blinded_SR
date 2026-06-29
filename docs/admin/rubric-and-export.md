# Rubric and CSV export

## Rubric

Define the screening question and inclusion/exclusion criteria. Reviewers see this panel while screening.

1. Edit fields in **Screening rubric**
2. Click **Save rubric**

![Rubric editor](../images/v0.5/rubric-editor.png)

## CSV export

Export all reviewer decisions (decrypted with project password):

1. Click **Export CSV**
2. Open in Excel, Google Sheets, or R

Columns: paper metadata + one column per reviewer with decision (include/exclude/maybe/skip).

## RIS export (include + maybe)

Export a `.ris` file for papers that passed title/abstract screening:

1. Choose **RIS filter** — any reviewer vs all reviewers marked include/maybe
2. Click **Export RIS (include + maybe)**
3. Import into Zotero, Rayyan, Covidence, or your next search tool

Records are rebuilt from stored title, journal, abstract, year, and DOI fields.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Export empty | Ensure reviewers have screened papers |
| Garbled CSV | Open with UTF-8 encoding |
