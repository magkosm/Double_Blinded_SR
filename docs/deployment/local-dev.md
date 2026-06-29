# Local development

```bash
npm install
cp .secrets.local.example .secrets.local   # fill credentials
echo 'VITE_API_URL=http://localhost:8787' > app/.env.local

npm run dev          # frontend http://localhost:5173/Double_Blinded_SR/
npm run dev:worker   # worker http://localhost:8787
npm run test         # unit tests
npm run e2e          # Playwright (starts dev server)
npm run qa           # test + build (+ e2e if configured)
```

## E2E with live API

```bash
export E2E_ADMIN_USER=youradmin
export E2E_ADMIN_PASS=yourpass
npm run e2e -w app
```

## Regenerate docs screenshots

```bash
npm run docs:screenshots
```

See [CONTRIBUTING-docs.md](../CONTRIBUTING-docs.md).
