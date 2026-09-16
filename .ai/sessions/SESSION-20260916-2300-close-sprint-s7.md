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
Recorded below at task end.

## Next action
S8 is current. `TASK-0048` (the spike) runs first, by design — everything
else in S8 rests on vendor documentation, two pieces of which already
contradict their own source. Its findings must land in `BACKLOG.md`, not
only in prose (B-021's lesson).
