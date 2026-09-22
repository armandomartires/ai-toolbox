# TASK-0053 — Correct the Bionic client snapshot's drifted observations

## Objective

Bring `configs/lm-studio-bionic/README.md` back into agreement with the
machine it claims to describe. Two recorded observations have drifted since
`TASK-0047` stamped them on 2026-09-15:

1. The installed Bionic version is **1.1.3+5**, not the recorded **1.1.1+5**.
   *Stale* — the stamp did its job.
2. `~/.lmstudio/mcp.json` is recorded as "holding the `ansible` entry with a
   real `WORKSPACE_ROOT`". It is `{"mcpServers": {}}`. **Factually wrong**,
   not merely stale, and stated in the present tense.

This is the mitigation ADR-0020 named for itself working as intended —
"Every observation here is version-stamped, and the paths may move. The
mitigation is the stamp, not a promise of stability" (`ADR-0020:207-210`).
The stamp is what made both drifts cheap to find.

## Minimal context

### Why this is not an ADR edit

`ADR-0020`, `ADR-0006`'s superseding annotation and `TASK-0047` all record
these same two facts, and **none of them is touched**. This repo has already
settled that question once, in `ADR-0006`'s own annotation: *"an ADR is a
dated record rather than a live status page."* `ADR-0020` was correct on
2026-09-15; correcting it now would destroy the evidence that the drift
happened and turn a checkable dated claim into an unfalsifiable one.

The live snapshot in `configs/` is the file whose job is to be current. That
is the one that moves.

### The `mcp.json` clearing has evidence, and it is not this repo

The entry was not removed by anything in this repo — `TASK-0047` explicitly
placed "touching the live `~/.lmstudio/mcp.json`" out of scope
(`TASK-0047:184`), and nothing since has claimed it.

Observed 2026-09-22, and this is the part worth carrying forward:

| Artifact | mtime | Contents |
|---|---|---|
| `~/.lmstudio/mcp.json` | **2026-09-17 20:00:29.567** | `{"mcpServers": {}}` |
| `~/.lmstudio/credentials/mcp-oauth/` | **2026-09-17 20:00:29.663** | empty |
| `~/.lmstudio/.internal/last-synced-mcp-state.json` | — | `{"mcpServers": {}}` |
| `~/.lmstudio/mcp.json.bak` | 2026-09-13 15:27 | `{"mcpServers": {}}` |

`mcp.json` and `credentials/mcp-oauth` were written **within the same tenth
of a second**, and the app's own `last-synced-mcp-state.json` agrees the
config is empty. That pattern is an application writing its own state, not a
hand edit — and it is the *same* inference shape `ADR-0020:124-127` already
used in the other direction, where the two were written in the same second
on 2026-09-13.

**The cause is not established and is not invented here.** A plausible
candidate is the 1.1.1+5 → 1.1.3+5 upgrade, whose changelog entry is
"organization-managed MCPs" — see the next section. That is a *hypothesis
with a matching date*, recorded as such.

### A new artifact ADR-0020 could not have seen

`~/.lmstudio/credentials/ng-mcp-managed-oauth/` exists, created **2026-09-16
01:17** — the day *after* `ADR-0020` was written. `ADR-0020:124-127` knew
only `ng-mcp-oauth` (empty, untouched since 2026-07-22, and still so).

`ng-mcp.json` itself is **still absent from disk**, so the README's dormancy
claim holds. But a second, *managed* credential channel appearing on a
machine whose app then cleared its MCP config is exactly the "finding it live
is a real result" case the runbook already tells the next reader to watch for
(`docs/operations/runbook.md`). It is recorded, not acted on.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `configs/lm-studio-bionic/README.md` | TASK-0047 | 290 lines; records Bionic 1.1.1+5 and a populated `mcp.json` |
| `.ai/decisions/0020-the-lm-studio-client-is-bionic.md` | TASK-0047 | Accepted 2026-09-15; **read only, not edited** |
| `docs/operations/runbook.md` | TASK-0016 / TASK-0047 | Bionic GUI check open; status table names 1.1.1+5 |
| `.ai/context/CURRENT_STATE.md` | TASK-0052 | Last updated 2026-09-16 |
| Live machine: `~/.lmstudio/`, `AppData/Local/Programs/Bionic/` | external | Bionic 1.1.3+5; `mcp.json` empty |
| `tests/validate.sh` | pre-existing | passing on a clean tree |

