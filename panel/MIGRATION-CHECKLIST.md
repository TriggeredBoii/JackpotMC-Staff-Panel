# Migration checklist

## You — Staff Bot

- Rotate exposed MongoDB, Discord bot, Redis and Pterodactyl credentials.
- Back up MongoDB and Redis; enable Redis persistence and audit backups.
- Set the environment variables in PRODUCTION-MIGRATION.md, especially the dedicated recovery Discord ID, newly rotated credentials, production Worker URL, and shared HMAC/token values.
- Build with Java 21/Maven and the existing private JackpotMCPunishments dependency; restart the bot.
- As the recovery account, use `/panel-access` to map real Manager/Owner role IDs and grant explicit normal permissions. No normal staff are implicitly authorized.
- Keep normal staff Minecraft links; monitoring snapshots do not grant access.

## Your friend — Cloudflare

- Use the updated Staff Panel ZIP. Set Discord OAuth callback exactly to `https://staff.jackpotmc.com/auth/callback`.
- Set two production variables: `DISCORD_CLIENT_ID`, `STAFF_PANEL_HMAC_KEY_ID`.
- Set four secrets: `DISCORD_CLIENT_SECRET`, `SESSION_SECRET` (32-byte Base64), `STAFF_PANEL_HMAC_KEY` (64-byte Base64), `STAFF_PANEL_BOT_TOKEN`.
- HMAC key/key ID and bridge token must match the Java host. Keep session secret independent.
- Preserve the `STAFF_PANEL_BRIDGE` Durable Object binding/migration. Use the included production custom domain; disable workers.dev/previews. Remove the old allowed-ID variable and old Redis/KV transport settings.
- Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run deploy`.

## Together

- Test OAuth, live role removal, deny overrides, missing Minecraft links, session revocation and audit records.
- Verify the emergency account can recover permissions but cannot modify players through the website or Discord fallback commands.
- Check real production connectivity before granting broad access. Both ZIPs contain source, not deployment secrets or bundled build dependencies.

See PRODUCTION-MIGRATION.md for exact setup order, all bot variables, command examples, storage behavior, and recovery notes.
