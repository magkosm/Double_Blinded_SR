# Overview

Double-Blinded SR is a web app for **systematic review title/abstract screening**. Reviewers swipe through paper cards; decisions are encrypted per reviewer before storage on Cloudflare.

## Purpose

- **Double-blind screening** — reviewers do not see authors; admins see aggregate progress, not individual reviewer choices until export
- **Mobile-first** — swipe gestures on phone; arrow keys on desktop
- **Encrypted at rest** — papers and decisions are ciphertext on the server

## Quick links

- **Live app:** https://magkosm.github.io/Double_Blinded_SR/
- **Reviewer:** open the review URL provided by your admin (e.g. `/r/your-review`)
- **Admin:** `/admin` (super-admin) or `/admin/your-review` (review admin)

## Workflow summary

1. Admin uploads RIS export(s) and sets the screening rubric
2. Admin creates reviewer accounts (one-time passwords)
3. Reviewers sign in and screen papers (include / exclude / maybe / skip)
4. Admin monitors progress and exports CSV when ready

![Reviewer screening card](../images/v0.5/reviewer-card.png)

## Next steps

- [Roles & security](./roles-and-security.md)
- [Reviewer: login & screening](../reviewer/login-and-screening.md)
- [Admin: upload RIS](../admin/upload-ris.md)
