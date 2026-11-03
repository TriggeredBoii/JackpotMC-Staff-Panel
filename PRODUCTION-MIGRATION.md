# JackpotMC production migration

## You: Staff Bot

1. Rotate the exposed MongoDB credential **before using this source**. Also rotate the embedded Discord bot, Redis, and Pterodactyl credentials from the old source. No old credential is included here. Keep old ZIPs and Git history private; this package cannot revoke them.
2. Back up existing MongoDB data and Redis. Enable persistent Redis storage (AOF and backups); permissions, overrides, revocations, and audit must survive restart. Keep Redis private to the bot/network.
3. Configure the bot host environment listed below. Use a dedicated Discord account for `STAFF_PANEL_BREAK_GLASS_ID`, with strong account security, guild membership, and no gameplay/admin Discord roles. This account needs no Minecraft link.
4. Build with Java 21 and Maven: `mvn package`. The existing private `me.nootnoot:JackpotMCPunishments:1.0` dependency must be in your Maven repository. It was available for validation here; it is not redistributed inside the sanitized source ZIP.
5. Restart the bot with these variables. Check that `/panel-access` is registered. This uses the existing guild configured in `JackpotMCStaffBot.java`.
6. Sign in to Discord using the recovery identity. Run `/panel-access action:access.read`. Then use the commands below to map **actual role IDs**, configure rank permissions, and give your normal Manager+ account management permissions. No ordinary member is allowed by default until roles are mapped.
7. Link normal staff Discord accounts to their Minecraft accounts through the existing linking flow. The bot uses `discord_players_data` and the existing UUID/username lookup; it creates no replacement link database.
8. Coordinate the matching HMAC key/key ID and bridge token with your friend privately. Start the bot poller against `https://staff.jackpotmc.com` after the Worker is deployed. Sign in to the panel, check rank/link/permissions, and test with a harmless account first.

Bot environment (real values stay on the host):

| Name | Value / purpose |
| --- | --- |
| `DISCORD_BOT_TOKEN` | Newly rotated Discord bot token, not OAuth client secret |
| `MONGODB_URI` | Newly rotated connection string; existing databases/collections are retained |
| `REDIS_HOST` | Your existing Redis host |
| `REDIS_PORT` | Redis port, default 6379 |
| `REDIS_PASSWORD` | Newly rotated Redis password |
| `PTERO_API_TOKEN` | Newly rotated Pterodactyl application API token |
| `PTERO_CLIENT_TOKEN` | Newly rotated Pterodactyl client API token |
| `STAFF_PANEL_BREAK_GLASS_ID` | Dedicated emergency Discord user ID |
| `STAFF_PANEL_WORKER_URL` | Exactly `https://staff.jackpotmc.com` |
| `STAFF_PANEL_HMAC_KEY_ID` | Shared key identifier, 1-32 letters/digits/dot/underscore/hyphen |
| `STAFF_PANEL_HMAC_KEY` | Shared standard Base64 encoding of exactly 64 random bytes |
| `STAFF_PANEL_BOT_TOKEN` | Shared independent random token (at least 32 random bytes, Base64 encoded) |
| `STAFF_PANEL_PREVIOUS_HMAC_KEY_ID`, `STAFF_PANEL_PREVIOUS_HMAC_KEY` | Optional matched previous-key pair during rotation only |

The existing `staff-panel-secrets.properties` fallback still supports the bridge/HMAC settings. Environment variables take precedence. New runtime credentials and the emergency ID use environment variables. Never package the properties file. Legacy owner/staff-role variables and old `staffpanel:permissions:*` wildcard grants do not authorize panel users.

## Your friend: Cloudflare

1. Use the **Staff Panel authorization source ZIP**, unpack it, and run `npm ci` with Node 22.12+ (or a newer supported Node version). Do not deploy the old ZIP or upload only static assets.
2. In the Discord Developer Portal, select the OAuth application and register this redirect URI exactly: `https://staff.jackpotmc.com/auth/callback`. OAuth uses `identify`; a Discord login alone never grants access.
3. Log in with `npx wrangler login`, select the Cloudflare account that controls the `jackpotmc.com` zone, and deploy once with `npm run deploy` to create the Worker and its Durable Object binding. Until secrets and the bot are configured, protected operations fail closed.
4. In **Workers & Pages → jackpotmc-staff-panel → Settings → Variables and Secrets**, add the following production values. Save/deploy the settings. `keep_vars: true` preserves dashboard variables on subsequent code deployments.

