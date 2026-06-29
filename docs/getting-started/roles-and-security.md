# Roles and security

## Roles

| Role | Access |
|------|--------|
| **Super-admin** | Create/delete reviews, assign review admins, global overview |
| **Review admin** | One review: RIS upload, reviewers, rubric, progress, export |
| **Reviewer** | Screen papers for one review only |

## Credentials

- **Admin password** — bcrypt-hashed on server; never stored in git
- **Project password** — known to admins; derives encryption key client-side; required to decrypt papers and export
- **Reviewer password** — per account; unwraps project key for that reviewer

Passwords **cannot be recovered**. Recreate reviewer accounts if lost.

## What the server sees

The Cloudflare Worker stores:

- Bcrypt password hashes
- JWT session tokens (8h expiry)
- **Encrypted blobs only** for papers, rubric, and decisions

Plaintext titles, abstracts, and decisions never leave the browser unencrypted.

## Browser session

- Admin JWT and project password persist in `sessionStorage` for the tab session
- Reviewer password stays in memory only (not persisted)
- Sign out before switching roles (admin vs reviewer)

## Rate limiting

Login attempts are limited to 20 per minute per IP.
