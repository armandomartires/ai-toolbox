# Releasing a plugin

Decision: ADR-0064. Each of `ai-toolbox-skills`, `ai-toolbox-agents` and `ai-toolbox-gates` is released on its own.

## The rule

- Versions live in `scripts/plugin-versions.json`, as `X.Y.Z`. Nothing else is edited by hand.
- The tag is `<plugin>--v<version>`, for example `ai-toolbox-skills--v0.1.0`.
- `ai-toolbox-agents` depends on `ai-toolbox-skills` by range (`~0.1.0`), written as `{"name", "version"}` objects. If you release a skills version outside that range, release agents with a new range in the same change.
- `python3 scripts/check-release.py [--tag TAG]` checks the rule; `tests/validate.sh` runs it.

## Cut a release

1. Edit the version (and range) in `scripts/plugin-versions.json`.
2. `python3 scripts/build-plugin.py` rewrites `plugins/` and the marketplace versions; commit the result.
3. `python3 scripts/check-release.py --tag <plugin>--v<version>` must pass.
4. Tag and push the tag. In `.gitlab/ci/release.yml`:
   - `release` packs `release/<tag>.tar.gz` (reproducible, with a `.sha256`), signs it (`<tag>.tar.gz.bundle`), verifies it against this pipeline's exact identity, and checks that an altered copy and an unsigned copy fail.
   - `release-provenance` signs a provenance statement the pipeline writes (`provenance.json`, an in-toto statement with a SLSA predicate). It names the tarball digest, the commit and the pipeline. It is a signed provenance statement, not GitLab's runner attestation.
   - `release-publish` is manual: running it creates the GitLab release.

## One-time setup (the human)

The repository holds no key and no identity. All of this is required:

1. **Protected tags.** Settings, Repository, Protected tags: protect the pattern `*--v*`, allowing only the people who may release. Without it any developer can push a tag and get a signature under the project identity.
2. **Protected variables.** Create every `COSIGN_*` variable (and `RELEASE_CLI_IMAGE`) as protected, and masked where the value allows it, so they exist only in pipelines on protected tags.
3. **Cosign pin.** `COSIGN_VERSION` and `COSIGN_SHA256`: the cosign release and the checksum of its linux amd64 binary from `cosign_checksums.txt`. The job fails if either is unset.
4. **Release image.** `RELEASE_CLI_IMAGE`: `registry.gitlab.com/gitlab-org/release-cli@sha256:<digest>`. A tag without a digest is refused.
5. **Identity, keyless (default).** The GitLab instance must issue `id_tokens` with audience `sigstore`. Nothing else is set: the issuer is `$CI_SERVER_URL` and the verified identity is derived as `$CI_SERVER_URL/$CI_PROJECT_PATH//.gitlab-ci.yml@refs/tags/<tag>`.
6. **Identity, key alternative.** Set `COSIGN_PRIVATE_KEY` (the key text), `COSIGN_PASSWORD` and `COSIGN_PUBLIC_KEY` (a file variable). `sign-release.sh` then signs with `--key env://COSIGN_PRIVATE_KEY` and `verify-release.sh` checks with the public key.

If the identity is missing the jobs fail; they never skip.

## Verify a download

Pin the exact tag identity; do not use a wildcard.

```bash
export COSIGN_OIDC_ISSUER='https://<gitlab-host>'
export COSIGN_CERT_IDENTITY='https://<gitlab-host>/<group>/<project>//.gitlab-ci.yml@refs/tags/ai-toolbox-skills--v0.1.0'
bash scripts/verify-release.sh ai-toolbox-skills--v0.1.0.tar.gz   # reads ...tar.gz.bundle beside it
```

An artifact with no bundle, a changed artifact, or no identity configured exits non-zero. `COSIGN_CERT_IDENTITY_REGEXP` is accepted only when written `^...$` and not starting with a wildcard; `.*` is refused.

## Not covered

The claude.ai org library is published by hand; this pipeline does not touch it.
