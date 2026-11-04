import type { Env } from './types';

const enc = new TextEncoder();
const PROTOCOL_VERSION = 2;
const ACTION_TTL_MS = 20_000;
const MAX_PAYLOAD_BYTES = 16_384;
const DEFAULT_WAIT_MS = 8_000;
const MAX_WAIT_MS = 15_000;
const QUEUE_KEY = 'queue';

type BotResult = {
  ok: boolean;
  code: string;
  message: string;
  data?: unknown;
};

type QueuedAction = {
  actionId: string;
  expiresAt: number;
  message: string;
};

type StoredResult = {
  expiresAt: number;
  result: BotResult;
};

type Waiter = {
  resolve: (result: BotResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function b64url(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64(value: string): Uint8Array {
  const normalized = value.trim().replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new Error('STAFF_PANEL_HMAC_KEY must contain valid Base64');
  }
  const output = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) output[i] = binary.charCodeAt(i);
  return output;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(enc.encode(value)));
  return b64url(digest);
}

async function sign(keyBase64: string, canonicalValue: string): Promise<string> {
  const raw = decodeBase64(keyBase64);
  if (raw.byteLength !== 64) throw new Error('STAFF_PANEL_HMAC_KEY must decode to exactly 64 bytes');
  const key = await crypto.subtle.importKey('raw', toArrayBuffer(raw), {name:'HMAC',hash:'SHA-512'}, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, toArrayBuffer(enc.encode(canonicalValue)));
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
    'JMC-STAFF-PANEL', String(PROTOCOL_VERSION), fields.keyId, fields.actionId,
    fields.nonce, fields.actorDiscordId, fields.action, String(fields.issuedAt),
    String(fields.expiresAt), fields.payloadSha256
  ].join('\n');
}

function bridgeStub(env: Env): DurableObjectStub {
  const id = env.STAFF_PANEL_BRIDGE.idFromName('staff-panel-global');
  return env.STAFF_PANEL_BRIDGE.get(id);
}

export async function pollBot(env: Env): Promise<Response> {
  return bridgeStub(env).fetch('https://staff-panel-bridge.internal/poll', {method:'POST'});
}

export async function submitBotResult(env: Env, actionId: string, result: Record<string, unknown>): Promise<Response> {
  return bridgeStub(env).fetch('https://staff-panel-bridge.internal/result', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({actionId,result})
  });
}

export async function botAction(
  env: Env,
  actorDiscordId: string,
  action: string,
  payload: unknown,
  timeoutMs = DEFAULT_WAIT_MS
): Promise<BotResult> {
  if (!/^\d{15,22}$/.test(actorDiscordId)) throw new Error('Invalid authenticated Discord identity');
  if (!/^[a-z][a-z0-9_.-]{2,63}$/.test(action)) throw new Error('Invalid action');
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(env.STAFF_PANEL_HMAC_KEY_ID || '')) throw new Error('Invalid HMAC key ID');
  if (!env.STAFF_PANEL_HMAC_KEY) throw new Error('STAFF_PANEL_HMAC_KEY is not configured');
  if (!env.STAFF_PANEL_BRIDGE) throw new Error('STAFF_PANEL_BRIDGE is not configured');

  const actionId = crypto.randomUUID();
  const nonceBytes = new Uint8Array(32);
  crypto.getRandomValues(nonceBytes);
  const nonce = b64url(nonceBytes);
  const issuedAt = Date.now();
  const expiresAt = issuedAt + ACTION_TTL_MS;
  const payloadJson = JSON.stringify(payload ?? {});
  if (enc.encode(payloadJson).byteLength > MAX_PAYLOAD_BYTES) throw new Error('Action payload too large');
  const payloadSha256 = await sha256(payloadJson);
  const keyId = env.STAFF_PANEL_HMAC_KEY_ID;
  const signature = await sign(env.STAFF_PANEL_HMAC_KEY, canonical({
    keyId, actionId, nonce, actorDiscordId, action, issuedAt, expiresAt, payloadSha256
  }));

  const message = {
    version:PROTOCOL_VERSION, keyId, actionId, nonce, actorDiscordId, action,
    issuedAt, expiresAt, payloadJson, payloadSha256, signature
  };

  const waitMs = Math.max(1, Math.min(timeoutMs, MAX_WAIT_MS));
  const response = await bridgeStub(env).fetch('https://staff-panel-bridge.internal/submit', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({message,waitMs})
  });

  if (response.status === 504) throw new Error('Staff Bot response timed out');
  if (!response.ok) throw new Error('Staff Panel bridge rejected the action');
  const result = await response.json() as BotResult;
  if (!result || typeof result !== 'object' || typeof result.ok !== 'boolean') {
    throw new Error('Staff Bot returned an invalid result');
  }
  return result;
}

