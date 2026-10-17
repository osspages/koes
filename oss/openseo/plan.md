# OpenSEO self-host (Cloudflare · fork · separate CF account)

| | |
| --- | --- |
| **What?** | Self-hosted OpenSEO — SEO-data app + MCP + AI-Visibility tracker, deployed to a dedicated Cloudflare account using upstream's own Alchemy stack |
| **Why?** | Our own workspace and data (D1/KV/R2 in our account); DataForSEO billed at source — the hosted service adds a 28% fee on DataForSEO requests |
| **Where?** | `oss/openseo/` — clone of our fork lives in `open-seo/`; not `infra/`, not `oss/hetzner/` |
| **How?** | Drive upstream's pipeline from inside the clone: `pnpm deploy:selfhost --yes` (Alchemy `--stage selfhost`). No hand-rolled stack — unlike `oss/executor` — because OpenSEO ships and maintains its own |
| **Who?** | Just me; sign-in gated by an auto-provisioned Cloudflare Access application allowing exactly `ACCESS_ALLOWED_EMAILS`; one shared workspace |
| **Status?** | Plan only — not implemented (2026-10-17) |
| **Docs?** | [Cloudflare self-hosting](https://openseo.so/docs/self-hosting/cloudflare) · [repo guide](https://github.com/every-app/open-seo/blob/main/docs/SELF_HOSTING_CLOUDFLARE.md) · [operations](https://github.com/every-app/open-seo/blob/main/docs/SELF_HOSTING_CLOUDFLARE_OPERATIONS.md) · [env template](https://github.com/every-app/open-seo/blob/main/deploy/.env.selfhost.example) |

## Decided

- **Source:** fork `every-app/open-seo` on GitHub, clone the **fork**, add `upstream` remote. Deploy from a release-tag-pinned branch (`selfhost` created off `v0.1.13` — latest release, published 2026-10-14). Upgrade = merge the next tag into the branch. Pinned releases over tracking `main` matches the repo's exact-pin container posture.
- **Separate Cloudflare account** from the koes `infra/` stack: full `alchemy login` (must enable `access:write`) + `alchemy cloudflare bootstrap` into that account; one-time **R2 activation** in its dashboard (payment method on file, free tier is fine). Nothing shared with `infra/` — no D1/KV/R2/Zero-Trust overlap.
- **Minimal v1 env** (`.env.selfhost`, three values only):

  ```
  DATAFORSEO_API_KEY=<base64 of email:password>
  ACCESS_ALLOWED_EMAILS=<my email>
  OPENSEO_TELEMETRY_DISABLED=1
  ```

  No OpenRouter (in-app agent SAM stays hidden), no Google Search Console, no Context.dev, no bring-your-own Access app. Extras are redeploy-only additions (see Deferred).
- **Telemetry disabled** — matches the no-telemetry posture used for the executor deploy (`DO_NOT_TRACK=1` there; `OPENSEO_TELEMETRY_DISABLED=1` is the selfhost-stage equivalent).
- **Auth:** accept the auto-provisioned Access application. Each deploy rewrites its policy from `ACCESS_ALLOWED_EMAILS` — dashboard-visible policy edits get overwritten on the next deploy, so `.env.selfhost` is the source of truth, never the dashboard.
- **Audit JS-rendering stays rate-limited** (free plan: 1 browser action / 10 s — too slow for a crawl). Accepted for v1; escape hatches listed under Deferred.

## Verified (from upstream source + docs)

| Fact | Consequence |
| --- | --- |
| `deploy:selfhost` = `selfhost-deploy-preflight` → `vite build --mode selfhost` → `tsc --noEmit` → `alchemy deploy deploy/alchemy/alchemy.run.ts --env-file .env.selfhost --stage selfhost` (root `package.json`) | One command provisions everything; a missing key fails in preflight before workers deploy. |
| Stage `selfhost` creates fresh stage-suffixed resources (`deploy/alchemy/alchemy.run.ts`): D1 `open-seo-db-selfhost` (migrations `drizzle/sqlite`, table `d1_migrations`), R2 `open-seo-r2-selfhost` with a lifecycle rule deleting `dataforseo-cache/` objects after 7 days, KV `open-seo-kv-selfhost` + `open-seo-oauth-kv-selfhost`, main worker + `open-seo-selfhost-audit`, Access app via `emailAccessGate` | All data-bearing resources carry the `selfhost` suffix; teardown deletes exactly those. Workers named `open-seo-selfhost{-audit}` (audit name confirmed by the docs' tail command). |
| The stack deploys prebuilt Vite output — "Alchemy never runs Vite" (`alchemy.run.ts` header) | Build failures surface inside `pnpm deploy:selfhost` before any resource mutation. |
| Cron triggers come from `wrangler.jsonc`; background collection: a five-minute cron dispatches due daily/weekly/monthly AI-Visibility checks | Serverless scheduling — no host cron, nothing to keep alive. |
| `.env.selfhost.example`'s comment points at `docs/SELF_HOSTING_CLOUDFLARE_ALCHEMY.md`, which doesn't exist in `docs/` — the actual guide is `docs/SELF_HOSTING_CLOUDFLARE.md` | Follow the `SELF_HOSTING_CLOUDFLARE.md` guide; the stale template link is a doc drift, not a setup step. |
| Teardown: `pnpm alchemy destroy --env-file .env.selfhost --stage selfhost` deletes the Workers, the stage-suffixed D1/KV/R2 **including data**, and the Access application | Teardown is data-loss by design; no backup built in v1 — D1 time-travel is the in-account recovery path. |
| MCP requires **Managed OAuth** on the Access app (Zero Trust → Access controls → Applications → Edit → Additional settings → OAuth), plus allowed redirect URIs — loopback for CLI/desktop agents (`http://localhost:PORT/callback`), HTTPS (path may end `/*`) for web connectors; without it Dynamic Client Registration fails and clients log in but expose no tools. Manual dashboard step after first deploy | Claude Code / Codex plugins (and other MCP clients) connect to `https://<worker-hostname>/mcp` once enabled. |
| Prerequisites: Node ≥22.6, pnpm via `corepack enable` (upstream pins `pnpm@10.30.1` via `packageManager`), Cloudflare account with R2 open once, DataForSEO credential = the **Base64 `email:password`** value from app.dataforseo.com | Local machine qualifies (node 24, pnpm 12 — both irrelevant inside the clone, which self-manages toolchain). |
| GHCR image tags stop at `0.0.x`; the newest release is `v0.1.13` (checked via the registry API) | Irrelevant on this path — deploys build from source. (A Docker pin would have drifted; the CF path doesn't depend on published images.) |
| Log in with `pnpm alchemy login` — answer **yes** to "Customize OAuth scopes?" and enable `access:write`; a prior login without it needs `pnpm alchemy login --configure` | Access app creation is impossible without that scope; plain re-login won't re-ask. |
| New DataForSEO accounts: $1 free credit; minimum top-up $50. OpenSEO's hosted plan adds the 28% fee; self-hosted pays DataForSEO's base prices | Cost driver is DataForSEO usage, not the app. |

## Stack layout

```
oss/openseo/
├── plan.md                      # this file (committed to koes)
└── open-seo/                    # nested git repo = our fork (gitignored by koes)
    ├── .env.selfhost            # secrets — upstream's own .gitignore excludes .env.*
    ├── deploy/
    │   ├── .env.selfhost.example
    │   └── alchemy/             # upstream's stack, driven unmodified
    └── .alchemy/                # local alchemy state (upstream-gitignored)
```

Repo-side commit: `oss/openseo/plan.md` plus a koes `.gitignore` entry for `oss/openseo/open-seo/`. No `package.json`/catalog/lockfile changes; the clone installs its own lockfile under its pinned pnpm. Renovate stays out — the nested repo manages its own dependency lifecycle.

## Build-phase checklist

1. `gh repo fork every-app/open-seo` → clone the fork into `oss/openseo/open-seo/` → `git remote add upstream https://github.com/every-app/open-seo.git` → branch `selfhost` off `v0.1.13` → koes `.gitignore` entry.
2. `corepack enable && pnpm install` inside the clone.
3. In the new Cloudflare account: open the **R2** dashboard once (activates the free tier; payment method on file).
4. Inside the clone: `pnpm alchemy login` (yes to scopes, enable `access:write`) → `pnpm alchemy cloudflare bootstrap`.
5. `cp deploy/.env.selfhost.example .env.selfhost` → fill the three values from Decided.
6. `pnpm deploy:selfhost --yes` → note the printed Worker URL (Zero Trust team auto-created on first deploy, named after the account's workers.dev subdomain).
7. Validate: open the URL and complete the Access sign-in → `https://<host>/api/health` must report runtime config + database status → `pnpm exec wrangler tail` (main) and `pnpm exec wrangler tail open-seo-selfhost-audit` for errors.
8. Enable **Managed OAuth** on the Access application + redirect URIs, then point agents at `https://<host>/mcp`.

## Ops notes

- **Upgrade:** `git fetch upstream && git merge --no-ff v0.1.<n>` → `pnpm install` → `pnpm deploy:selfhost --yes`.
- **Access/add a user:** edit `ACCESS_ALLOWED_EMAILS` in `.env.selfhost`, redeploy. Dashboard policy edits are overwritten on the next deploy.
- **Login fails:** re-check `ACCESS_ALLOWED_EMAILS`, redeploy.
- **Cost:** Cloudflare free plan $0 (D1/KV/R2 free tiers comfortably cover personal use + 5-min cron; only paid Workers plans unlock the Browser Run binding). DataForSEO pay-per-use, direct — the app shows collection cost before each check or schedule starts.
- **Teardown:** `pnpm alchemy destroy --env-file .env.selfhost --stage selfhost`. Data dies with it — intentional for v1.

## Deferred (v1.x candidates)

- `OPENROUTER_API_KEY` — SAM, the in-app agent, plus AI-Visibility setup research and generated prompt suggestions (add + redeploy).
- Google Search Console — needs `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `BETTER_AUTH_SECRET` together; ~10 min Google OAuth client setup; unlocks GSC data in app and MCP tools.
- `CONTEXT_API_KEY` — renders pages Cloudflare Browser Run cannot (1 Context credit per page) for sites that block CF's browser.
- Paid Workers plan — full JS-rendering in site audits ($5/mo; 10 browser-hours included, then $0.09/h).
- Custom domain and/or bring-your-own Access app — set `TEAM_DOMAIN` + `POLICY_AUD` in `.env.selfhost`; the deploy then provisions no Access resources and `ACCESS_ALLOWED_EMAILS` is ignored.
