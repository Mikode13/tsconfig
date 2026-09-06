# AGENTS.md

## What this repository is

`@mikode13/tsconfig` is the executable implementation of the MiKode
[TypeScript standard](https://github.com/Mikode13/engineering/blob/main/standards/typescript.md),
accepted in
[ADR 0005](https://github.com/Mikode13/engineering/blob/main/adr/0005-use-strict-shared-typescript-configuration.md).
It publishes four TypeScript configuration presets and nothing else: `base.json`,
`node.json` and `browser.json` (both extending base), and `react.json` (extending
browser).

## Constraint specific to this repository

The published presets are policy, not preference. The TypeScript standard documents the
exact compiler options each preset must contain, so this repository and that document
must agree exactly. Changing a preset here without changing the standard silently forks
policy from its implementation.

A consuming project may tighten strictness locally, but never weaken a base option.
Weakening one is not a project-level exception; it requires a new or superseding ADR.

## Why there is no TypeScript source

This repository publishes configuration, not code, so it has no `src/`, no build, and no
production `tsconfig.json`. TypeScript and Vitest are present only to verify the
configuration that ships: `tests/integration/` resolves each published entry point and
asks the real compiler what the preset actually produces. `tests/tsconfig.json` extends
`../node.json` by relative path rather than by package name, because a package cannot
resolve its own name through `node_modules` in its own repository.

## Local validation

```sh
pnpm install --frozen-lockfile
pnpm run check      # prettier --check, eslint --max-warnings 0, tsc --noEmit
pnpm test           # compile fixtures and preset resolution, fully offline
pnpm run pack:check # asserts the exact published file set
```

`pre-push` runs `pnpm run check && pnpm test`. CI repeats both and adds `pack:check`.

### Hazards

- Never add package-manager enforcement to a lifecycle script that npm runs during
  `pack` or `publish`. One did, and it broke publication outright; see
  [`docs/decisions.md`](docs/decisions.md).
- Changing a preset changes published policy. The compile fixtures in
  `tests/integration/` will fail if a preset stops enforcing a MiKode-owned invariant,
  and the TypeScript standard must be updated in the same change.

## Engineering standards

This repository follows the active standards in
[`Mikode13/engineering`](https://github.com/Mikode13/engineering/blob/main/standards/README.md).
Do not duplicate their content here; read them there when a change touches package
management, TypeScript, code quality, formatting, git workflow, testing, publication, or
CI.

## Releases

Publication is automated. `package.json` stays at `0.0.0-development` in source control;
semantic-release calculates the real version from Conventional Commits and publishes it
through npm Trusted Publishing after the required CI result passes on `main`. Never hand-
edit the version or publish manually.
