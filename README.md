# JackpotMC Staff Panel

Secure Cloudflare Workers + React foundation for the JackpotMC staff system.

## Security model (V0.1)

The browser is never trusted. Except `/login`, `/denied`, Discord OAuth endpoints, and `/api/health`, application routes are gated by the Worker before static assets are served. API routes independently require a valid encrypted HttpOnly session. Login requires both an explicit Discord-ID allowlist and a linked-ID list. Changing either list invalidates access on the next request. State-changing APIs are expected to require the session CSRF token. Future destructive actions must also add server-side RBAC, validation, rate limiting, idempotency, and audit logging.

This is a secure foundation, not a claim that any internet application is impossible to compromise. Do not expose destructive staff actions until the Java backend performs its own authorization.

## Requirements

- Node.js 20+
- npm
- A Discord application for OAuth testing
- Cloudflare account for remote deployment

## Local setup

```bash
npm install
cp .env.example .dev.vars
```

On Windows PowerShell use:

```powershell
Copy-Item .env.example .dev.vars
```

Edit `.dev.vars` and set a Discord OAuth application ID/secret, a long random `SESSION_SECRET`, and your own Discord ID in **both** `ALLOWED_DISCORD_IDS` and `LINKED_DISCORD_IDS`.

In the Discord Developer Portal, add this OAuth redirect for local development:

`http://localhost:5173/auth/callback`

Then:

```bash
npm run dev
```

Open `http://localhost:5173`. Direct access to `/`, `/players`, etc. redirects to `/login` until Discord auth succeeds.

## Checks

```bash
npm run typecheck
npm test
npm run build
```

## Production secrets

Never commit `.dev.vars`. Configure these as Cloudflare Worker secrets/variables:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET` (secret)
- `DISCORD_REDIRECT_URI`
- `SESSION_SECRET` (secret; use a high-entropy value)
- `ALLOWED_DISCORD_IDS`
- `LINKED_DISCORD_IDS`
- `APP_ENV=production`

For production, register the exact production callback URI in Discord, e.g. `https://staff.jackpotmc.com/auth/callback` after the domain is ready.

## Git / Cloudflare deployment

Recommended branches:

- `main`: production
- `dev`: integration/testing
- `feature/*`: work branches

Cloudflare Workers Builds can connect directly to GitHub. Set `main` as the production branch and enable preview builds for non-production branches. The Worker project name in Cloudflare must match `jackpotmc-staff-panel` from `wrangler.jsonc`.

Normal flow:

```bash
git checkout -b feature/example
# work + npm run build + npm test
git push -u origin feature/example
# test Cloudflare preview, merge to dev, test, then merge to main
```

## Rollback

Emergency Cloudflare rollback:

```bash
npx wrangler deployments list
npx wrangler rollback [VERSION_ID]
```

Then permanently reconcile Git by reverting the bad commit and pushing the corrected `main` branch:

```bash
git revert <bad-commit-sha>
git push origin main
```

Do not use application rollback to assume database changes were rolled back. Future DB migrations need a separate migration/recovery strategy.

## Next security milestone

Replace the temporary linked-ID list with the authoritative JackpotMC account-link service and add RBAC. The Java staff backend must independently validate the staff actor and permission for every punishment/refund/rollback operation. Add Cloudflare rate limits plus backend idempotency keys for destructive actions before exposing them.

## Simple local setup

The initial authorized and linked Discord account is already set to `323471274586275840` in `.env.example`.

On Windows, run `./setup-local.ps1`. It asks only for the Discord application's Client ID and Client Secret, generates a strong session secret automatically, and creates `.dev.vars`. Add `http://localhost:5173/auth/callback` as a Discord OAuth redirect URI, then run `npm install` and `npm run dev`.

This bootstrap allowlist is intentionally simple. It is server-side only. The later staff-account system will replace the static linked-ID list with the real JackpotMC linking and role/permission database.
