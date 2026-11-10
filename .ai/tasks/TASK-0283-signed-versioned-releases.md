# TASK-0283 — Signed, versioned releases (P2.4)

## Status

- Status: planned
- Owner: agent
- Branch: agent/TASK-0283
- Created: 2026-11-10
- Updated: 2026-11-10
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

- [ ] The release job produces signed artifacts with provenance and CI runs `cosign verify`
- [ ] An unsigned artifact fails verification
- [ ] Each plugin has its own tag and version in the marketplace

## Mandatory validations

- [ ] tests/validate.sh
- [ ] the release job on a test tag

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
