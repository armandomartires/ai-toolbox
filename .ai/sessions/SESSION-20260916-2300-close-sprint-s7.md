# SESSION-20260916-2300 — Close sprint S7 with REVIEW-0008

- Date: 2026-09-16
- Agent/model: opencode (claude-opus-5)
- Objective: Finish S7 — write the missing `REVIEW-0008` checkpoint from
  independent evidence, sweep the sprint's status records, archive S7 and
  promote S8.
- Context consulted: `AGENTS.md`, `.ai/planning/SPRINT-CURRENT.md` (S7),
  `.ai/context/CURRENT_STATE.md`, `.ai/planning/ROADMAP.md` Phase 7,
  `.ai/planning/BACKLOG.md`, `.ai/templates/REVIEW.md`,
  `REVIEW-0007` as the closure precedent, `SPRINT-S5` as the archive-header
  precedent, all 14 S7 task files, `.ai/sessions/INDEX.md`.
- Tasks worked on: `REVIEW-0008` (new). No component code changed.

## Decisions

- **Write the review before promoting S8**, per the escalation recorded in
  the S8 header. The order was the whole point: a checkpoint written after
  the next sprint began would be a formality.
- **Verify the pre-committed question from artifacts, not task logs.** The
  question (*did anything get exercised?*) is exactly the kind that a task
  log will answer yes to by construction, so every claim was re-derived:
  the gate broken and restored, both client directories listed, the emitted
  `git-ops` permission order re-read, the pilot's checker run both ways.
- **Fix false status claims in the closing commit; defer only real work.**
  Findings 4 and 5 (three files disagreeing on task counts, three backlog
  items still `ready` after delivery) were fixed here — a known-false status
  is not a follow-up. Findings 2, 3 and 6 became follow-ups and B-021.
- **Do not reconstruct the four missing session records.** TASK-0041, 0042,
  0046, 0047 have none. Writing them a day later would invent the evidence
  the convention exists to preserve. Recorded as a follow-up instead.
- **Do not rewrite ADR-0015 here.** It contradicts a shipped component, but
  it belongs to parked S6; rewriting a parked sprint's ADR inside another
  sprint's closure muddles ownership. Warned in the review instead.

## Commands and validations

- `tests/validate.sh` — **OK**, exit 0. Working tree: 965/999/1039 ms, then
  six more runs at 980–1047 ms. **Over the sub-second budget.**
- **Like-for-like timing in a worktree on the repo's own filesystem**
  (3-run averages): `e0e9d68` 622 ms, `4fc1f12` 880 ms, `31e0520` 960 ms,
  `2dc8389` 1138 ms. Worktree removed afterwards.
- Hermetic: `env -i /bin/bash -c '… bash tests/validate.sh'` → OK, exit 0.
- Offline: no `curl|wget|urllib|requests|ls-remote|npx|npm|pip install` in
  `validate.sh`.
- Fails-when-reverted: `name: critic` → `crtiic` → exit 1,
  `INVALID AGENT: … does not match directory 'critic'`; restored, SHA-256
  identical.
- `scripts/sync-registry.sh` re-run → **no diff**; registry current.
- Emission: 6 files in `~/.config/opencode/agents/`, 3 in
  `~/.claude/agents/`; the 3 OpenCode-only roles absent from Claude Code.
- `git-ops` emitted glob order re-derived — shorter patterns first, every
  force variant resolving **deny**, `git clean -f*` present.
- `skills/ansible-ops/scripts/check-change-record.sh` run on both fixtures:
  exit 0 stating its own limits; exit 1 naming three specific fields.
- Secrets: `git diff cb0aa96..ff212dd` scanned for `ghp_`, `github_pat_`,
  `glpat-`, `AKIA`, PEM headers — the one hit is prose describing a scan.
- Pushes: `ff212dd` and `HEAD` both ancestors of `origin/master`.

## Problems

