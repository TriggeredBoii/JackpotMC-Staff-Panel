export interface Env {
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_REDIRECT_URI: string;

  SESSION_SECRET: string;

  ALLOWED_DISCORD_IDS: string;

  STAFF_PANEL_HMAC_KEY_ID: string;
  STAFF_PANEL_HMAC_KEY: string;

  STAFF_PANEL_BOT_TOKEN: string;

  STAFF_PANEL_BRIDGE: DurableObjectNamespace;

  APP_ENV?: string;

  ASSETS: Fetcher;
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

export interface SessionPayload {
  v: 1;
  sub: string;
  username: string;
  displayName: string;
  avatar: string | null;
  csrf: string;
  iat: number;
  exp: number;
}