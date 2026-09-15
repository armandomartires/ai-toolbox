# SESSION-20260916-0000 — Complete Phase 2: enforce, index and deploy `agents/`

- Date: 2026-09-15
- Agent: opencode (claude-opus-5)
- Objective: Implement TASK-0039, TASK-0038 and TASK-0040 **in sequence**,
  completing Phase 2 of `PLAN-0004` — `agents/` indexed, enforced and
  deployable.
- Entry state: clean tree at `f04549f`. TASK-0037 done (`agents/` defined);
  ADR-0018 accepted; the three remaining Phase-2 tasks dependency-independent.

## Why sequenced rather than parallel

The user asked whether the three could run in parallel. Checked rather than
answered from the plan's "mutually independent" wording, and found three
couplings:

1. **TASK-0038 and TASK-0040 both declared `tests/validate.sh`** in their
   own briefs' file lists. Concurrent edits to the **commit gate** risk a
   merge that silently stops checking something.
2. **TASK-0040 changes the `CLIENTS` block that `validate.sh` parses** — the
   two sides must move together.
3. **A coupling the plan does not record**: `sync-registry.sh`'s skip
   matches `_template*` only, while TASK-0038's brief creates
   `agents/_fixture-*`. A concurrent TASK-0039 regeneration would have
   committed fixture rows into `docs/registry.md`. **Verified directly** —
   the fixture *did* appear while it existed.

Order chosen `0039 → 0038 → 0040`: registry first (touches neither the gate
nor fixtures), then the gate alone, then emission. In the event **TASK-0040
needed no `validate.sh` change at all**, so collision (1) never
materialised — but that was not knowable in advance.

## What was done

- **TASK-0039** — `extract()` gains `agent`; one `emit_section` call. The
  header's "three kinds" corrected to "four". No Shape column, and **no Mode
  column**, declined deliberately with ADR-0005's derived-not-self-declared
  reasoning recorded *in the script*.
- **TASK-0038** — a ninth check group, 204 lines, parsed with `python3`.
  Reuses the skill group's `scalar()` span logic and adds a `seq()` helper
  for block sequences. Carries a `WHAT THIS DOES NOT PROVE` comment quoting
  ADR-0018 clause 4.
- **TASK-0040** — `scripts/emit-agents.py` (264 lines, 60 of them the
  `VOCAB` table), wired into `install.sh`'s client loop; `CLIENTS` gains a
  fourth column; all three `configs/*/README.md` gain an Agents section.

## Findings

1. **A finding travelled between tasks.** TASK-0039 found that a folded
   `description: >-` reaches the registry as the literal `>-` with the text
   dropped, and **`validate.sh` passes it** because the column count is
   still correct. It could not fix that (wrong task's file) and handed it
   forward; TASK-0038 now rejects folded descriptions two ways. The defect
   was invisible to the check that nominally covers the registry.
2. **TASK-0038's fixture harness was unsound on its first run, and its
   output looked like success.** All 17 fixtures violated the
   name↔directory rule *as well as* their target rule, so every case failed
   — for the wrong reason. Recording "17 for 17 proven" would have been
   unsound: the table could have been produced entirely by the
   name-mismatch check. Fixed so each case emits exactly one message.
3. **Glob ordering is semantic and nearly went wrong.** OpenCode's
   permission rules are last-match-wins. A sorted-alphabetically emission
   would have put the allow globs before the blanket deny, **inverting the
   meaning**. Caught by comparing emitted output against the live
   `agent-tiers` `qa-test` role rather than reading it for plausibility.
4. **Two assigned decisions, both made on evidence.** `worktree-only` emits
   Claude Code's `isolation: worktree` (refusal vs redirection — not
   equivalent, but refusing would make all four existing roles
   OpenCode-only and leave the Claude Code emitter dead on arrival). ADR-0018
   clause 7: the emitter emits `{tier:<name>}` and never resolves it, so
   `models.jsonc` stays the single owner — cleaner because
   `skills/agent-tiers/` is not in the repo yet.
5. **The `CLIENTS` shape was chosen by measurement.** The gate's parse
   anchors on field 1, so extra columns are invisible to it. A second table
   would have created a rival list of client names where the pairing check
   cannot see it — the defect that check exists to prevent, one level up.

## Evidence gathered (not asserted)

- Registry: template exclusion proved by **disabling the central skip** and
  watching all five templates appear; section population proved by fixture;
  integrity checks observed failing **both** directions.
- Gate: **17 rules × 1 fixture each**, plus a valid control; a body
  discussing `permission:`/`tools:` correctly **passes** (proving
  parse-not-grep); no runtime coupling, verified by reading the added code.
- Emission: **all 9 terms** emitted per client (4 map, 5 refuse); pairing
  check observed still failing on a bogus client row; idempotency and the
  multi-term merge proved by SHA-256; stale-file property demonstrated.

## Validation

- `bash tests/validate.sh` → PASS after every step. Runtime 654 → 606 ms,
  still sub-second.
- `bash scripts/sync-registry.sh` → registry committed with TASK-0039; no
  diff thereafter.
- `bash scripts/install.sh` → end to end: six skills linked, both agents
  directories created under existing parents, **zero agents emitted**
  (correct — no real role exists). `opencode.jsonc` untouched, no `agent`
  key, mtime still 2026-08-24.
- Fixtures: none survive; `agents/` holds only `_template/` and
  `README.md`; both client agents directories **empty**.

## Exit state

**Phase 2 complete.** `agents/` is defined, enforced, indexed and
deployable. **TASK-0043 is unblocked** — Phase 2 was its only remaining
dependency — and TASK-0044 is independent. `TASK-0034` remains the open
Phase-1 spike with ADR-0017 behind it.

**The plumbing is entirely unexercised**, which is stated plainly rather
than glossed: no real role exists, both client directories are empty, and
REVIEW-0008's pre-committed question ("did anything get exercised?") now
applies directly to three tasks' output. TASK-0043 and TASK-0045 are what
make it real.

For whoever authors the first role: the emitter **refuses** a role
declaring a term its target client cannot enforce, and exits non-zero
through `install.sh`. That is intended. The fix is narrowing the role's
`clients` list, never softening the refusal.

- Result: Phase 2 complete. Commits `8a9996b` (0039), `e0e9d68` (0038) and
  the TASK-0040 commit below; all pushed to `origin/master` and confirmed.
