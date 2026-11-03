# Staff Panel ↔ Staff Bot integration

The existing Discord commands remain enabled. The website is an additional interface; it does not replace `/punish` or the other JDA listeners.

## Configure once

Use the same long random `STAFF_PANEL_ACTION_SECRET` in both environments. Do not commit it.

### Staff Panel `.dev.vars` / Cloudflare secrets
- `REDIS_HOST`
- `REDIS_PORT=6379`
- `REDIS_PASSWORD`
- `STAFF_PANEL_ACTION_SECRET`
- existing Discord OAuth/session variables

### Staff Bot / Pterodactyl environment
- `STAFF_PANEL_ACTION_SECRET`
- `STAFF_PANEL_OWNER_DISCORD_IDS=323471274586275840` (comma-separated owners)

Owners automatically pass Staff Panel permission checks. Other linked staff can be granted granular permissions in Redis sets:

- key: `staffpanel:permissions:<discordId>`
- current permissions: `panel.access`, `punishment.view`, `punishment.execute`

Example Redis commands for a non-owner staff member:

    SADD staffpanel:permissions:DISCORD_ID panel.access punishment.view punishment.execute

## Punishment UX

The website only asks for username + punishment type. The Staff Bot calculates the next offense, configured punishment kind, generated reason and duration using the existing punishment configuration. Discord `/punish` remains unchanged.

## Security

The browser never supplies a trusted actor ID. The Worker takes the actor from the encrypted OAuth session, signs a short-lived action envelope with HMAC-SHA256, and publishes it to Redis. The bot verifies the signature, expiry, linked Minecraft account and permission, then atomically claims the action ID before executing it. Results are returned through a short-lived Redis key.

For production, do not expose plaintext Redis directly to the public Internet. Use TLS and ACLs/network restriction, or place Redis behind a private tunnel/gateway. The HMAC protects Staff Panel actions from forged Redis messages, but it does not encrypt the Redis password or traffic.