| Type | Exact name | Source |
| --- | --- | --- |
| Variable | `DISCORD_CLIENT_ID` | OAuth application's client ID |
| Variable | `STAFF_PANEL_HMAC_KEY_ID` | Same identifier as the bot |
| Secret | `DISCORD_CLIENT_SECRET` | OAuth application's client secret |
| Secret | `SESSION_SECRET` | Independent Base64 encoding of exactly 32 random bytes |
| Secret | `STAFF_PANEL_HMAC_KEY` | Exactly the same 64-byte Base64 HMAC key as the bot |
| Secret | `STAFF_PANEL_BOT_TOKEN` | Exactly the same bridge bearer token as the bot |

Alternatively, set each secret interactively with `npx wrangler secret put NAME`. Do not put secret values in `wrangler.jsonc`, Git, a shared chat, or the ZIP. Generate independent keys locally, for example `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`; use `64` for the HMAC key. Share only the HMAC pair and bridge token with the bot operator through your private secret-sharing channel. The session key belongs only to Cloudflare.

5. Keep `STAFF_PANEL_BRIDGE` bound to class `StaffPanelBridge`, migration tag `v1` with `new_sqlite_classes: ["StaffPanelBridge"]`. The included configuration already sets these. Preserve existing migration history; do not recreate an existing class or rename its binding. If the existing Worker has additional migrations, retain them and append only a missing class migration.
6. The included custom domain is `staff.jackpotmc.com`; `workers_dev` and preview URLs are disabled. Confirm the custom domain is active and HTTPS works. Resolve any existing conflicting DNS record/custom-domain attachment in this zone when Cloudflare requests it. All paths pass through the Worker before assets are served.
7. Remove the old allowed-ID variable from Cloudflare. Do not configure role IDs, rank rules, overrides, Redis/KV action transport, `APP_ENV`, or `DISCORD_REDIRECT_URI` there. There are no Redis/KV credentials or bindings needed by this Worker. MongoDB/Discord bot/Pterodactyl credentials belong only on the Java host.
8. Run `npm run typecheck`, `npm test`, `npm run build`, then `npm run deploy`. The build removes secret environment files from the generated assets. Production delivery uses the Durable Object action queue and the bot's existing `/internal/bot/poll` and `/internal/bot/result` endpoints.
9. Verify `/api/health` reports production/protocol 2. Unauthenticated `/api/me` must return 401; an unauthenticated POST to either internal endpoint must return 401. Start the bot, complete OAuth on the production domain, and confirm `/api/me` contains current `staff` status. Health alone does not establish bot connectivity.

## Configure access (Discord or panel)

The panel **Staff → Access management** page offers role mappings, rank levels/permissions, overrides, session revocation, current configuration, and the latest 100 audit events, depending on the caller's permissions. `/panel-access` offers the same management operations without requiring the website. Its response is a private JSON attachment. Use its `payload` string for the JSON below, replacing IDs with your own. Every mutation requires a reason of 5-500 characters.

| Slash `action` | JSON `payload` example |
| --- | --- |
| `access.read` | Omit payload |
| `roles.set` | `{"roleId":"YOUR_MANAGER_ROLE_ID","rank":"MANAGER","reason":"Initial Manager mapping"}` |
| `roles.set` | `{"roleId":"YOUR_OWNER_ROLE_ID","rank":"OWNER","reason":"Initial Owner mapping"}` |
| `ranks.set` | `{"rank":"MANAGER","level":50,"permissions":["panel.access","punishment.view","punishment.execute","access.read","roles.manage","permissions.manage","overrides.manage","sessions.manage","audit.read"],"reason":"Initial Manager permissions"}` |
| `overrides.set` | `{"discordId":"USER_DISCORD_ID","mode":"FORCE_DENY","grant":[],"deny":[],"reason":"Suspend panel access"}` |
| `overrides.set` | `{"discordId":"USER_DISCORD_ID","mode":"FORCE_ALLOW","grant":["punishment.view"],"deny":["punishment.execute"],"reason":"Explicit temporary exception"}` |
| `overrides.set` | `{"discordId":"USER_DISCORD_ID","mode":"NONE","grant":[],"deny":[],"reason":"Remove explicit exception"}` |
| `sessions.revoke` | `{"discordId":"USER_DISCORD_ID","reason":"Require fresh authentication"}` |
| `audit.read` | Omit payload |

`roles.set` with rank `NONE` removes that mapping. Levels must preserve `MODERATOR < SRMOD < ADMIN < SRADMIN < MANAGER < OWNER`. Defaults are 10/20/30/40/50/60; Manager stays exactly 50, lower ranks stay below it, Owner stays above it. Effective rank is the highest mapped current Discord role. Permissions inherit upward from configured lower ranks. Review grants before placing management permissions on a shared Manager role; you can instead grant management permissions explicitly to selected Manager+ Discord IDs with override mode `NONE`.

