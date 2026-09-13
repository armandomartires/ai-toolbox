# TASK-0014 — `install.sh` warns on the `core.filemode=false` hook trap

## Objective
Make `scripts/install.sh` detect and explain the `core.filemode=false`
condition at the moment it activates the pre-commit hook, so the person
most likely to hit the trap is told about it by the tool they are already
running.

## Minimal context
`.ai/context/CURRENT_STATE.md:107-112` records the platform gotcha found
the hard way during TASK-0010:

> `core.filemode=false` on this `/mnt/c` checkout, and the 9p mount reports
> every file `rwxrwxrwx` while ignoring `chmod -x`. So `chmod +x` never
> reaches git's index and `[ -x ]` can never fail.

The failure mode is nastier than "a hook isn't executable", because it is
**asymmetric between machines**:

- On *this* checkout the hook runs fine. Git invokes it through the OS,
  and the 9p mount claims every file is executable. Nothing looks wrong.
- The mode git *records* can still be `100644`. Committed that way, the
  hook is silently ignored on any machine that honours the executable bit
  — the gate reports nothing and simply never fires.

`tests/validate.sh` already catches this (it checks `git ls-files -s`, not
`[ -x ]`). But the sequencing is wrong for a newcomer: someone cloning
fresh onto Windows runs `scripts/install.sh` first, because that is what
`AGENTS.md` and the README tell them to run to set the repo up.
`install.sh` is the script that activates `core.hooksPath`, so it is
exactly where the caveat belongs — and today it says nothing.

## Scope
### Included
- In `install.sh`'s hook-activation block, after setting `core.hooksPath`:
  - Read the mode git records for `.githooks/pre-commit`.
  - If it is not `100755`, print a warning naming the exact fix
    (`git update-index --chmod=+x`), not just the symptom.
  - If `core.filemode` is `false`, say so explicitly and explain that
    `chmod +x` alone will not fix it — otherwise the natural response to
    the warning is the command that silently does nothing.
- A `docs/operations/` note so the explanation has one owner and the
  script can stay terse.

### Not included
- Auto-running `git update-index --chmod=+x`. Mutating the index during an
  install is a surprising side effect; and if the hook is somehow
  *intentionally* non-executable, silently changing it hides that.
- Changing `core.filemode` itself. It is set per-checkout for a real
  reason on `/mnt/c` and is not this script's business.
- Moving the check out of `validate.sh`. Both belong: `install.sh` warns
  early and advisorily; `validate.sh` fails authoritatively.
- Making `install.sh` exit non-zero. Skill deployment is unrelated to hook
  mode; failing the whole install over an advisory would be wrong.

## Preconditions
- Working tree clean; `validate.sh` passing.

## Likely files
- `scripts/install.sh`
- `docs/operations/` (new note)
- `.ai/context/CURRENT_STATE.md`

## Execution plan
1. Extend the existing hook block. Keep it idempotent and quiet on the
   happy path — a warning that prints every run gets ignored.
2. Test all four combinations by manipulating a throwaway clone, never
   this repo's real index: mode 100755 / 100644 × filemode true / false.
3. Write the operations note; link it from the warning text.

## Acceptance criteria
- [x] Happy path (mode 100755) prints no warning — verified for both
      `core.filemode=true` and `false`.
- [x] Mode 100644 prints a warning naming `git update-index --chmod=+x`.
- [x] With `core.filemode=false`, the warning additionally says `chmod +x`
      will not be enough.
- [x] `install.sh` still exits 0 and still deploys skills in every case.
- [x] The check never mutates the git index (recorded mode still 100644
      after a run against a deliberately-broken clone).
- [x] `docs/operations/runbook.md` explains the trap; `install.sh` links to
      it rather than restating it at length.
- [x] `tests/validate.sh` passes.

## Mandatory validations
- [x] tests/validate.sh — OK
- [x] scripts/install.sh — ran on this checkout: 4 skills deployed, no
      spurious warning (real hook is correctly 100755)
- [x] scripts/sync-registry.sh — registry unchanged as expected

## Risks and rollback
- Risk: testing this by breaking the real hook's index mode, then leaving
  it broken. Mitigation: use a throwaway clone in `/tmp/opencode`; verify
  this repo's recorded mode is unchanged at the end.
- Risk: a false warning on a fresh clone that has not yet run install.
  Mitigation: the warning is advisory and triggers only on a recorded mode
  that is genuinely wrong.
- Rollback: revert; the block is additive and advisory.

## Dependencies
None.

## Expected result
The trap is surfaced by the first script a new contributor runs, with the
fix that actually works on a `core.filemode=false` checkout.

## Status
- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-13
- Updated: 2026-09-13

## Execution log
### Attempt 1
- Date: 2026-09-13
- Agent: opencode
- Actions:
  - Extended `install.sh`'s hook-activation block with an advisory check on
    the mode git records for `.githooks/pre-commit`, plus a conditional
    note when `core.filemode=false`.
  - Replaced the runbook's single-bullet mention with a
    "The `core.filemode=false` trap" subsection explaining the asymmetry
    and tabulating which of install.sh/validate.sh warns vs fails.
- Observations:
  - **The first version of the test harness proved nothing, and it is worth
    recording why.** It cloned the repo and ran `install.sh` from the
    clone — but a clone carries committed HEAD, and the change under test
    was uncommitted. All four combinations printed no warning, which looked
    like a code bug. The harness was the bug; it was exercising the old
    script. Fixed by copying the working-tree `install.sh` into the clone
    and asserting the new warning string is present before testing.
    Generalizable: a test that clones to isolate itself also isolates
    itself from the change it is meant to verify.
  - Chose advisory-not-fatal deliberately. Hook mode has nothing to do with
    whether skills deploy; aborting the install over it would make a
    cosmetic problem block a working operation.
  - Did not auto-run `git update-index --chmod=+x`. Silently mutating the
    index during an install would hide a deliberately non-executable hook
    and surprise the operator.
- Validation:
  - Four-way matrix in a throwaway clone (`/tmp/opencode/fmtest`), recorded
    mode × `core.filemode`:
    - `100755` + `true` → no warning ✓
    - `100644` + `true` → warning, no filemode note ✓
    - `100755` + `false` → no warning ✓
    - `100644` + `false` → warning **and** the "`chmod +x` will NOT fix
      this" note ✓
  - `install.sh` exit code 0 with a broken mode; clone's index still
    `100644` afterwards, proving no mutation.
  - Real repo: `install.sh link` deployed 4 skills across 2 clients with no
    warning; `git ls-files -s .githooks/pre-commit` still `100755`.
  - `tests/validate.sh` OK.
- Result: success. The trap is now surfaced by the first script a new
  contributor runs, with the fix that actually works on this mount.
- Commit: 05b6e59
- Push: deferred to TASK-0015, which wires the remote
