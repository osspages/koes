# koes

pnpm monorepo (Node 24 via mise). Conventional commits enforced by commitlint + lefthook.

## Tooling

- `pnpm fmt` — format with oxfmt
- `pnpm lint` — lint with oxlint
- `pnpm check` / `pnpm fix` — ultracite checks and autofixes
- `pnpm fallow:health` — repo health (dead code, duplication, complexity)
- Commits follow Conventional Commits; `commit-msg` hook rejects anything else.
- Renovate (`renovate.json`) handles dependency updates.
