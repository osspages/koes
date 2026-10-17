<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

## pnpm catalogs (`pnpm-workspace.yaml`)

- 1 use → inline version.
- 2+ uses → default `catalog:`.
- Related + same version + shared → named `catalogs:<name>`.
- No dead entries, no single-entry named catalogs.
- After changes: `pnpm install --lockfile-only`.

## Dependencies & supply chain

Source of truth: exact pins + `pnpm-lock.yaml`. No drift.

- Exact `1.2.3` only. No `^`/`~`/`*`/ranges. `package.json`: exact, `catalog:`, `catalog:<name>`, `workspace:*` only.
- Add: `pnpm add --save-exact` (`.npmrc` sets `save-exact=true`).
- Install: `pnpm install --frozen-lockfile` everywhere. Never bare `install`/`update`.
- Upgrades: Renovate only. Lockfile committed.
- Cooldown: 3d patch + dev-minor (automerge), 5d prod-minor (review), 7d catalog runtime, majors manual.
- Batching: Monday batch, ~3 branches max.
- Security: `vulnerabilityAlerts` bypass schedule, merge anytime with 1 review.
- Builds: `allowBuilds` deny-by-default — do not extend without review.
- Containers: exact tag + digest, no `:latest`/floating majors.

Agent: DO frozen installs + Renovate PRs. NEVER hand-edit versions, widen ranges, add build scripts, float tags.
