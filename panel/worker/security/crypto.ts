const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const binary = atob(value.trim());
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return buffer;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToArrayBuffer(value: string): ArrayBuffer {
  let base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  while (base64.length % 4 !== 0) {
    base64 += "=";
  }

  return base64ToArrayBuffer(base64);
}

async function importSessionKey(secret: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(secret);

  if (keyBuffer.byteLength !== 32) {
    throw new Error(
      `SESSION_SECRET must decode to exactly 32 bytes for AES-256-GCM. Got ${keyBuffer.byteLength} bytes.`
    );
  }

  return crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Cryptographically secure random URL-safe token.
 *
 * Used for OAuth state and other one-time random values.
 */
export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);

  return bytesToBase64Url(bytes);
}

export async function seal(
  value: unknown,
  secret: string
): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const plaintextBytes = encoder.encode(JSON.stringify(value));

  // Copy into explicit ArrayBuffers to keep TypeScript/WebCrypto happy.
  const plaintext = new ArrayBuffer(plaintextBytes.byteLength);
  new Uint8Array(plaintext).set(plaintextBytes);

  const ivBuffer = new ArrayBuffer(iv.byteLength);
  new Uint8Array(ivBuffer).set(iv);

  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: ivBuffer,
    },
    await importSessionKey(secret),
    plaintext
  );

  const encryptedBytes = new Uint8Array(encrypted);
  const combined = new Uint8Array(
    iv.byteLength + encryptedBytes.byteLength
  );

  combined.set(iv, 0);
  combined.set(encryptedBytes, iv.byteLength);

  return bytesToBase64Url(combined);
}

export async function unseal<T>(
  token: string,
  secret: string
): Promise<T | null> {
  try {
    const combinedBuffer = base64UrlToArrayBuffer(token);
    const combined = new Uint8Array(combinedBuffer);

    if (combined.byteLength <= 12) {
      return null;
    }

    const iv = combinedBuffer.slice(0, 12);
    const ciphertext = combinedBuffer.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      await importSessionKey(secret),
      ciphertext
    );

    return JSON.parse(decoder.decode(decrypted)) as T;
  } catch {
    return null;
  }
}