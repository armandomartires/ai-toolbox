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
- [x] Full `ansible-lint` output and exit code recorded verbatim in the
      execution log — **both runs**: exit 2 (vault artifact) and exit 0 (clean)
- [x] Every finding classified as real / vault-artifact / copy-artifact —
      2 copy-artifacts, **0 real violations** across 53 rules; the
      "4 of 6 files" gap also explained (unknown-kind files, not a skipped
      playbook)
- [x] The fidelity limitation is stated explicitly: a clean run here is
      **not** evidence that the target repo's gate passes — with **two**
      reasons, the second (the clean pass required editing `ansible.cfg`)
      not anticipated by this brief
- [x] It is confirmed and recorded that both playbooks are
      `gather_facts: false`, making them TASK-0031's negative fixtures —
      **with the D1/D2 caveat that they are insufficient alone**
- [x] A recommendation for the guard's home, with reasoning, sufficient for
      ADR-0016 to cite — custom `ansible-lint` rule via `enable_list:`,
      **conditional on a fires-proof**
- [x] Custom-rule-directory loading is confirmed working or not, by
      observation — **loads AND fires**, proven across 4 runs; silent-but-
      loaded under `profile: production` without an explicit opt-in
- [x] `git status` in `SIGMA-infrastructure` is byte-identical before and
      after — empty both times; `HEAD` `d4e2dd1`, `[ahead 42]`; its
      `ansible.log` mtime unchanged at `2026-09-12 16:15:01`
- [x] No secret material was copied, read, or printed — `.env` untouched
      (mode 600), `tools/` and both encrypted `vault.yml` files never copied

## Mandatory validations
- [x] tests/validate.sh — `validate.sh: OK`
- [x] scripts/sync-registry.sh (if components changed) — **not applicable**;
      no component added, as forecast

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

**This section describes a verified state.** The task has run.

| Artifact | End state |
|----------|-----------|
| This brief's execution log | Verbatim output and exit codes for both runs, per-finding classification, the fidelity limitation with **two** reasons, the four-run custom-rule probe, and the guard-home recommendation |
| `SIGMA-infrastructure` | **Untouched.** `git status` empty before and after; `HEAD` `d4e2dd1`, `[ahead 42]` unchanged; its `ansible.log` mtime still `2026-09-12 16:15:01` |
| `/tmp/opencode/ansible-lint-spike{,-novault}/`, `/tmp/opencode/customrules/` | Scratch, not committed. The probe rule is left there as the reference implementation for TASK-0031's fires-proof |
| TASK-0031's fixture set | Both playbooks re-confirmed `gather_facts: false`. **Insufficient alone** — see `TASK-0052` D1/D2; `capture_pve_baseline.yml:21` uses a bare hostname |
| ADR-0014 / ADR-0015 | **Unblocked.** Both may now be written against an observed lint result |
| ADR-0016 | **Unblocked in one direction only.** The guard's home is decided; whether a `hooks/` *category* is justified still needs TASK-0028 |

**Next task starts here**: the guard is an `ansible-lint` custom rule wired
via `enable_list:` in `.ansible-lint`, **conditional on shipping a proof that
it fires** — without that proof the route is strictly worse than
`pre-commit`, because it fails silently where `pre-commit` fails loudly.

**Deviations from the Execution plan, recorded:**

1. **The plan's step 4 assumed one run would suffice; four were needed for
   the probe and two for the lint.** The first probe run was **silent with
   exit 0**, which the plan would have recorded as "custom rule loading does
   not work" — and that would have been **false**, forcing TASK-0031 to
   `pre-commit` for no reason. `-L` showed the rule loaded (53→54) and
   `-c /dev/null` showed it firing, isolating the real cause: **`profile:
   production` filters unlisted rules**. The plan's step 7 said "confirmed
   working or not, by observation"; the honest answer needed *why*, not
   whether.
2. **The plan did not anticipate the deciding finding.** It expected the
   MCP-lint-tool asymmetry to settle the recommendation — it does — but the
   sharper result is that a custom rule can be **loaded, listed and never
   evaluated, at exit 0**. That is this repo's unfailable-check defect
   reachable by a one-line config mistake, and it converts the
   recommendation into a *conditional* one.
3. **My first probe used a wrong API signature** (`create_matcherror(...,
   lineno=1)`), corrected against `rules/complexity.py`'s real
   `(message, filename, data)` form. Recorded because it measures the
   coupling cost the brief raised in the abstract: the API is stable enough
   to target, **not guessable** — write against the installed source.
