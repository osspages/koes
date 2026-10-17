# Coder control plane on Hetzner — plan

Status: **planned, not implemented**. This document is the converged design for a
disposable, reproducible Coder control plane provisioned entirely with
Alchemy (`alchemy.run`), Hetzner-only, single user.

---

## 1. Goals

- Remote dev for multiple personal projects (`minimalpages`, `koes`, …) — one human, no team.
- Control plane runs **only when needed** (~8–10 h/day). Hetzner Cloud bills while a
  server **exists**, not while it runs — so saving money means **destroy + recreate
  daily**, not power off.
- Everything ephemeral except R2. One `alchemy deploy` rebuilds the exact same state;
  R2 backups are the only durable layer.
- Editor: Zed over SSH. Access: Tailscale only, zero public exposure.

## 2. Architecture

```
                    ┌── durable, forever ─────────────────────┐
                    │ R2 bucket: nightly pg_dump of Coder PG  │
                    └───────────────▲─────────────────────────┘
                                    │ nightly timer + pre-destroy final dump
 09:00 ──────│──────────────────────│────────────────────── 23:00 ──
             │
             │  alchemy deploy → fresh Hetzner cpx32 VM (hourly billing)
             │  cloud-init (first boot = every morning):
             │    docker → postgres → RESTORE latest dump → coder up
             │    tailscale up --ssh → dashboard on tailnet
             │
             │  workspaces = Docker containers on the same VM
             │    └─ per-project devcontainer spec from each repo (envbuilder)
             │
             └─ destroy at night: control plane + workspaces gone, billing stops

 Laptop (only client, on tailnet)
   ├─ browser → https://coder-box.<tailnet>.ts.net   (tailscale serve TLS)
   ├─ Zed     → ssh coder-box → workspace container agent
   └─ coder CLI / port-forward for dev servers
```

- Control plane = `coder` binary as a systemd unit + its Postgres container, on the host.
- Workspaces = Docker containers on that same host's Docker daemon (same fate as the VM).
- Break-glass = Hetzner Cloud Console browser-VNC (no inbound config needed).

## 3. Stack layout (`oss/coder/`)

```
alchemy.run.ts          Stack "coder", providers: Hetzner.providers(), localState
src/
  ssh.ts                Hetzner.SshKey      your public key (persistent, free)
  firewall.ts           Hetzner.Firewall    zero inbound rules → public NIC drop-all
  server.ts             Hetzner.Server      the only billed resource
  cloudinit/
    bootstrap.sh        docker, postgres, coder, rclone, tailscale — all version-pinned
    restore.sh          PG restore gate: empty datadir → fetch latest dump → pg_restore
    backup.sh           pg_dump -Fc → R2 → healthcheck ping
    coder.service       systemd unit for the control plane
    backup.timer        nightly backstop
  template/
    Dockerfile          thin base image (envbuilder)
    main.tf             Coder template: devcontainer detection + GHCR cache repo
    startup.sh          per-workspace git clone on first start
.env.local              varlock'd secrets (schema below)
```

No `Hetzner.Service`, no `Hetzner.Volume`, no Cloudflare resources — deliberately:
`Service` would require Alchemy's inbound-SSH path; nothing on this stack is durable
enough for a Volume.

## 4. Resources

| Resource | Props | Lifecycle |
|---|---|---|
| `Hetzner.SshKey("coder-admin")` | your pubkey | persistent |
| `Hetzner.Firewall("coder-lockdown")` | no inbound rules (deny all) | recreated daily |
| `Hetzner.Server("coder-box")` | `serverType: cpx32`, `image: ubuntu-24.04`, `location: nbg1`, sshKeys, firewalls, labels | **ephemeral, rebuilt daily** |
| `userData` | composed from `cloudinit/*`, < 32 KiB cap | change = server replace (the upgrade path) |

Tailscale works with zero inbound (outbound WireGuard + DERP fallback); tailnet SSH
runs on the `tailscale0` interface, which Hetzner's firewall (public NIC) never sees.

## 5. Boot sequence (cloud-init, identical every morning)

1. Base: docker + compose (pinned), rclone (R2 S3 endpoint), unattended-upgrades, sshd hardening.
2. Identity: `tailscale up --ssh --authkey=$TS_KEY --hostname=coder-box` (tagged/ephemeral key → stale nodes auto-expire).
3. Dashboard TLS: `tailscale serve https / http://localhost:3000`.
4. Postgres container (pinned `POSTGRES_VERSION`), 127.0.0.1 only.
5. Restore gate: datadir empty → `rclone copy` latest dump → `pg_restore`; else skip (same-day restarts).
6. Control plane: pinned `CODER_VERSION`, `/etc/coder/coder.env` (access URL, PG URL, telemetry off), `coder.service` after restore.
7. Backup runner + nightly timer; healthcheck ping on success.

