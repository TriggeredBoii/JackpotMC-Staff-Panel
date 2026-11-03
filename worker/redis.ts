import type { Env } from './types';

const enc = new TextEncoder();

const PROTOCOL_VERSION = 2;
const ACTION_TTL_MS = 20_000;
const MAX_PAYLOAD_BYTES = 16_384;

type BotResult = {
  ok: boolean;
  code: string;
  message: string;
  data?: unknown;
};

function toArrayBuffer(
  bytes: Uint8Array
): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function b64url(
  value: ArrayBuffer | Uint8Array
): string {
  const bytes =
    value instanceof Uint8Array
      ? value
      : new Uint8Array(value);

  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64(
  value: string
): Uint8Array {
  const normalized = value
    .trim()
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const padded =
    normalized +
    '='.repeat(
      (4 - (normalized.length % 4)) % 4
    );

  let binary: string;

  try {
    binary = atob(padded);
  } catch {
    throw new Error(
      'STAFF_PANEL_HMAC_KEY must contain valid Base64'
    );
  }

  const output =
    new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    output[i] = binary.charCodeAt(i);
  }

  return output;
}

async function sha256(
  value: string
): Promise<string> {
  const digest =
    await crypto.subtle.digest(
      'SHA-256',
      toArrayBuffer(enc.encode(value))
    );

  return b64url(digest);
}

async function sign(
  keyBase64: string,
  canonicalValue: string
): Promise<string> {
  const raw = decodeBase64(keyBase64);

  if (raw.byteLength !== 64) {
    throw new Error(
      'STAFF_PANEL_HMAC_KEY must decode to exactly 64 bytes'
    );
  }

  const key =
    await crypto.subtle.importKey(
      'raw',
      toArrayBuffer(raw),
      {
        name: 'HMAC',
        hash: 'SHA-512'
      },
      false,
      ['sign']
    );

  const signature =
    await crypto.subtle.sign(
      'HMAC',
      key,
      toArrayBuffer(enc.encode(canonicalValue))
    );

  return b64url(signature);
}

function canonical(fields: {
  keyId: string;
  actionId: string;
  nonce: string;
  actorDiscordId: string;
  action: string;
  issuedAt: number;
  expiresAt: number;
  payloadSha256: string;
}): string {
  return [
    'JMC-STAFF-PANEL',
    String(PROTOCOL_VERSION),
    fields.keyId,
    fields.actionId,
    fields.nonce,
    fields.actorDiscordId,
    fields.action,
    String(fields.issuedAt),
    String(fields.expiresAt),
    fields.payloadSha256
  ].join('\n');
}

export async function botAction(
  env: Env,
  actorDiscordId: string,
  action: string,
  payload: unknown,
  timeoutMs = 8_000
): Promise<BotResult> {

  if (!/^\d{15,22}$/.test(actorDiscordId)) {
    throw new Error(
      'Invalid authenticated Discord identity'
    );
  }

  if (!/^[a-z][a-z0-9_.-]{2,63}$/.test(action)) {
    throw new Error('Invalid action');
  }

  if (
    !/^[A-Za-z0-9._-]{1,32}$/.test(
      env.STAFF_PANEL_HMAC_KEY_ID || ''
    )
  ) {
    throw new Error('Invalid HMAC key ID');
  }

  if (!env.STAFF_PANEL_HMAC_KEY) {
    throw new Error(
      'STAFF_PANEL_HMAC_KEY is not configured'
    );
  }

  if (!env.STAFF_PANEL_BRIDGE) {
    throw new Error(
      'STAFF_PANEL_BRIDGE is not configured'
    );
  }

  const actionId = crypto.randomUUID();

  const nonceBytes = new Uint8Array(32);
  crypto.getRandomValues(nonceBytes);

  const nonce = b64url(nonceBytes);

  const issuedAt = Date.now();
  const expiresAt = issuedAt + ACTION_TTL_MS;

  const payloadJson =
    JSON.stringify(payload ?? {});

  if (
    enc.encode(payloadJson).byteLength >
    MAX_PAYLOAD_BYTES
  ) {
    throw new Error('Action payload too large');
  }

  const payloadSha256 =
    await sha256(payloadJson);

  const keyId =
    env.STAFF_PANEL_HMAC_KEY_ID;

  const signature =
    await sign(
      env.STAFF_PANEL_HMAC_KEY,
      canonical({
        keyId,
        actionId,
        nonce,
        actorDiscordId,
        action,
        issuedAt,
        expiresAt,
        payloadSha256
      })
    );

  const message = {
    version: PROTOCOL_VERSION,
    keyId,
    actionId,
    nonce,
    actorDiscordId,
    action,
    issuedAt,
    expiresAt,
    payloadJson,
    payloadSha256,
    signature
  };

  /*
   * One pending action at a time for the initial
   * Staff Bot polling implementation.
   *
   * The bot still performs the real authorization.
   */
  await env.STAFF_PANEL_BRIDGE.put(
    `pending:${actionId}`,
    JSON.stringify(message),
    {
      expirationTtl: 60,
      metadata: {
        createdAt: issuedAt
      }
    }
  );

  await env.STAFF_PANEL_BRIDGE.put(
    'queue:latest',
    actionId,
    {
      expirationTtl: 60
    }
  );

  const resultKey =
    `result:${actionId}`;

  const deadline =
    Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result =
      await env.STAFF_PANEL_BRIDGE.get(
        resultKey
      );

    if (result) {
      await env.STAFF_PANEL_BRIDGE.delete(
        resultKey
      );

      try {
        return JSON.parse(result) as BotResult;
      } catch {
        throw new Error(
          'Staff Bot returned an invalid result'
        );
      }
    }

    await new Promise<void>(
      resolve => setTimeout(resolve, 250)
    );
  }

  throw new Error(
    'Staff Bot response timed out'
  );
}