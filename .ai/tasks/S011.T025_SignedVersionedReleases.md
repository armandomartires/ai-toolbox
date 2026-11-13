# TASK-0283 — Signed, versioned releases (P2.4)

## Status

- Status: review
- Owner: agent
- Branch: agent/TASK-0283
- Created: 2026-11-10
- Updated: 2026-11-11
- Applies to: `.gitlab/ci/sbom.yml`, tags, marketplace versions
- Source: docs/reports/2026-11-10-alignment/ALIGNMENT-PLAN.md item P2.4 (S4), decisions Q11=B (three plugins, each versioned), Q8=D (GitLab marketplace plus the org library); related: #12 (R-07)

## Objective

Finish the supply chain: a tag and a marketplace version per plugin, Sigstore signing and SLSA provenance in the release job, and `cosign verify` in CI. With three plugins (Q11=B) the version rule must say how a dependency range is kept.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| TASK-0272 | the three plugins exist |
| .gitlab/ci/sbom.yml | SBOM only; no signing |
| remediation item #12 (R-07) | open |

## Scope

- In: a version and tag rule per plugin; marketplace versions and dependency ranges; signing and provenance in the release job; a `cosign verify` step; an unsigned-artifact negative case.
- Out: publishing to the claude.ai org library (the human's); changing what is packaged (TASK-0272).

## Likely files

- .gitlab/ci/sbom.yml
- .claude-plugin/marketplace.json
- `scripts/build-plugin.py`
- a release note under `docs/`

## Execution plan

1. Write the CI negative case: an unsigned artifact fails `cosign verify`. See it fail first with no signing.
2. Define the tag and version rule for three plugins and the marketplace.
3. Add signing and provenance to the release job.
4. Add the `cosign verify` step.
5. Run on a test tag and record the output.
6. Run `tests/validate.sh`.

## Acceptance criteria

- [x] The release job produces signed artifacts with provenance and CI runs `cosign verify` (written in `.gitlab/ci/release.yml`; not run live, see Risks)
- [x] An unsigned artifact fails verification (`tests/test-release.sh`, cosign stubbed; the release job repeats it against real cosign on a tag)
- [x] Each plugin has its own tag and version in the marketplace (`<plugin>--v<version>`, `scripts/plugin-versions.json`, ADR-0064)

## Mandatory validations

- [x] tests/validate.sh
- [ ] the release job on a test tag (NOT RUN: needs the human's signing identity and a pushed tag, both prohibited here)

## Risks and rollback

- Keyless signing needs the GitLab OIDC identity configured by the human; if it is missing, stop and report.
- Three versions in one repo can fall out of step; the rule written here is the check.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          |           |

Next:

## Execution log

- 2026-11-10 · agent/Sonnet 5.5 · brief written from the alignment plan; no work done yet
  - Evidence: none yet
  - Deviation: none
- 2026-11-11 · agent/Sonnet 5.5 · pipeline built, nothing signed, tagged or published
  - Red first: `tests/test-release.sh` written before any script; 10 FAIL (rule, tag, wiring and signed-artifact cases) with the scripts absent
  - Built: version rule (scripts/plugin-versions.json, check-release.py), ranges `~0.1.0` for agents -> skills in plugin.json and marketplace, verify-release.sh, .gitlab/ci/release.yml, docs/operations/releases.md, ADR-0064
  - Evidence: see the report of this run for the check outputs
  - Deviation: the release job is in a new `.gitlab/ci/release.yml`, not sbom.yml (sbom stays a record). The release job on a test tag and the live `cosign verify` were not run: no identity, no tag, by assignment. The `{name, version}` dependency form in plugin.json and marketplace follows Claude Code's documented range form but was not validated with `claude plugin validate`. release.yml was not parsed by a YAML tool (none installed).
- 2026-11-11 · agent/Sonnet 5.5 · review changes M1-M5, L1-L5, L7 applied; ADR renumbered to 0064
  - Verify now pins the exact tag-pipeline identity (derived, or COSIGN_CERT_IDENTITY); a regexp must be `^...$` and not a wildcard. The provenance is described as a signed statement the pipeline writes, not runner-generated; RUNNER_GENERATE_ARTIFACTS_METADATA dropped. Key mode works through sign-release.sh. release-cli image is a variable that must carry a digest (the digest itself is the human's: not fetched here).
  - `claude plugin validate` passed on plugins/ai-toolbox-agents and on the repo root with the `{name, version}` dependency form (warnings only: missing icon, README install line, category/author on mod entries)
  - Deviation: still not run on a real tag; release.yml structure is checked by tests/yamlmini.py, not GitLab's lint.
