# TASK-0157 — Set and check GitLab CI variables and GitHub Actions secrets

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-11
- Updated: 2026-10-11
- Applies to: `skills/vault-secrets/`, `docs/operations/runbook.md`, WSL gate host
- Source: human request 2026-10-11 (secrets in GitLab or GitHub project variables); `ADR-0034` clause 5

## Objective

A project that declares `backend = gitlab` or `github` can now write values with `put` and confirm them by name with `check`. Until this task, both commands only said "not implemented yet".

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `vault_secrets.py` | `TASK-0156`: `put`/`check` on the CI backends exit 2; `exec` refuses them |
| `ADR-0028` | the intranet GitLab is `http://` only |
| `secrets.conf` | `gitlab_project` or `github_repo` validated by `TASK-0155` |

## Scope

- In: `put`/`check` for `github` (through `gh`) and `gitlab` (REST API); `--allow-http` for GitLab; a GitLab stub and a `gh` shim in the suite; SKILL.md and runbook.
- Out: reading CI values back (impossible on GitHub, refused on GitLab); environment scopes other than `*`; group-level variables; a live run (see Next).

## Likely files

- `skills/vault-secrets/{scripts/vault_secrets.py,SKILL.md}`, `tests/test-vault-secrets.sh`
- `docs/operations/runbook.md`, `.ai/` live files

## Execution plan

1. `put_github`: `gh secret set VAR --repo R` with the value on stdin; scrub the value from any error.
2. `check_github`: `gh secret list --json name`; compare names with `.env.example`.
3. `GitLab`: an `http://` URL is refused unless the host is loopback or `--allow-http` is given. The token comes from `GITLAB_TOKEN` or a hidden prompt.
4. `put_gitlab`: GET the key, then PUT if it exists or POST if not; `masked`, `protected` and `raw` set; the value scrubbed from errors.
5. `check_gitlab`: page through the variables, keep keys only.
6. Add T44–T49 and prove them red against `TASK-0156`'s script.

## Acceptance criteria

- [x] A GitHub value reaches `gh` on stdin and never in argv (T44).
- [x] GitLab `put` creates a masked, protected variable. A second `put` is GET then PUT, never a second create (T47).
- [x] A non-loopback `http://` GitLab is refused before any request unless `--allow-http` is given. `--allow-http` on another backend exits 2 (T46).
- [x] A rejected GitLab token names what the token needs and changes nothing (T48).
- [x] Both checks report names only. No value, including one already stored in GitLab, reaches any output (T45, T49, T15).

## Mandatory validations

- [x] tests/validate.sh (WSL)
- [x] tests/test-vault-secrets.sh against `TASK-0156`'s script (red proof)

## Risks and rollback

- **The shim and stub are not GitHub or GitLab.** They follow the documented `gh secret` and `/projects/:id/variables` behaviour. A value GitLab cannot mask (under 8 characters, or outside its charset) is rejected by GitLab itself, and its message is passed on with the value scrubbed.
- **`--allow-http` sends a GitLab token in cleartext.** It is the human's to pass, as SKILL.md rule 5 states.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `vault_secrets.py` | `put`/`check` for `gitlab` and `github`; `--allow-http` |
| `tests/test-vault-secrets.sh` | T44–T49: 105 cases |
| `vault-secrets` | 2.2.0 |
| runbook | *New project secrets*, step 5: what each CI backend needs |

Next: the human runs `put` once against a scratch GitHub repository and once against a scratch GitLab project, and records the output here.

## Execution log

- 2026-10-11 · Claude Code (Opus 5.5) · done (stub-verified; live run pending the human)
  - Evidence: `bash tests/test-vault-secrets.sh` (WSL) → `test-vault-secrets: 105/105 passed`
  - Evidence: the same suite against `git show HEAD:…/vault_secrets.py` → `83/105 passed`; every T44–T49 case fails except the `--allow-http` usage check
  - Evidence: `bash tests/validate.sh` (WSL) → `validate.sh: OK`
  - Deviation: GitLab `put` reads first (GET, then PUT or POST) instead of POSTing and retrying on 409. The intent is clearer, and a create is never retried as an update.
