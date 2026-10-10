# AGENTS.md

- Package manager: pnpm (see `packageManager` in `package.json`). Never use npm/yarn.
- Runtime: Node via mise (`mise.toml`). Run `mise install` after cloning.
- Commits must follow Conventional Commits (`feat:`, `fix:`, `chore:`, … — see `commitlint.config.ts`); the lefthook `commit-msg` hook enforces this.
- Format with `pnpm fmt` (oxfmt), lint with `pnpm lint` (oxlint); pre-commit hook autofixes staged files.
- Keep `renovate.json` valid — `pnpm renovate-config-validator --strict renovate.json`.
- Check repo health with `pnpm fallow:health` before large refactors.