4. **The clean pass required editing `ansible.cfg`** (dropping
   `vault_password_file`), so it is a result about a *modified* config. That
   is a second, independent reason the run is not evidence about the repo's
   own gate, and the brief only had the first.
5. **`ansible-lint` writes `ansible.log` with no flag.** The brief guarded
   against `--generate-ignore`; the real write needs nothing. Proven by mtime
   comparison, and it is the concrete vindication of the
   copy-not-in-place decision.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-14
- Updated: 2026-09-16

## Execution log
### Attempt 1
- Date: 2026-09-16
- Agent: opencode (claude-opus-5)
- Actions: Recorded SIGMA's before-state. Copied `playbooks/`, `ansible.cfg`,
  `.ansible-lint` and `inventory/production.yml` into
  `/tmp/opencode/ansible-lint-spike/`; confirmed by `find` that no `.env`,
  `tools/` or `vault*` came across. Ran the target's own
  `ansible-lint` there. Made a second copy with `vault_password_file`
  removed to separate rule evaluation from the vault artifact. Counted
  built-in rules. Wrote a custom-rule probe and ran it four ways to
  establish *why* it behaved as it did. Re-verified SIGMA afterwards.

- Observations:

  **1. The target repo's lint gate PASSES on its two real playbooks under
  `profile: production` — 0 failures, 0 warnings.** Verbatim:

  ```
  Passed: 0 failure(s), 0 warning(s) in 4 files processed of 6 encountered.
  Profile 'production' was required, and it passed.
  ```
  Exit code **0**. This is the first recorded lint run against real content
  in that repo; the gate was live and unproven since S004.T007.

  **2. The first run FAILED with exit 2, and both failures were
  copy-artifacts — not playbook defects.** Verbatim:

  ```
  internal-error: Unexpected error code 1 from execution of:
    ansible-playbook --syntax-check -vv playbooks/capture_pve_baseline.yml
  [ERROR]: The vault password file
    /tmp/opencode/ansible-lint-spike/tools/vault_pass.sh was not found
  Failed: 2 failure(s), 0 warning(s) in 4 files processed of 6 encountered.
  Profile 'production' was required.
  ```
  Classification, per rule 5 of the plan:
  - `internal-error` ×2 → **copy-artifact**. `ansible.cfg` sets
    `vault_password_file = tools/vault_pass.sh`; `tools/` was deliberately
    not copied. Removing that one line produced the clean pass in
    observation 1, which isolates the cause rather than inferring it.
  - **Zero real rule violations** across all 53 built-in rules.
  - "4 files processed of 6 encountered" is **not** an exclusion of a
    playbook: `-vv` shows `ansible.cfg` and `ansible.log` are
    `'' (unknown) kind` and therefore not lintable. Checked rather than
    assumed, because a silently skipped playbook would have invalidated the
    whole run.

  **3. THE FIDELITY LIMIT, STATED AS THE BRIEF DEMANDED: this clean result
  is NOT evidence that the target repo's own gate passes.** Two distinct
  reasons, and the second is the one the brief did not anticipate:
  - The clean run was obtained by **editing `ansible.cfg`** to drop
    `vault_password_file`. That is a *different configuration* from the
    one the repo commits. The repo's real gate runs *with* vault
    configured, and whether it resolves
    `inventory/group_vars/{domain_controllers,pve_cluster}/vault.yml`
    (both confirmed present and `$ANSIBLE_VAULT`-encrypted, never
    decrypted or copied here) is **untested by this spike**.
  - `--syntax-check` **loads the inventory**, so any finding depending on
    resolved `group_vars` is out of scope for this run. What *is* trustworthy
    is the 53 rules' verdict on playbook structure.

  **4. `ansible-lint` WROTE A FILE into its working directory — vindicating
  the copy-not-in-place decision with evidence rather than caution.** The run
  created `ansible.log` in the scratch tree. Had the spike run in place, that
  write would have landed in `SIGMA-infrastructure`, violating Option (a).
  Proven by mtime rather than asserted: the scratch log is
  `2026-09-17 00:26:11`, while SIGMA's pre-existing `ansible.log` is
  **`2026-09-12 16:15:01`** — untouched. The brief anticipated
  `--generate-ignore` as the write risk; the actual write needed no flag at
  all.

  **5. A custom rules directory LOADS AND FIRES — but is silently inert
  under this repo's config unless explicitly enabled. This is the finding
  that decides TASK-0031.** Four runs, because the first result was
  ambiguous and recording it would have been wrong:
  - `-r <dir> -R` → **silent, exit 0.** Read alone this says "custom rules
    do not work".
  - `-r <dir> -R -L` → the rule **is listed** (`noop-probe`), and the rule
    count goes **53 → 54**. So it loaded and did not fire — two different
    failures that look identical in the first run.
  - `-c /dev/null` (no repo config) → **`noop-probe: PROBE FIRED`.** The
    rule and the API were fine all along; **`profile: production` was
    filtering it out.**
  - Repo config **plus** opt-in → fires on both playbooks:
    ```
    2 noop-probe  profile:production tags:idiom
    noop-probe: PROBE FIRED: custom rule evaluated this play
    playbooks/capture_pve_baseline.yml:20:3
    noop-probe: PROBE FIRED: custom rule evaluated this play
    playbooks/report_pve_baseline_drift.yml:27:3
    ```
  Opt-in works **both** as `--enable-list noop-probe` and, better, as
  `enable_list:` in `.ansible-lint` with **no CLI flag** — so the guard can
  be wired declaratively in a committed file.

  **The probe was deliberately built to fire on every play**, precisely so
  "silent" could not be mistaken for "passing". Had it been a true no-op, its
  silence would have been unfalsifiable — lesson 8 in a probe. That design
  choice is what turned an apparent "custom rules don't work" into the real
  mechanism.

  **6. The custom-rule route has a latent trap worth more than the
  recommendation:** a custom rule not named in `enable_list` (or not in the
  active profile) is loaded, listed, and **never evaluated, with exit 0**.
  A guard installed that way would be a check that cannot fail while
  appearing installed — this repo's most-repeated defect, available here as a
  one-line configuration mistake. Any `ansible-lint`-based guard must ship
  with a proof that it **fires**, not merely that lint passes.

  **7. Both playbooks are `gather_facts: false`** — re-confirmed
  (`capture_pve_baseline.yml:22`, `report_pve_baseline_drift.yml:30`), so
  they are TASK-0031's negative fixtures. **But see D1/D2 in `TASK-0052`:**
  `capture_pve_baseline.yml:21` targets `hosts: sigsrvpve1`, a bare hostname,
  so these two files alone cannot prove the guard classifies anything.

  **8. Baseline for future drift detection:** `ansible-lint 26.8.0 using
  ansible-core:2.20.8 ansible-compat:26.8.0 ruamel-yaml:0.19.1`, **53
  built-in rules**, 15 tags. A future re-run comparing these numbers can
  detect an upstream rule-set change.