- **My first timing measurement was wrong in the reassuring direction.** I
  timed a worktree on `/tmp` (ext4) against the repo on `/mnt/c` (9p DrvFs)
  and got 358 ms for TASK-0038's commit — which would have been recorded as
  "no regression, the gate is fine". It compared **filesystems, not
  commits**. Re-run on the repo's filesystem, the same commit is 622 ms,
  matching TASK-0038's recorded 606 ms. The trap is now in the roadmap
  Risks, because the next person to measure this will hit it.
- **A backlog grep was unsound and I nearly recorded its output.** Counting
  `**ready**` occurrences per row reported nine open items against my
  stated eight, because my own explanatory prose ("Had read **ready** until
  closure") matched. Re-counted on the status **field** only: eight, and the
  stated total was right. Same shape as TASK-0038's fixture harness — a
  measurement that fails for a reason unrelated to what it measures.
- **A grep for "which tasks have a session row" was also unsound**, since
  it matched mentions like "Unblocks TASK-0041" anywhere in the file rather
  than the `Tasks` column. Re-run against the column, which is how the four
  missing records surfaced.
- **The heredoc idiom failed twice** in this PowerShell-hosted shell; a
  small script file was used for the one structural edit (moving B-021
  after B-020) instead of `sed`/`python3 -` inline.

## Commit/push
`5a23a0d` — *Close sprint S7 with REVIEW-0008; promote S8*. 10 files,
+971/−430. Gated by `.githooks/pre-commit` (`validate.sh: OK` printed
during the commit, so the hook is live rather than merely installed).
Push confirmed below.

## Addendum — reviewing follow-up 4 (same session, after the push)

The human asked for follow-up 4 to be reviewed. **Reading the ADR instead of
the notes about it found the follow-up wrong twice, plus one defect it had
missed.** Committed as `1f7e316`, pushed and confirmed.

- **"Rewritten" is the wrong verb.** ADR-0015 has no body: `## Context`,
  `## Decision` and `## Consequences` all say *"to be written"*, and its
  dependency `TASK-0027` is `planned`. It must be **written**, spike first —
  which is precisely why it cannot be done outside S6.
- **"Contradicts a shipped component" overstated the scope.** Refuted is
  clause 1's *mechanism* (a consumer filling a template with estate facts).
  `skills/ansible-ops/templates/change-record.md` holds no estate facts and
  says at line 30 *"Copy this file to wherever your estate keeps records"* —
  copy-out, not fill-in-place. `templates/` itself survives.
- **The defect the follow-up missed:** `TASK-0029:93`, `TASK-0030:84` and
  `TASK-0032:84` all record ADR-0015 as **accepted**; it is `proposed`. The
  rows sit under **"Expected state"** and TASK-0032 is still `planned`, so
  those are expectations working as S5 designed. But TASK-0029/0030 are
  **`done` with the precondition unmet**, and the Option 2 waiver that
  permitted it was recorded **only in `CURRENT_STATE.md`** — so a cold reader
  of either task file saw `done` above an unmet input with no explanation.
  Both now carry the waiver.

**Method note worth keeping:** the follow-up list of a review is itself a
set of claims about files, and it decays exactly like any other. Both errors
came from writing the follow-up against notes (`CURRENT_STATE.md`'s "must be
rewritten") rather than against the artifact. **The same class the review's
own finding 4 was about**, committed inside the review that documented it.

Nothing was decided: **no ADR body written, no status changed, no component
touched.** The dated execution logs (TASK-0029's log, TASK-0046's, the S7
sprint archive) keep their original wording with a correction appended, since
a dated record should not be silently rewritten.

## Next action
S8 is current. `TASK-0048` (the spike) runs first, by design — everything
else in S8 rests on vendor documentation, two pieces of which already
contradict their own source. Its findings must land in `BACKLOG.md`, not
only in prose (B-021's lesson).

**Still open from REVIEW-0008 follow-up 4, and deliberately so:** ADR-0014
and ADR-0015 remain `proposed` with unwritten bodies. Order for whoever
unparks S6: `TASK-0027` (cheap — `ansible-lint 26.8.0` is already in the
control venv), then both bodies against observed evidence, then ratify. **Do
not fill the sections in from `PLAN-0003`'s prose**; that is how ADR-0015
reached this state.
