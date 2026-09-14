# TASK-0027 — Spike: lint two real playbooks and choose the guard's home

## Objective
Establish two facts that later tasks are otherwise forced to assume:

1. What `ansible-lint` actually reports against real, committed playbooks
   under `profile: production`.
2. Whether the `gather_subset` guard (TASK-0031) is better implemented as
   a custom `ansible-lint` rule or as a plain `pre-commit` hook.

This is a **spike**: it produces evidence and a recommendation, not a
component. It writes nothing to the repository under study.

## Minimal context

### Why this is a numbered task and not a `SPIKE-####` file
`tests/validate.sh:456-463` reports a **failure** for any file in
`.ai/tasks/` whose name does not match `TASK-####-*.md`, deliberately, so
that a renaming scheme cannot silently disable the handover check. A
`SPIKE-0001-*.md` would break the commit gate. Weakening the gate to
accommodate a naming preference is the wrong trade, so spikes are numbered
tasks here.

### Why the lint result is unknown
In `SIGMA-infrastructure`, `.ansible-lint` sets `profile: production` and
excludes `.cache/`, `tools/`, `state/` — **not** `playbooks/`. Both the
`pre-commit` hook and CI therefore should be linting the two committed
playbooks. But `.ansible-lint:4` and `.pre-commit-config.yaml:42` both
still assert "no playbooks/roles exist yet", and `ci.yml:44` repeats it.
The config was authored (S004.T007) when nothing existed to lint, and
nobody has recorded a run against real content since the playbooks landed.

So the gate is live and **unproven**. Anything the `ansible-ops` skill
says about linting should rest on an observed result rather than on the
assumption that a configured linter passes.

### Why linting happens on a copy, and what that costs
Human decision, 2026-09-14: copy to `/tmp/opencode/`, do not lint in
place. That keeps the target repo untouched (Option (a)) but **degrades
fidelity**, and the degradation must be measured rather than glossed:

- `ansible-lint` resolves configuration from the project directory, so
  `.ansible-lint` (`profile: production`, `exclude_paths`) and
  `ansible.cfg` (`inventory`, `forks = 2`, `vault_password_file`) must be
  copied too, or the run is not comparable.