**Verify the expected state; don't assume it.** Every row above was re-read
or re-stat'd on 2026-09-22 before this brief was written.

## Scope

### Included
- `configs/lm-studio-bionic/README.md` — re-stamp the version observation to
  1.1.3+5 / 2026-09-22; correct the `mcp.json` contents claim; record the
  same-second clearing evidence and the new `ng-mcp-managed-oauth` directory.
- `docs/operations/runbook.md` — the version in the per-client status table.
- `.ai/context/CURRENT_STATE.md` — record the correction and that ADRs were
  deliberately left alone.

### Not included
- **`ADR-0020`, `ADR-0006`, `TASK-0047`.** Dated records. See above — this is
  a decision, not an oversight.
- **Restoring the `ansible` entry in the live `~/.lmstudio/mcp.json`.** Outside
  the repo, and a human action. The runbook already instructs pasting it as
  step 1 of the GUI procedure, which the empty file now makes genuinely
  necessary rather than redundant.
- **Investigating *why* the app cleared the config.** Needs the GUI and a
  human; the evidence is recorded so that investigation can start cold.
- **B-018** (deploying skills to Bionic) and the open Bionic GUI verification.
  Both untouched and still open.
- Any claim that Bionic's MCP support is now verified. It is not, at any
  version.

## Likely files
- `configs/lm-studio-bionic/README.md`
- `docs/operations/runbook.md`
- `.ai/context/CURRENT_STATE.md`
- this file

## Execution plan
1. Re-verify every fact on the live machine before editing (done — see Inputs).
2. Correct the version observation and its date stamp in the client snapshot.
3. Correct the `mcp.json` bullet; add the clearing evidence and the
   `ng-mcp-managed-oauth` finding under a 2026-09-22 stamp.
4. Correct the version string in the runbook status table.
5. Record the correction in `CURRENT_STATE.md`.
6. `tests/validate.sh`; `scripts/sync-registry.sh` to confirm no registry drift
   (no component changed, so a diff here would itself be a finding).
7. Review the diff, commit, push, record hash and push result.

## Acceptance criteria
- [ ] No file in the repo states the installed Bionic version as 1.1.1+5 as a
      *current* observation; dated records that say so are untouched.
- [ ] No file states that `~/.lmstudio/mcp.json` currently holds the `ansible`
      entry.
- [ ] The clearing evidence (same-second mtimes, empty `last-synced-mcp-state`)
      is recorded with its date stamp, and its cause is marked as unestablished.
- [ ] `ng-mcp-managed-oauth` is recorded; the `ng-mcp.json`-still-absent claim
      is re-verified and retained.
- [ ] Bionic's MCP status remains **inferred, not verified**.
- [ ] `ADR-0020`, `ADR-0006` and `TASK-0047` are byte-identical to before.
- [ ] `tests/validate.sh` passes; `git status` clean after commit.

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (expect no diff — no component changed)

## Risks and rollback
- **Risk: over-correcting into the ADRs**, destroying the dated evidence that
  makes drift detectable. Mitigated by making that an explicit acceptance
  criterion with a byte-identical check.
- **Risk: asserting a cause for the clearing.** Mitigated by recording the
  timestamps and marking the upgrade link as a hypothesis.
- **Risk: the snapshot drifts again.** Accepted, and unchanged from ADR-0020's
  own accepted risk. The defence is the stamp, which is what worked here.