export class StaffPanelBridge implements DurableObject {
  private readonly state: DurableObjectState;
  private readonly waiters = new Map<string, Waiter>();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'POST') return Response.json({error:'method_not_allowed'},{status:405});
    if (url.pathname === '/submit') return this.submit(request);
    if (url.pathname === '/poll') return this.poll();
    if (url.pathname === '/result') return this.result(request);
    return Response.json({error:'not_found'},{status:404});
  }

  private async loadQueue(): Promise<QueuedAction[]> {
    const queue = await this.state.storage.get<QueuedAction[]>(QUEUE_KEY);
    return Array.isArray(queue) ? queue : [];
  }

  private async saveQueue(queue: QueuedAction[]): Promise<void> {
    if (queue.length === 0) await this.state.storage.delete(QUEUE_KEY);
    else await this.state.storage.put(QUEUE_KEY, queue);
  }

  private async submit(request: Request): Promise<Response> {
    const body = await request.json() as {message?: unknown; waitMs?: unknown};
    if (!body.message || typeof body.message !== 'object' || Array.isArray(body.message)) {
      return Response.json({error:'invalid_action'},{status:400});
    }
    const message = body.message as Record<string, unknown>;
    const actionId = typeof message.actionId === 'string' ? message.actionId : '';
    const expiresAt = typeof message.expiresAt === 'number' ? message.expiresAt : 0;
    if (!/^[0-9a-fA-F-]{36}$/.test(actionId) || expiresAt <= Date.now()) {
      return Response.json({error:'invalid_action'},{status:400});
    }

    const existing = await this.state.storage.get<StoredResult>(`result:${actionId}`);
    if (existing && existing.expiresAt > Date.now()) {
      await this.state.storage.delete(`result:${actionId}`);
      return Response.json(existing.result);
    }

    const queue = (await this.loadQueue()).filter(item => item.expiresAt > Date.now());
    queue.push({actionId,expiresAt,message:JSON.stringify(message)});
    await this.saveQueue(queue);

    const waitMs = typeof body.waitMs === 'number' ? Math.max(1, Math.min(body.waitMs, MAX_WAIT_MS)) : DEFAULT_WAIT_MS;
    return new Promise<Response>((resolve) => {
      const timer = setTimeout(() => {
        this.waiters.delete(actionId);
        resolve(Response.json({error:'bot_timeout'},{status:504}));
      }, waitMs);
      this.waiters.set(actionId, {
        timer,
        resolve:(result) => resolve(Response.json(result)),
        reject:() => resolve(Response.json({error:'bridge_error'},{status:500}))
      });
    });
  }

  private async poll(): Promise<Response> {
    const now = Date.now();
    const queue = await this.loadQueue();
    let next: QueuedAction | undefined;
    while (queue.length > 0) {
      const candidate = queue.shift()!;
      if (candidate.expiresAt > now) {
        next = candidate;
        break;
      }
    }
    await this.saveQueue(queue);
    if (!next) return new Response(null,{status:204});
    return new Response(next.message,{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  }

  private async result(request: Request): Promise<Response> {
    const body = await request.json() as {actionId?: unknown; result?: unknown};
    const actionId = typeof body.actionId === 'string' ? body.actionId : '';
    if (!/^[0-9a-fA-F-]{36}$/.test(actionId) || !body.result || typeof body.result !== 'object' || Array.isArray(body.result)) {
      return Response.json({error:'invalid_request'},{status:400});
    }
    const result = body.result as BotResult;
    const waiter = this.waiters.get(actionId);
    if (waiter) {
      clearTimeout(waiter.timer);
      this.waiters.delete(actionId);
      waiter.resolve(result);
    } else {
      await this.state.storage.put(`result:${actionId}`, {expiresAt:Date.now()+60_000,result} satisfies StoredResult);
    }
    return Response.json({ok:true});
  }
}
