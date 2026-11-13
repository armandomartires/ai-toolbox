# ADR-0064 — Each plugin has its own version and tag; releases are signed with Sigstore

**Status**: accepted
**Date**: 2026-11-11
**Task**: `TASK-0283`

Within the alignment plan item P2.4 (decisions Q11=B, Q8=D); remediation item #12 (R-07).

## Context

TASK-0272 built three plugins, all at 0.1.0 with the version written as a constant in `scripts/build-plugin.py`. A single repo tag cannot say which plugin it releases, and `ai-toolbox-agents` needs `ai-toolbox-skills` at a compatible version.

## Decision

1. **One owner for versions: `scripts/plugin-versions.json`.** It holds each plugin's `X.Y.Z` version and the dependency ranges. `scripts/build-plugin.py` writes them into `plugin.json` and into the plugin's marketplace entry.
2. **One tag per plugin: `<plugin>--v<version>`**, for example `ai-toolbox-skills--v0.1.0`. A tag names exactly one plugin at its current version.
3. **A dependency is a range, the same in `plugin.json`, the marketplace and the rule.** `ai-toolbox-agents` needs `ai-toolbox-skills` at `~0.1.0`. When the dependency moves outside the range, `scripts/check-release.py` fails until the dependent is released with a new range.
4. **`scripts/check-release.py` is the check**, run by `tests/validate.sh`. It fails on a version that differs between the three places, a missing marketplace version, a non-semver version, an unsatisfied range, or a tag that does not match.
5. **`.gitlab/ci/release.yml` runs on a plugin tag only.** It packs a reproducible tarball with a `.sha256` (`scripts/pack-release.sh`), signs it with `cosign sign-blob` (`scripts/sign-release.sh`: keyless through the GitLab OIDC token by default, or a key from `COSIGN_PRIVATE_KEY`), verifies it (`scripts/verify-release.sh`), and proves an altered and an unsigned copy fail. `release-provenance` signs a provenance statement the pipeline writes (an in-toto statement with a SLSA predicate). It is not GitLab's runner-generated attestation, so it vouches for the signing pipeline identity, not for a hardened builder. `release-publish`, which creates the GitLab release, is manual.
6. **Verification pins the exact tag pipeline.** In a tag pipeline `verify-release.sh` derives `$CI_SERVER_URL/$CI_PROJECT_PATH//.gitlab-ci.yml@refs/tags/<tag>`; elsewhere it takes `COSIGN_CERT_IDENTITY`. A regexp is accepted only anchored `^...$` and not starting with a wildcard.
7. **The repository holds no key and no identity.** The human supplies the cosign pin (`COSIGN_VERSION`, `COSIGN_SHA256`), the release-cli digest, the id_tokens setting (or a key pair), a protected tag rule `*--v*` and protected `COSIGN_*` variables. `verify-release.sh` fails closed without an identity.

## Alternatives considered

- **One lockstep version for all three plugins.** Releases would move plugins that did not change.
- **Unversioned `dependencies` names.** Cannot say which skills version the agents need.

## Consequences

- Bumping a plugin is an edit of `scripts/plugin-versions.json` followed by `scripts/build-plugin.py`.
- The tag/version match and the signature wiring are proven offline (cosign stubbed); the live Sigstore proof exists only after the first real tag.
- The dependency object form `{name, version}` in `plugin.json` is the form Claude Code documents for ranges; validate it with `claude plugin validate` when available.
