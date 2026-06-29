# Deploy Pages and Worker

## GitHub Pages

1. Repo **Settings → Pages** → branch `gh-pages`, root `/`
2. From project root:

```bash
npm run deploy:pages
```

Live URL: https://magkosm.github.io/Double_Blinded_SR/

If publish fails with **Author identity unknown**, either set git user locally (`git config user.name` / `user.email`) or add optional `GIT_AUTHOR_NAME` and `GIT_AUTHOR_EMAIL` to `.secrets.local`. The deploy script also falls back to your last commit author or `GITHUB_USER@users.noreply.github.com`.

## Cloudflare Worker

```bash
export CLOUDFLARE_API_TOKEN=$(grep '^CLOUDFLARE_API_TOKEN=' .secrets.local | cut -d= -f2-)
export CLOUDFLARE_ACCOUNT_ID=$(grep '^CLOUDFLARE_ACCOUNT_ID=' .secrets.local | cut -d= -f2-)
npm run deploy:worker
npm run bootstrap      # once: super-admin
```

## First review setup

After bootstrap, sign in as super-admin → create a review → bootstrap review admin → upload RIS.

## Pre-deploy QA

```bash
npm run qa
```

Run [human QA checklist](../qa/human-checklist.md) before tagging a release.