- Rollback: documentation-only, single commit, `git revert`.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `configs/lm-studio-bionic/README.md` | 346 lines (was 290). Version re-stamped **1.1.3+5 / 2026-09-22** with a note on why `ADR-0020` keeps saying 1.1.1+5. Summary table's MCP row now states the file is empty. `Verified (MCP)` row reworded to **"not verified at any version"**. New sub-section under *Bionic MCP status* carrying the clearing evidence table, the "nothing in this repo did this" attribution, the unestablished cause, the two consequences, and the `ng-mcp-managed-oauth` finding |
| `docs/operations/runbook.md` | Status table names **Bionic 1.1.3+5**. GUI procedure step 1 flagged **not optional any more**, with the reason. The `ng-mcp.json` dormancy date removed and pointed at the snapshot, which owns that fact |
| `.ai/context/CURRENT_STATE.md` | `Last updated` moved to 2026-09-22. New top section *"The Bionic snapshot drifted, and the stamp is what caught it"*. The two in-place `1.1.1+5` claims annotated with the new version and this task |
| `.ai/decisions/0020-…md`, `0006-…md`, `.ai/tasks/TASK-0047-…md` | **Byte-identical — verified via `git diff --name-only`.** Deliberate, per the acceptance criteria |
| `docs/registry.md` | Regenerated, **no diff** — no component changed, as forecast |
| Live `~/.lmstudio/mcp.json` | **Untouched.** Still `{"mcpServers": {}}` |

**Next task starts here**: the Bionic GUI verification is still the open
human action, and it now genuinely requires pasting the `ansible` block first
(runbook step 1). **B-018 is unaffected and still `ready`.** Nobody has
established *why* the app emptied the config — the evidence is recorded so
that can start cold.

**Deviation from the Plan: none in scope.** Two things were found during
execution that the Plan did not forecast and that are additive rather than
corrective: the same-tenth-of-a-second mtime pairing on
`mcp.json` / `credentials/mcp-oauth` (which is what upgraded "the entry is
gone" from a bare fact to an attributable one), and the
`ng-mcp-managed-oauth` directory created 2026-09-16. Both are recorded in the
snapshot.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-22
- Updated: 2026-09-22

## Execution log
### Attempt 1
- Date: 2026-09-22
- Agent: Claude Opus 5 (1M context)
- Actions: Re-verified every claim against the live machine before editing
  (`package.json` version, `mcp.json` contents + mtime, `mcp.json.bak`,
  `last-synced-mcp-state.json`, all three `credentials/*mcp*oauth` dirs,
  `ng-mcp.json` absence, `~/.lmstudio/skills/` still empty, classic LM Studio
  still installed at `C:\Program Files\LM Studio`,
  `historical-version-info.json` still recording 0.4.24). Then corrected the
  three live documents; left the three dated records alone.
- Observations:
  1. **The version drift was benign; the `mcp.json` claim was not.** One was
     stale, the other was a false present-tense statement about a live file —
     the kind that sends a reader to a GUI expecting an entry that is not
     there.
  2. **The same-second inference cut both ways.** `ADR-0020` used
     `mcp.json` and `credentials/mcp-oauth` sharing a write-second on
     2026-09-13 as evidence the config was live. The same pairing on
     2026-09-17 is what shows the *clearing* was the app's doing, not a hand
     edit or this repo's. Re-using the ADR's own reasoning on new timestamps
     was the cheapest available check.
  3. **`ng-mcp-managed-oauth` was invisible to ADR-0020 by one day.** Created
     2026-09-16 01:17; the ADR was written 2026-09-15. Nothing was wrong in
     the ADR — the artifact did not exist yet.
  4. **Two claims survived re-checking and are explicitly retained**: only one
     MCP config exists with no Bionic-specific one, and `ng-mcp.json` is still
     absent from disk. Re-verifying what is still true was as much of the job
     as correcting what was not.
- Validation: `tests/validate.sh` → **OK** (run twice: after the snapshot and
  runbook edits, and again after the final runbook tidy).
  `scripts/sync-registry.sh` → regenerated with **no diff**, as forecast.
  `git diff --name-only -- .ai/decisions/ .ai/tasks/TASK-0047-*` → **empty**,
  confirming the dated records are byte-identical.
- Result: **done.** All eight acceptance criteria met. Documentation-only; no
  component, script or gate changed.
- Commit: `21a1bf8` — "Correct the Bionic snapshot's drifted version and MCP
  config claims". Pre-commit hook ran `tests/validate.sh` → OK.
- Push: **confirmed** — `ec1cef8..21a1bf8  master -> master` to
  `origin` (`armandomartires/ai-toolbox`). `git remote -v` verified
  token-free before and after; branch in sync with `origin/master`.
