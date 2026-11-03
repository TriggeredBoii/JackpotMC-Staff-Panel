# First setup checklist

## 1. Local

```powershell
npm install
Copy-Item .env.example .dev.vars
```

Create a Discord application, copy its Application ID and Client Secret into `.dev.vars`, add `http://localhost:5173/auth/callback` as an OAuth2 redirect, and put your Discord user ID in BOTH allowlist variables. Generate a long random session secret, then:

```powershell
npm run dev
```

Expected security tests:
- `/login` is reachable.
- `/` without a session redirects to `/login` at the Worker layer.
- `/api/me` without a session returns 401.
- A Discord ID missing from either allowlist is redirected to `/denied`.
- An allowed + linked Discord ID reaches the panel.
- Editing frontend state cannot make `/api/me` authenticate.

## 2. GitHub

```powershell
git init
git checkout -b main
git add .
git commit -m "Initial secure JackpotMC staff panel"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
git checkout -b dev
git push -u origin dev
```

Never commit `.dev.vars`.

## 3. Cloudflare test deployment

In Cloudflare: Workers & Pages -> Create application -> GitHub -> select this repo. The Worker name MUST be `jackpotmc-staff-panel`. Use `main` as production and enable preview builds for other branches. Add the production/test environment variables and secrets in Cloudflare, not Git.

For early testing, keep `staff.jackpotmc.com` unchanged and use the Worker/preview URLs. Add each exact Cloudflare OAuth callback URL to the Discord application before testing OAuth there.

## 4. Promotion

Develop locally -> feature branch -> push -> Cloudflare preview -> merge to `dev` -> test -> merge to `main` -> production deploy.

## 5. Rollback

Emergency:

```powershell
npx wrangler deployments list
npx wrangler rollback VERSION_ID
```

Then revert the bad Git commit and push `main` so Git and production agree again.
