# JackpotMC Staff Panel secure protocol v2

The browser never supplies a trusted staff identity. The Worker derives the Discord ID only from the encrypted HttpOnly OAuth session. Every Worker -> Staff Bot action uses protocol v2 and is signed with HMAC-SHA-512 using a 64-byte random key.

The signature covers: protocol marker, protocol version, key ID, UUID action ID, 32-byte random nonce, OAuth Discord ID, action name, issued time, expiry time and SHA-256 of the exact payload JSON. The payload hash is recomputed by the bot. Requests expire after 20 seconds. The bot atomically claims action IDs in Redis before execution, checks account linking, checks that the Discord member still has a configured active-staff role, then checks the exact panel permission. Destructive punishment actions also have a separate server-side rate limit.

## Generate secrets

PowerShell session secret (32 bytes):

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

PowerShell Staff Panel signing key (64 bytes):

```powershell
$bytes = New-Object byte[] 64
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Never reuse either key for Redis, Discord, MongoDB or another service.

## Staff Bot environment

```text
STAFF_PANEL_HMAC_KEY_ID=v1
STAFF_PANEL_HMAC_KEY=<64-byte Base64 key>
STAFF_PANEL_OWNER_DISCORD_IDS=323471274586275840
STAFF_PANEL_STAFF_ROLE_IDS=<comma-separated Discord staff role IDs>
```

For a zero-downtime key rotation, the bot can temporarily also receive:

```text
STAFF_PANEL_PREVIOUS_HMAC_KEY_ID=v1
STAFF_PANEL_PREVIOUS_HMAC_KEY=<old key>
```

Set the new current key to `v2` on the bot, restart it, switch the Worker to `v2`, verify traffic, then remove the previous key variables on the next bot restart.

## Redis

For production, use a dedicated Redis ACL account for the panel and TLS. Do not expose a plaintext Redis password/traffic path to the public Internet. The panel only needs enough Redis access for PUBLISH to `staff_bot_channel`, GET/DEL result keys, and authentication. The bot retains its existing Redis connection and existing Discord functionality.

## Existing bot behavior

The Staff Panel code is additive. Existing Discord commands and their existing Redis messages are not replaced. If the website is offline or misconfigured, the existing Discord commands continue through their old code paths.
