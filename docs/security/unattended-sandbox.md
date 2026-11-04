# Unattended runs in a sandbox — Level 1 (issue #11)

Decision (Armando, 2026-11-04): *"Have Daneel do Level 1 now and leave the MR
open for me."*

## What Level 1 is

| Before | Level 1 |
|---|---|
| Runs on the dev host | Runs as the `unattended-run` CI job in a throwaway container on runner 3 (tag `docker`) |
| User's home, SSH keys, Vault token available | No home mount, no host credentials; `scripts/sandbox/assert-sandbox.sh` refuses to start otherwise |
| Long-lived AppRole credential file on disk | Per-job GitLab ID token (`id_tokens`, JWT) exchanged for a 10-minute, read-only Vault token, revoked after the fetch |
| Open egress | **Still open** — see the gap below |

Files:
- `.gitlab/ci/unattended-sandbox.yml` — `sandbox-selfcheck` (every MR/master pipeline, no secrets) and `unattended-run` (master only, `UNATTENDED_RUN=1`, schedule or manual).
- `scripts/sandbox/assert-sandbox.sh` — container, home-mount and credential checks.
- `scripts/sandbox/vault-fetch.py` — JWT login, KV v2 read of `UNATTENDED_SECRETS`, token revoke. Refuses paths outside `ai-toolbox/` and any `operator/` path.
- `sandbox/vault/ai-toolbox-unattended.hcl` — **proposed** policy `ai-toolbox-unattended-ro`: read on `sigmarecon-projects/data/ai-toolbox/*`, read/list on metadata, explicit `deny` on `operator/*` (and the `operator/` paths under the mount).
- `sandbox/vault/jwt-role-ai-toolbox-unattended.json` — **proposed** role on `auth/jwt-gitlab`: bound to project 17, `master`, protected ref; no default policy; TTL 10m, max 15m.
- `scripts/check-sandbox-ci.py` — static checks, run by `tests/validate.sh`.

JWT was chosen over an AppRole: there is no `secret_id` to store on the runner,
and the binding to project, branch and protected ref is enforced by Vault.

## Runner 3 requirements (runner config, not in this repo)

`config.toml` for runner 3: `privileged = false`; `volumes` must not include a
host home path, `/var/run/docker.sock` or any credential directory (only
`/cache`); no host `environment` entries carrying tokens. `sandbox-selfcheck`
fails if these are violated.

## Egress-filter gap

Issue #11 asks for an egress allowlist. Level 1 does **not** filter egress: a
job on runner 3 can reach any host the runner's Docker network can. This gap is
governed by **ADR 0020 (runner/CI security), clauses 3-4, in the
`sigmarecon/sysadmin/infrastructure` repository**. Clause 4 is the deferred
egress filter. (Not this repository's ADR-0020, which is about the LM Studio
client. The ai-toolbox bot token cannot read the infrastructure repository, so
this is cited by repository and ADR number rather than linked to a file.)
The egress acceptance criterion of #11 stays **open**. Until an egress filter exists (Level 2: a
dedicated Docker network with an allowlisting proxy, or host firewall rules
for the runner's bridge), a compromised run can exfiltrate whatever secrets it
was given. Mitigations in Level 1: secrets are scoped read-only to
`ai-toolbox/*`, `operator/*` is denied, tokens live 10 minutes, and only
only the `unattended-run` job (protected environment `unattended`, a schedule or
manual run on protected `master`) can obtain one.

## Secrets in logs and artifacts

GitLab masks only CI/CD variables. Values fetched from Vault are **not**
masked, so anything the driver or agent prints, and the `.ai/sessions/` and
`.ai/handover*` artifacts (kept 30 days), could contain them. Level 1 limits this:

- `vault-fetch.py` writes its exports to a file on `/dev/shm`. The job checks
  its exit status (no `eval "$(...)"`, which fails open), sources the file and
  deletes it.
- After the driver, `scripts/sandbox/scrub-artifacts.sh` searches the artifact
  paths for every fetched value and deletes any file that contains one. The job
  then fails, so the leak is noticed.
- Job logs are not scrubbed. Keep `UNATTENDED_SECRETS` to the minimum the run
  needs. Moving secrets out of the agent's environment (files read only by the
  tool that needs them) is Level 2.
- `CI_JOB_TOKEN`, `XAI_API_KEY` and `OPENAI_API_KEY` are unset before the
  driver starts, and `assert-sandbox.sh` fails if they are set.

## Apply steps (Armando, by hand)

0. **Fix infra #96 first** (unmanaged changes to Vault policy), so this policy
   is applied through the managed path rather than added to the drift.
1. Enable JWT auth for GitLab if not already present:
   `vault auth enable -path=jwt-gitlab jwt` and
   `vault write auth/jwt-gitlab/config oidc_discovery_url=https://<gitlab-host> bound_issuer=https://<gitlab-host>`.
2. `vault policy write ai-toolbox-unattended-ro sandbox/vault/ai-toolbox-unattended.hcl`
   (confirm `sigmarecon-projects` is KV v2; adjust the `data/`/`metadata/` prefixes if not).
3. `jq 'del(._comment)' sandbox/vault/jwt-role-ai-toolbox-unattended.json | vault write auth/jwt-gitlab/role/ai-toolbox-unattended -`
   (set `bound_audiences` and the job's `id_tokens.aud` to the same value).
4. Create the protected environment `unattended` (Settings > CI/CD >
   Protected environments) with Armando as the only deployer. The Vault role
   binds `environment`, `environment_protected` and `pipeline_source`.
5. Set CI/CD variable `VAULT_ADDR` (project 17) and `UNATTENDED_SECRETS`.
6. Check runner 3's `config.toml` against the requirements above.
7. Run a manual pipeline on master with `UNATTENDED_RUN=1 UNATTENDED_DRY_RUN=1`;
   that is the documented run for the acceptance criterion. Then add a schedule.

## Rollback

- Repo: revert the merge commit; nothing else references these files.
- Vault: `vault delete auth/jwt-gitlab/role/ai-toolbox-unattended`,
  `vault policy delete ai-toolbox-unattended-ro`, and
  `vault auth disable jwt-gitlab` only if step 1 enabled it.
- GitLab: delete the schedule and the `VAULT_ADDR`/`UNATTENDED_SECRETS` variables.