- `ansible-lint`'s syntax-check path invokes `ansible-playbook
  --syntax-check`, which **loads the inventory**. That inventory references
  `inventory/group_vars/*/vault.yml`, which is encrypted, decrypted via
  `vault_password_file = tools/vault_pass.sh`, which reads
  `ANSIBLE_VAULT_PASSWORD` from `.env`.
- **`.env` must never be copied.** So vault decryption will fail or be
  skipped in the copy, and any finding that depends on resolved group_vars
  is not trustworthy from this run.

Expected shape of the result: lint *rules* evaluate faithfully;
inventory/vault resolution degrades. **A clean result in `/tmp` must not be
recorded as evidence that the target repo's own gate passes.** That is the
"a green connection is not a validated configuration" error this repo
already paid for once (TASK-0017, where the ansible server connected and
enumerated all ten tools with `WORKSPACE_ROOT` set to a nonexistent path).

### Why the guard's home is an open question
`ansible-lint 26.8.0` (verified installed in the target's control venv)
supports `-r/--rules-dir` with `-R` to keep the built-in rules, and honours
`ANSIBLE_LINT_CUSTOM_RULESDIR`. So a custom rule is genuinely available and
is not a guess. The trade-off against a plain `pre-commit` hook is real in
both directions:

- **Custom `ansible-lint` rule**: runs wherever `ansible-lint` runs (hook,
  CI, editor, and the MCP server's own `ansible_lint` tool); understands
  playbook structure natively; but couples the guard to `ansible-lint`'s
  rule API, which is a moving upstream target.
- **`pre-commit` hook**: no upstream API coupling; trivially portable; but
  runs only at commit time and must parse YAML itself, and would **not**
  fire when an agent calls the MCP server's lint tool.

The second bullet's asymmetry is the interesting part and should decide it.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `/home/armando.martires/SIGMA-infrastructure/playbooks/capture_pve_baseline.yml` | pre-existing (that repo, S001.T003) | 116 lines; `hosts: sigsrvpve1`; `gather_facts: false`; `*_info` modules only |
| `…/playbooks/report_pve_baseline_drift.yml` | pre-existing | `hosts: localhost`; `gather_facts: false` |
| `…/.ansible-lint` | pre-existing (S004.T007) | `profile: production`; excludes `.cache/`, `tools/`, `state/`; **not** `playbooks/`; header claims no playbooks exist |
| `…/ansible.cfg` | pre-existing (S004.T007) | `inventory = inventory/production.yml`; `forks = 2`; `vault_password_file = tools/vault_pass.sh`; the capitalised `ansible_mounts` warning at `:21-48` |
| `…/inventory/production.yml` | pre-existing | Groups `pve_cluster` (→ `pve_voting`, 6 hosts), `domain_controllers`, `network_devices` |
| `…/.env` | pre-existing | **Exists, mode 600, and must NOT be read or copied** |
| Control venv `~/.venvs/sigma-ansible` | pre-existing (that repo) | `ansible-lint 26.8.0`, `ansible-core 2.20.8`; verified this session |
| `/tmp/opencode/` | pre-approved scratch | Exists; pre-approved for work outside the workspace |

**Verify the expected state; don't assume it.** Re-confirm the venv's
`ansible-lint --version` and that `.env` is still present-but-untouched
before starting. Note the venv emits a `WARNING: PATH altered` line when
invoked directly — expected, not a failure.

## Scope

### Included
- Copy `playbooks/`, `ansible.cfg`, `.ansible-lint`, and
  `inventory/production.yml` into a fresh `/tmp/opencode/` tree.
- Run `ansible-lint` there using the target's own venv binary; capture
  full output and exit code verbatim.
- Record explicitly which checks evaluated faithfully and which degraded
  because vault/`.env` was deliberately absent.
- Recommend the guard's home, with the reasoning, for ADR-0016/TASK-0031.
- Confirm that both playbooks already satisfy the `gather_subset` rule
  (both are `gather_facts: false`), which makes them the negative fixtures
  TASK-0031 needs — the guard must stay silent on them.

### Not included
- **Any write to `SIGMA-infrastructure`.** Not even a cache file. Verify
  with `git status` there before and after.
- Reading, copying, or printing `.env`, `tools/vault_pass.sh` output, or
  any `vault.yml` plaintext.
- Fixing the four stale claims found there. Recorded by TASK-0032, fixed
  nowhere.
- Implementing the guard. TASK-0031.
- Running any playbook, in any mode, including `--check`. This spike lints
  and syntax-checks only; nothing may touch the live estate.

## Likely files
- `/tmp/opencode/ansible-lint-spike/` — scratch, not committed
- `.ai/tasks/TASK-0027-spike-lint-real-playbooks.md` — this file's
  execution log carries the findings
- Possibly a short evidence file under `.ai/` if the output is too long for
  the log; decide at execution time rather than pre-creating one

## Execution plan
1. `git status --short` in `SIGMA-infrastructure`; record it verbatim as
   the before-state (expect 42-ahead, and whatever untracked files exist).
2. Create `/tmp/opencode/ansible-lint-spike/`. Copy in `playbooks/`,
   `ansible.cfg`, `.ansible-lint`, `inventory/production.yml`. **Do not
   copy `.env`, `tools/`, or any `vault.yml`.**
3. Confirm by listing the copy that no secret material came across.
4. Run the venv's `ansible-lint` in that directory. Capture stdout,
   stderr, and exit code.
5. Classify every finding: real rule violation / artifact of the missing
   vault or inventory context / artifact of the copy's structure.
6. Re-run with `--version` and note the rule count, so a future re-run can
   detect an upstream rule-set change.
7. Establish whether a custom rule directory loads at all:
   `ansible-lint -r <dir> -R` with a trivial no-op rule. This is a
   feasibility probe for TASK-0031, not the guard itself.
8. Write the recommendation (custom rule vs `pre-commit`) with reasoning,
   including the MCP-lint-tool asymmetry.
9. `git status --short` in `SIGMA-infrastructure` again; confirm
   byte-identical to step 1.
10. `bash tests/validate.sh` in `ai-toolbox` — this task edits only its own
    brief, so the gate should be green throughout.

## Acceptance criteria
- [ ] Full `ansible-lint` output and exit code recorded verbatim in the
      execution log
- [ ] Every finding classified as real / vault-artifact / copy-artifact
- [ ] The fidelity limitation is stated explicitly: a clean run here is
      **not** evidence that the target repo's gate passes
- [ ] It is confirmed and recorded that both playbooks are
      `gather_facts: false`, making them TASK-0031's negative fixtures
- [ ] A recommendation for the guard's home, with reasoning, sufficient for
      ADR-0016 to cite
- [ ] Custom-rule-directory loading is confirmed working or not, by
      observation
- [ ] `git status` in `SIGMA-infrastructure` is byte-identical before and
      after
- [ ] No secret material was copied, read, or printed

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed) — **not expected**;
      this task adds no component

## Risks and rollback
- **Risk: treating a clean `/tmp` result as proof.** The single most likely
  failure of this spike. Mitigated only by writing the limitation into the
  acceptance criteria, which is why it is there.
- **Risk: accidentally writing to the target repo.** `ansible-lint` can
  write `.ansible-lint-ignore` with `--generate-ignore`, and caches
  elsewhere. Never pass that flag; run only inside `/tmp/opencode/`; verify
  with `git status` afterwards.
- **Risk: leaking a secret into the log.** A failing syntax check can echo
  inventory content. Redact before recording, and never copy `.env`.
- **Risk: the copy's syntax check fails for a structural reason** (missing
  `group_vars/`) and is misread as a playbook defect. Step 5 exists for
  this.
- **Rollback:** nothing to roll back. `/tmp/opencode/` is scratch; the only
  committed change is this brief's execution log.

## Outputs / handover

**Intended end state — this task has not run.** The table below is a plan.
`validate.sh` requires this section non-empty for briefs ≥ 0020 and cannot
distinguish an intention from a state (ADR-0012 Decision 3), so this
sentence does it.

| Artifact | Intended end state |
|----------|-------------------|
| This brief's execution log | Verbatim lint output, exit code, per-finding classification, the stated fidelity limitation, and the guard-home recommendation |
| `SIGMA-infrastructure` | **Byte-identical to before**, proven by `git status` twice |
| `/tmp/opencode/ansible-lint-spike/` | Scratch; may be left or removed, never committed |
| TASK-0031's fixture set | Two confirmed negative fixtures identified (both playbooks are `gather_facts: false`) |

**Next task starts here**: ADR-0014 and ADR-0015 can be written against an
observed lint result rather than an assumed one, and TASK-0031 knows
whether its guard is an `ansible-lint` rule or a `pre-commit` hook.

Deviation to watch for: if the custom-rule probe (step 7) fails, ADR-0016's
expected outcome is unchanged but TASK-0031's implementation shape is
forced to `pre-commit`. Record that clearly — TASK-0031 is scoped against
the recommendation, not against a free choice.

## Status
- Status: planned
- Owner: agent
- Created: 2026-09-14
- Updated: 2026-09-14

## Execution log
### Attempt 1
- Date:
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
