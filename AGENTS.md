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

## Reference hygiene

Reference repos / web examples are for patterns only, never source text. Never copy identifiers, strings, comments, docs, or commit messages from outside this repo. Always derive naming from this repo: `apps/*`, `packages/*`, `memory/brand/*`.

## Comment style

One insight per line, interrogation-first: `// What :: ...`, `// Why :: ...`, `// How :: ...`, `// When :: ...`, `// Where :: ...`, `// Which :: ...`, `// Note :: ...`, `// E.g. :: ...`. Keep lines brief and plain-spoken. No block comments. Tool directives (`oxlint-`, `eslint`, `@ts-`) stay as-is.

Comments whose content starts with `::` (e.g. `{/* :: Social Icons */}`) are pinned — agents leave them exactly as-is: no cleanup, rewriting, or deletion.

## Interaction log

Every agent, including subagents, writes one log file at the end of its run; never edit older logs. Path, fields and format live in the spec: `memory/agents/interaction-log.mdx`.
