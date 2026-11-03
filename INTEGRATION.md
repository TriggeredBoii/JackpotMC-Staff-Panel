# Staff Panel and Staff Bot integration

The website is an additional interface. Existing Discord commands remain enabled.

## Transport

The production transport is outbound-only:

Browser -> Cloudflare Worker -> Durable Object bridge <- Java Staff Bot

The Staff Bot polls `POST /internal/bot/poll` and submits results to `POST /internal/bot/result` using `STAFF_PANEL_BOT_TOKEN` as a Bearer token. No inbound Pterodactyl port and no public Redis transport are required.

## Action security

Staff actions use protocol v2. The Worker signs each short-lived action envelope with HMAC-SHA-512. The Java bot validates the action ID, nonce, actor Discord ID, action, payload hash, signature, timestamps, replay protection, account link, staff status, permissions and rate limits before executing it.

The Worker and Java bot must share:

- `STAFF_PANEL_HMAC_KEY_ID`
- `STAFF_PANEL_HMAC_KEY`
- `STAFF_PANEL_BOT_TOKEN`

Do not commit these values.

## Authorization

The browser never supplies a trusted actor identity. The Worker takes the Discord ID from the encrypted OAuth session. The Java Staff Bot remains the final authorization authority for every action.