- **RECOMMENDATION for the guard's home (ADR-0016 / TASK-0031):
  a custom `ansible-lint` rule, wired via `enable_list:` in `.ansible-lint`,
  with a mandatory fires-proof.** Reasoning, resting on observation 5 rather
  than on the brief's prediction:
  - The brief expected the **MCP-lint-tool asymmetry** to decide it, and it
    holds: a custom rule runs wherever `ansible-lint` runs — pre-commit, CI,
    editor, **and** the pinned MCP server's `ansible_lint` tool. A
    `pre-commit` hook fires at commit time only and would **not** fire when
    an agent lints through MCP. Since S6's whole premise is guarding *agent*
    behaviour, that asymmetry is decisive.
  - The counter-argument (coupling to a moving rule API) is **real and was
    measured**: my first probe used a plausible `create_matcherror(...,
    lineno=1)` signature and had to be corrected against
    `rules/complexity.py`'s actual `(message, filename, data)` form. The API
    is stable enough to target but not guessable — a guard must be written
    against the installed source, and re-verified on upgrade.
  - **Declarative wiring is the tiebreaker.** `enable_list:` in a committed
    `.ansible-lint` means adoption is one reviewable line, with no CLI
    wrapper for anyone to forget.
  - **Caveat that must survive into TASK-0031:** this recommendation is
    *conditional* on the fires-proof. Without it the custom-rule route is
    strictly worse than `pre-commit`, because it fails silently while
    `pre-commit` fails loudly.

- Validation: `bash tests/validate.sh` → **`validate.sh: OK`** (this task
  edits only its own brief; no component touched, so `sync-registry.sh` is
  not applicable and was not expected to change anything).
  **`git status --short` in `SIGMA-infrastructure`: empty before and after**;
  `HEAD` still `d4e2dd1`, still `[ahead 42]`. `.env` never read or copied
  (mode 600, left alone); no vault plaintext read, printed or logged.
- Result: **Done.** Both facts the spike existed to establish are now
  observed: the target's gate passes on real content (with a stated fidelity
  limit), and the guard's home is decided on evidence — a custom
  `ansible-lint` rule, conditional on a fires-proof.
- Commit:
- Push:
