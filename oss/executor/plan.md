# Executor self-host (Docker · Hetzner · Alchemy)

| | |
| --- | --- |
| **What?** | Self-hosted Executor — one container (API + MCP + auth + app runtime + dashboard) over an embedded PGlite database |
| **Why?** | Our own infrastructure: accounts, credentials and keys stay on our VM |
| **Where?** | `oss/executor/` — its own stack workspace; not `infra/`, not `oss/hetzner/` |
| **How?** | Alchemy from this repo: provision a Hetzner VM, then drive Docker over a declared SSH `Docker.Context` (`RemoteImage` → `Volume` → `Container`) |
| **Who?** | Just me; loopback-only access through an SSH tunnel, first-run browser setup makes me owner |
| **Status?** | Plan only — not implemented yet (2026-10-17) |
| **Docs?** | [Self-host with Docker](https://executor.sh/docs/run/self-host) · [Alchemy Docker provider](https://alchemy.run/docker) · [Alchemy Hetzner provider](https://alchemy.run/hetzner) |

## Decided

- **Deploy target:** Hetzner Cloud VM provisioned by Alchemy (same provider/model as `oss/hetzner`), dedicated to Executor.
- **Management:** everything via Alchemy from this repo. The VM via `Hetzner.Server`, the container via the Docker provider driving a declared SSH `Docker.Context` — no manual `docker run` and no login on the server.
- **Exposure:** loopback only. Port 4400 binds `127.0.0.1` on the VM; reach it with an SSH tunnel (`ssh -N -L 4400:127.0.0.1:4400 root@<ipv4>`). `BETTER_AUTH_URL` stays unset so the default origin `http://localhost:4400` matches through the tunnel.
- **Users:** just me. Complete first-run setup in the browser; first finisher becomes owner, org auto-created.
- **Analytics:** `DO_NOT_TRACK=1`.
- **Image:** `ghcr.io/usefulsoftwareco/executor-selfhost:2.0.0-beta.24` — pinned exact tag, never the floating `:beta` (AGENTS.md container rule). `alwaysPull: false` so redeploys don't re-pull.

## Verified (from installed `alchemy@2.0.0-beta.81` source + Executor docs)

| Fact | Consequence for the stack |
| --- | --- |
| Executor self-host is one container: API + MCP + auth + app runtime (workerd) + dashboard over embedded PGlite. No separate DB/queue/proxy. | Only `Server` + 3 Docker resources needed. |
| Hetzner `Server` has no cloud-init/userdata hook. | Install Docker via a deploy-time `Hetzner.Ssh(server).exec(...)` Effect: `command -v docker || curl -fsSL https://get.docker.com \| sh` (idempotent, runs each deploy). |
| `Docker.Context` is a declarative resource (`docker: "host=ssh://root@<ip>"`); every Docker resource takes a `context` prop. | The remote box is a resource, not a manual `docker context create` step. |
| `Container.ports` → `-p` builds `${external}:${internal}/${proto}`, and `external: "127.0.0.1:4400"` passes through unchanged (random-port check is `parseInt === 0`). | `external: "127.0.0.1:4400", internal: 4400` gives the docs' loopback-only binding. |
| All persistent state lives in the named data volume at `/app/data` (embedded DB, app builds, generated `auth-secret.key` + `encryption.key`). Keys regenerate nothing; startup **fails** if a saved key is missing/invalid for an existing DB. | One named volume, never change its props after it holds data; volume is the thing to back up. |
| Motel telemetry sits separately at `/app/motel-data` and is discarded when the container is replaced. | Optional second volume — skip in v1 (traces are disposable). |
| Bucket: `EXECUTOR_APP_WORKERS` default 64 workers each hold memory; docs advise tuning per machine size. | Set `EXECUTOR_APP_WORKERS=16` (single user, small VM). |

## Stack layout

```
oss/executor/
├── PLAN.md            # this file
├── package.json       # @oss/executor; scripts plan/deploy/destroy → alchemy … --profile cloud (match oss/hetzner)
├── alchemy.run.ts     # Stack("executor", { providers: Layer.mergeAll(Hetzner.providers(), Docker.providers()), state: Alchemy.localState() })
└── src/
    ├── server.ts      # Hetzner.SshKey (same public key as oss/hetzner) + Box = Hetzner.Server("executor", { serverType: "cx23", image: "ubuntu-24.04", location: "nbg1", sshKeys: [Key] })
    └── docker.ts      # ordered resources below
```

Docker resources in `src/docker.ts`, resolved in dependency order:

1. **Bootstrap** — `Hetzner.Ssh(Box)` exec: install Docker/systemctl enable (idempotent check → `get.docker.com`), using the provider-managed deploy key.
2. **`Docker.RemoteImage("executor", …)`** — pinned tag above, `context` = the remote context.
3. **`Docker.Volume("executor-data", …)`** — named volume (or `hostPath` dir; named volume preferred — survives replacements).
4. **`Docker.Context("vps", { docker: "host=ssh://root@${Box.ipv4}" })"` — the remote engine resource.
5. **`Docker.Container("executor", …)`** — image + volume mount (`/app/data`) + `ports: [{ external: "127.0.0.1:4400", internal: 4400 }]` + `restart: "unless-stopped"` + `start: true` + env `DO_NOT_TRACK: "1"`, `EXECUTOR_APP_WORKERS: "16"`.

Environment: everything else default — `BETTER_AUTH_URL` unset (tunnel origin matches default), auth/encryption keys generated on first boot and persisted in the volume, no `EXECUTOR_APPS_ALLOW_PRIVATE_FETCH`, no public catalog URL (Add app lists only the built-in Executor app until we wire the official feed).

Outputs: `server.ipv4` (+ tunnel hint).

## First-boot flow (manual, after `alchemy deploy`)

1. `pnpm --filter @oss/executor deploy` (or `alchemy deploy --profile cloud` from `oss/executor`).
2. Tunnel: `ssh -N -L 4400:127.0.0.1:4400 root@<ipv4>` (local key; the Hetzner `SshKey` above).
3. Open `http://localhost:4400` → complete first-run setup. MCP endpoint is `<origin>/mcp`; connect agents per [MCP clients docs](https://executor.sh/docs/mcp-clients).

## Ops notes

- **Backup (before every upgrade):** snapshot the data volume —
  `ssh root@<ip> 'docker run --rm -v <executor-data-volume>:/data -v /backup:/backup alpine tar czf /backup/executor-data-$(date +%F).tgz -C /data .'`
  Losing it loses auth keys + credential encryption — restore it exactly; do not let a re-deploy mint new keys for a populated DB.
- **Upgrades:** bump the pinned `RemoteImage` tag to the next exact version → Alchemy replaces the container (delete-first per provider docs), volume persists. Pending item: check whether Renovate can manage floating `ghcr.io` digests in `.ts` — if yes, automate as PRs; until then, manual bumps following Executor releases.
- **Teardown:** `alchemy destroy` removes box + container + volume (data loss). Only for full teardown intent.
- **Server resize later:** serverType changes are painful on Hetzner; decide size at creation. `cx23` should be fine for a single user with `EXECUTOR_APP_WORKERS` lowered; bump to a 4 vCPU type if worker pressure shows.

## Known trade-offs (accepted for v1)

- No public origin: browser sign-in and dashboard work via tunnel, but OAuth account-connect flows that need `<origin>/api/oauth/callback` publicly reachable may fail. If needed later: Tailscale/Funnel or a v1.1 dedicated `Hetzner.Firewall` + reverse proxy with a domain.
- No container healthcheck v1 (unknown shell tooling inside image); Railway docs use `/health` — can add a healthcheck after verifying the image.
- Docker volume lives on the VM root disk — a destroyed/replaced *server* loses it (Hetzner `Volume` attachment would need a restructure; backups cover this expectation).

## Repo-conformance (per AGENTS.md)

- Add deps via `pnpm add --save-exact` inside `oss/executor` (`alchemy`, `effect`, `@effect/platform-*` already covered by `catalog:` — reuse `workspace:*`, add no new dead catalog entries), then `pnpm install --lockfile-only`.
- No package.json scripts for Docker; no new `allowBuilds` entries (existing `workerd: true` covers future local dev if needed).
- Exact pins only; locking happens in the lockfile; Renovate owns upgrades.
