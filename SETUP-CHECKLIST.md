# Production setup checklist

## GitHub

- Keep `main` as the production branch.
- Do not commit `.dev.vars`, `.env`, credentials, tokens, or keys.
- Run `npm run typecheck`, `npm test`, and `npm run build` before deployment.

## Discord OAuth

Register this redirect URI in the Discord application:

`https://staff.jackpotmc.com/auth/callback`

No localhost or workers.dev OAuth callback is required.

## Cloudflare Worker

Connect the GitHub repository to Cloudflare Workers Builds.

- Worker: `jackpotmc-staff-panel`
- Production branch: `main`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Custom domain: `staff.jackpotmc.com`

Configure the required production secrets listed in `README.md` directly in Cloudflare.

The Durable Object binding and migration are already defined in `wrangler.jsonc`.

## Staff Bot

The bot must continue polling the Worker over outbound HTTPS using:

- `POST /internal/bot/poll`
- `POST /internal/bot/result`

The bot and Worker must use the same `STAFF_PANEL_BOT_TOKEN`, HMAC key ID, and HMAC key.
