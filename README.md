# JackpotMC Staff Panel

Production-only Cloudflare Worker + React staff panel for JackpotMC.

## Production URL

`https://staff.jackpotmc.com`

Discord OAuth callback:

`https://staff.jackpotmc.com/auth/callback`

The callback is fixed in the Worker. Localhost OAuth and development-mode authentication are intentionally not supported.

## Architecture

Browser -> Cloudflare Worker -> Durable Object bridge <- Staff Bot outbound HTTPS polling.

The Java Staff Bot remains the authorization authority for staff actions. Existing Discord commands continue to work independently.

The Worker exposes the existing bot bridge endpoints:

- `POST /internal/bot/poll`
- `POST /internal/bot/result`

Both require `STAFF_PANEL_BOT_TOKEN`.

## Required Cloudflare secrets

Configure these in the production Worker. Never commit their values to Git:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `SESSION_SECRET`
- `ALLOWED_DISCORD_IDS`
- `STAFF_PANEL_HMAC_KEY_ID`
- `STAFF_PANEL_HMAC_KEY`
- `STAFF_PANEL_BOT_TOKEN`

`STAFF_PANEL_HMAC_KEY` must match the key configured in the Java Staff Bot. `STAFF_PANEL_BOT_TOKEN` must match the token used by the bot for polling and result submission.

## Cloudflare deployment

This is a Worker application with a Durable Object, not a static Pages-only site.

Production branch: `main`

Build command:

```bash
npm run build
```

Deploy command:

```bash
npx wrangler deploy
```

The Worker name is `jackpotmc-staff-panel`. The Durable Object binding and migration are defined in `wrangler.jsonc`.

After deployment, attach the custom domain `staff.jackpotmc.com` and ensure the Discord application contains exactly the production callback above.

## Checks before pushing

```bash
npm install
npm run typecheck
npm test
npm run build
```

## Security

The browser is not trusted. OAuth creates an encrypted HttpOnly Secure session. State-changing API requests require same-origin checks and a CSRF token. Staff actions are signed using protocol v2 HMAC-SHA-512 envelopes and sent through the Durable Object bridge. The Java Staff Bot independently validates the actor, signature, expiry, replay protection, linking, permissions and action data before execution.

Do not put `.dev.vars`, `.env`, tokens, OAuth secrets, HMAC keys, session secrets or bot tokens in this repository.

## Rollback

```bash
npx wrangler deployments list
npx wrangler rollback VERSION_ID
```

Then revert the bad Git commit so the repository and deployed state agree.
