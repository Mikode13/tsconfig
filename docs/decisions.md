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

## Leave the npm Trusted Publisher environment field blank

- **Decision**: The Trusted Publisher entry for this package leaves the environment field
  blank, following the central workflow's documented contract.
- **Context**: Before the first real release, npm documented the field only as
  "Environment name (optional): If using GitHub environments for deployment protection"
  and did not explain what omitting it meant for a reusable `workflow_call`. The
  `v1.0.0` release was used as the canary. Its package-scoped OIDC exchange succeeded
  with the field blank, and the final attempt published successfully with provenance.
  Earlier attempts failed later for unrelated reasons: first because
  `@semantic-release/npm` did not persist an npm credential for `npm publish`, then
  because provenance compared the lowercase repository owner against GitHub's canonical
  casing.
- **Consequences**: Leaving the field blank is now proven to work when the reusable
  release job declares a GitHub environment. Future MiKode packages should follow this
  contract unless npm changes its validation. The central workflow documentation records
  the production evidence.

  The `npm` GitHub environment in this repository remains required because the reusable
  release job declares `environment: npm`. That is unrelated to npm's own Trusted
  Publisher field.

## Match `repository.url` to the canonical GitHub owner casing

- **Decision**: `repository.url` uses the exact casing GitHub reports for the repository,
  `Mikode13`, not the lowercase `mikode13` that also resolves.
- **Context**: GitHub treats owner names case-insensitively and redirects, so the
  lowercase form worked everywhere and looked harmless. npm's provenance verification
  does not: it compares the normalized `repository.url` against the repository recorded in
  the signed attestation, and rejected the publish with
  `422 ... "repository.url" is "git+https://github.com/mikode13/tsconfig.git", expected to
match "https://github.com/Mikode13/tsconfig" from provenance`. The failure only appears
  once provenance is enabled, and only at the publish step, which is after the release tag
  has been pushed.
- **Consequences**: The casing is load-bearing and must not be "tidied" to lowercase.
  Every other MiKode package carried the same lowercase form and will hit this the first
  time it publishes with provenance.
