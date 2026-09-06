# Project decisions

A chronological log of significant decisions specific to `@mikode13/tsconfig`.
Cross-project decisions live in
[`Mikode13/engineering`](https://github.com/Mikode13/engineering).

## Enforce the package manager outside the published manifest

- **Decision**: This repository does not ship any lifecycle script whose purpose is
  enforcing that contributors use pnpm. The committed lockfile, CI, and review are the
  enforcement boundary.
- **Context**: The guard first shipped as `preinstall`, which ran for every consumer and
  hard-failed a non-pnpm install. Moving it to `prepare` fixed that, because `prepare`
  does not run for registry consumers. But npm also runs `prepare` before `npm pack` and
  `npm publish`, and the guard rejected npm's own user agent, so
  `npm pack --dry-run --json` exited 1. That is the exact command the release workflow
  runs to verify the tarball, and `npm publish` would have hit the same guard, so
  automated publication could never have completed. The package management standard
  independently forbids publishing a lifecycle script that only enforces the contributor
  package manager.
- **Consequences**: `npm install` in this repository no longer fails fast with a helpful
  message. That trade is deliberate: a local convenience is not worth a lifecycle script
  in the published manifest that blocks the release. Do not reintroduce this guard in
  `preinstall`, `prepare`, `prepack`, or any other lifecycle npm runs during pack or
  publish.

## Extend the presets by relative path inside this repository

- **Decision**: `tsconfig.json` and `tests/tsconfig.json` extend `./node.json` and
  `../node.json` rather than `@mikode13/tsconfig/node`.
- **Context**: A package cannot resolve its own name through `node_modules` in its own
  repository, so the documented consumer form does not work here. Node's self-reference
  does resolve the `exports` map, and `tests/integration` uses exactly that to verify the
  published entry points.
- **Consequences**: The repository dogfoods its own presets, and the exports contract is
  still covered, by the integration tests rather than by the local configuration.

## Verify the presets by compiling, not by inspecting options

- **Decision**: `tests/integration` compiles real consumer code against every preset,
  with positive fixtures that must compile and negative fixtures that must fail on a
  named MiKode-owned invariant. Resolution and option assertions remain as complementary
  coverage.
- **Context**: Inspecting the resolved option list cannot prove behaviour. A preset can
  report `strict: true` while a sibling option such as `strictNullChecks: false` quietly
  removes what strict is supposed to buy, and an assertion that only reads documented
  keys never notices. Compiling does notice.
- **Consequences**: The suite is slower, because it runs the real compiler many times,
  and it needs `typescript` and `@types/react` as development dependencies. Verified by
  mutation: adding `strictNullChecks: false` to `base.json` fails eight tests across all
  four presets, and removing `noUncheckedIndexedAccess` fails twelve.

## Leave the npm Trusted Publisher environment field blank for the first release

- **Decision**: The Trusted Publisher entry for this package leaves the environment field
  blank, following the pinned central workflow's documented contract. This repository is
  the canary that settles what npm actually validates.
- **Context**: npm documents the field only as "Environment name (optional): If using
  GitHub environments for deployment protection", and says nothing about what omitting it
  means. "Optional" is the usual way of expressing "no constraint when omitted", so blank
  is expected to publish successfully whether or not the token carries an environment
  claim. It does carry one: the release job is the only job in the chain that declares an
  environment, and GitHub emits the `environment` claim only when a job declares one, so
  the value is `npm`. Setting the field to `npm` was considered and rejected: it would
  only be safer under the unusual reading that a blank field requires the claim to be
  absent, and it contradicts the central contract on reasoning rather than evidence.
- **Consequences**: If the first release authenticates, blank is confirmed to work with a
  `workflow_call` setup that declares an environment, and the central README can record
  that. If it fails at the publish step, set the field to `npm`, delete the `v1.0.0` tag,
  and re-run the manual dispatch; nothing reaches npm on that path, so the version stays
  reusable. Either outcome must be written back to the central README, because every
  later MiKode package depends on the answer.

  The `npm` GitHub environment in this repository is required regardless, because the
  reusable release job declares `environment: npm`. That is unrelated to npm's own field.