Normal access requires Manager+ and `panel.access`. `FORCE_ALLOW` is an explicit audited exception to the rank floor, requires current guild membership, and grants only panel access plus configured role/explicit permissions. It does not synthesize Manager rank. `FORCE_DENY` always wins, including for emergency access. Per-permission deny wins over grants. To remove a FORCE_DENY, use an authorized different account or the protected bot host recovery procedure.

Known permissions are returned by `access.read`. No wildcard is accepted. Currently executable web gameplay functionality is the existing punishment ladder (`punishment.view`, `punishment.execute`); rollback/refund/player/log/monitoring web pages remain the original placeholders and are hidden in navigation. Their explicit permission names reserve a vocabulary, **not an implemented gameplay API**. Existing Discord commands remain the fallback for those features. No extra rollback/refund transport was invented.

The emergency ID is an absolute recovery-only ceiling, regardless of roles, link, wildcard, or user grants: panel access; read access configuration/audit; manage mappings, hierarchy/permissions, overrides and sessions. It cannot use any other panel action, nor the existing Discord interaction handlers. Its web session lasts at most ten minutes, with no sliding renewal. Normal sessions last at most two hours. Rotate the emergency ID only on the protected bot host and restart; that environment change is audited on startup. An emergency identity cannot grant itself permissions or turn itself into an ordinary staff identity through the API. Recovery can restore another normal staff account, as intended.

Unlinked staff may view permitted panel information and recovery configuration. Every implemented player mutation requires an existing Minecraft link. Requests get their actor Discord ID and original session issue time from the encrypted cookie; browser-supplied session timestamps are overwritten. The Java bot rechecks live membership, role mappings, denies, permissions, link requirements, and session revocation before dispatch. Missing members, Discord lookup errors, storage errors, or unavailable bot responses fail closed. Removing a role denies the next sensitive request; the UI refreshes status every 30 seconds.

## Storage, monitoring, and operation

Redis keys `staffpanel:v3:policy` and `staffpanel:v3:audit` hold the policy/revocation state and append-only application audit events. A compare-and-set Lua operation atomically writes each policy change and its actor identity, reason, input, before/after snapshots, and timestamp; conflicts require reload/retry. Host emergency-ID changes are recorded separately. Policy size is limited to 16 KiB. Audit reads return the latest 100 events; the full list remains in Redis. Export/archive it according to your retention policy and monitor storage; this implementation does not silently trim audit records. Database administrators still control backend data.

Action attempts/outcomes carry Discord identity, action ID/time/result, and—on authorized dispatch—the linked Minecraft UUID/name, resolved rank, role IDs, and target payload. HMAC v2, expiration checks, existing action replay claims/rate limits, polling paths, and Durable Object transport are retained. Redis still provides local bot replay/result storage and existing game pub/sub; it is not the Cloudflare action transport.

The existing `/monitor add` flow stores the linked Discord ID, observed role IDs, and observation timestamp alongside the UUID/channel, when lookup succeeds. Stale role snapshots are cleared before refresh. These are attribution metadata only; monitoring never grants access and never writes a permanent member allowlist. A later role removal takes effect through the next live lookup.

The emergency Discord account is blocked in existing slash/button/modal/select handlers; normal Discord fallback commands retain their existing permission behavior. Restrict them through your existing guild command settings as before. This migration does not audit/redesign every unrelated legacy Discord workflow.

## Before opening production access

- Verify an unmapped member and an SRADMIN cannot log in; mapped Manager+ can.
- Remove the Manager role while logged in; the next API action must fail.
- Test FORCE_DENY, explicit FORCE_ALLOW, and permission deny with a test account.
- Unlink a test staff account; punishment execution must fail.
- Use the emergency account: configuration/audit work, punishment API and Discord player commands do not. Check the ten-minute expiry.
- Revoke an account's sessions; its old cookie must fail, and a fresh authorized login can succeed.
- Confirm every role/rank/override/revocation change appears in audit. Test bot/Discord/Redis outages fail closed.
- Do not blindly retry a timed-out mutation: the bot may have completed it before the response timed out. Check audit/configuration or the target first.

Rollout requires live Discord, MongoDB, Redis, OAuth, DNS and Cloudflare checks by you and your friend. The offline builds/tests cannot verify those production accounts or deploy credentials. Keep the original project/data backup for recovery, but do not restore exposed credentials.
