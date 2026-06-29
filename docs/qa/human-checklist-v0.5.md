# Human QA checklist — v0.5

Run before tagging **v0.5.x**. Copy to `human-checklist-vX.Y.md` for later releases.

## Environment

- [ ] Fresh browser profile or incognito
- [ ] Deployed Pages + Worker OR local stack
- [ ] Admin credentials and project password ready
- [ ] Sample `.ris` file ready

## Authentication

- [ ] Admin login at `/admin` works
- [ ] Project password prompt appears after admin login
- [ ] Reviewer login at `/r/:slug` works
- [ ] Wrong password rejected with clear error
- [ ] Admin session blocks reviewer route with sign-out message

## Screening (reviewer)

- [ ] Paper card shows journal, title, abstract, year
- [ ] Swipe / arrow keys record decisions
- [ ] Decisions persist after refresh
- [ ] Undo reverses last decision
- [ ] Rubric panel visible
- [ ] Progress counter updates

## Admin

- [ ] RIS upload loads papers
- [ ] Create reviewer → modal with credentials
- [ ] Delete reviewer works
- [ ] Rubric save/load
- [ ] CSV export opens correctly

## Security

- [ ] Network tab: API payloads are encrypted (no plaintext titles)
- [ ] Wrong project password shows error

## Documentation

- [ ] Screenshots in `docs/images/v0.5/` match UI
- [ ] README links to `docs/README.md`

## Sign-off

| Role | Name | Date | Version |
|------|------|------|---------|
| Developer | | | v0.5 |
| Product owner | | | |

See [human-checklist.md](./human-checklist.md) for the full multi-version checklist.