Secrets are interpolated from varlock'd env at deploy time. They land in Hetzner's
user-data metadata — acceptable here: the only person with Hetzner project access is you.

## 6. Workspace template

- Coder Docker-provider template, thin envbuilder base.
- Real toolchain comes from each project's `.devcontainer/devcontainer.json`
  (needs adding to the projects — touches minimalpages/koes repos).
- `ENVBUILDER_CACHE_REPO=ghcr.io/<you>/devcontainer-cache` → first build slow,
  mornings after are pull-only (~1–2 min).
- Startup script clones repos; idle auto-stop 30–60 min; one workspace per project.

## 7. State partition

| Layer | Where | Survives destroy? |
|---|---|---|
| PG (users/templates/workspace defs) | R2 dumps | yes, via restore |
| Workspace code | git remotes (push before down) | yes, on push |
| Workspace containers, images, node_modules | nowhere | no, by design |
| OS/runtime/config/certs | git + varlock + cloud-init | rebuilt identical |
| Server + IPv4 | Hetzner IaC | rebuilt (IP changes) |
| `~/.coder`, Zed profile, SSH config | laptop | outside blast radius |

## 8. Lifecycle & ops scripts

```
up     = alchemy deploy → poll /healthz via tailnet → report access URL
down   = ssh coder-box backup.sh --final → confirm → alchemy destroy
plan   = alchemy plan (diff preview)
```

- `userData` change → server replace → new IP, full cloud-init re-run (designed upgrade path).
- Daily reboot/crash → restore gate skips → Coder starts on existing data.
- `down` refuses to destroy without a successful final backup + push confirmation.

## 9. Env / secrets schema (`.env.local`, varlock'd)

| Key | Source |
|---|---|
| `TAILSCALE_AUTH_KEY` | Tailscale admin (tagged, ephemeral) |
| `TAILNET_NAME` | MagicDNS suffix for access URL |
| `CODER_VERSION`, `POSTGRES_VERSION` | pins |
| `CODER_SERVER_TYPE`, `HETZNER_LOCATION` | cpx32 / nbg1 |
| `CODER_POSTGRES_USER/DB/PASSWORD` | generated once, encrypted in place |
| `R2_ACCOUNT_ID`, R2 access keys, `R2_BACKUP_BUCKET` | Cloudflare R2 |
| `BACKUP_SCHEDULE`, `BACKUP_RETENTION_DAYS`, `BACKUP_HEALTHCHECK_URL` | hc-ping style |

## 10. Not in this stack (durable things live elsewhere)

| Thing | Where | Why |
|---|---|---|
| R2 backups bucket | main `infra/` stack or one-time create | must never die with `destroy` |
| GHCR devcontainer cache | GHCR, CI-pushed | same rule |
| Workspace code | git remotes | source of truth |
| Laptop-side config | `~/.coder`, `~/.ssh/config`, Zed | outside the box |

## 11. Cost

| Item | ~Monthly |
|---|---|
| cpx32 ≈ 10 h/day @ €0.028/h | ~€8.5 |
| R2 dumps (MBs) | ~€0 |
| **Total** | **~€8.5–9** (vs ~€25 always-on; volumeless floor removed) |

## 12. Accepted trade-offs

1. Unpushed workspace edits die on `down` (mitigation: final-backup gate + push habit).
2. ~4 min morning boot + ~1–2 min first workspace start (GHCR cache-hit path).
3. Failed restore → control plane up but bare (healthcheck alert + runbook drill).
4. Session state (tmux history, running dev servers) gone nightly — inherent to all-ephemeral.

## 13. Open decisions at time of writing

1. Dashboard TLS: `tailscale serve` HTTPS (recommended) vs plain http on tailnet.
2. Backups: `pg_dump`-only vs + nightly tarball of one workspace dir ("forgot to push" guard).
3. Devcontainers: add `.devcontainer/` to each project repo (touches minimalpages/koes).

## 14. Future paths (explicitly out of scope now)

- Public surface (share/demo links, public self-hosted services) → CF Tunnel on a
  separate box — the two patterns never mix on the dev plane.
- Volume + split stacks if workspace state ever outgrows "git is the state".
- Hetzner snapshot golden image as a break-glass fast-boot (accepted drift, IaC stays primary).
- `Hetzner.Service`-hosted companion (needs inbound 22 for Alchemy's deploy key) — reopens firewall.
