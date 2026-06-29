# Contributing documentation

## Regenerating screenshots

```bash
npm run docs:screenshots
```

This runs `scripts/capture-docs.ts` with Playwright:

1. Starts or uses the dev server at `http://localhost:5173/Double_Blinded_SR`
2. Captures fixed viewports:
   - **Desktop 1280×800** — admin flows
   - **Mobile 390×844** — reviewer flows
3. Writes PNGs to `docs/images/v{version}/`

## Optional credentials

For authenticated screenshots, set in environment or `.secrets.local`:

- `DOCS_ADMIN_USER`, `DOCS_ADMIN_PASS`, `DOCS_PROJECT_PASS`
- `DOCS_REVIEW_SLUG` (default: `default`)

Without credentials, only public login pages are captured.

## When to update

- Every release tag — update version folder and markdown references
- After UI changes that affect documented flows

## Markdown convention

Each how-to: **Purpose → Prerequisites → Steps → Screenshot → Troubleshooting**

Use relative paths: `../images/v0.5/admin-login.png`
