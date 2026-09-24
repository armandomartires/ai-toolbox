# TASK-0092 — S10.7: the pilot — one unattended run of two tasks, dry run first

## Objective

Run `loops/unattended-run/` for real, once, through the **OpenCode binding**
(`TASK-0086`), against this repository: dry run first, then — on the human's
go — live, watched. Record what it does, and **believe the pilot only if it
finds something** (`ROADMAP.md` Phase 10, criterion 7).

## Minimal context

### The human's choices, 2026-09-24 (multiple-choice; the agent chose none)

- **Target:** ai-toolbox itself.
- **Tasks (the queue, in order):** `TASK-0093` (release-check step 8) and
  `TASK-0094` (the `CURRENT_STATE.md` opening paragraph). Both briefs are
  committed before the run: the committed task file is the lock
  (`ADR-0022` clause 3).
- **Model:** `perplexity-agent/anthropic/claude-sonnet-5` — "Claude Sonnet 5
  via the Perplexity API", passed as `-m` on every role call.
- **Go-live:** pause after the dry run for the human's go.

### How the run is contained

- **Its own worktree** (`scripts/worktree.sh add pilot`, branch
  `agent/pilot`), per `ADR-0023`: this session keeps `master`.
- **Run configuration and records under `.pilot-scratch/s10-7/`** in the
  worktree — the filled `binding.md`, the gate map, the queue, and the run
  directory (evidence, journal, handover). Already gitignored, so the run
  starts and stays on a clean tree, which the driver requires.
- **Gates, role-blind** (`references/gate-map.md` rule A): `validate` —
  `bash tests/validate.sh`; `registry` — regenerate `docs/registry.md` to a
  backup-and-compare, restoring the file, failing on any difference. Neither
  has a silent-no-op switch: `validate.sh` takes none, and the registry gate
  compares content rather than trusting an exit code.
- **Nothing is pushed by the run.** Landing `agent/pilot` on `master` —
  rebase and push — is the human's (`ADR-0019` clause 2.2, `ADR-0022`
  clause 4.1), and is asked as a question after the handover.

### What would falsify the pilot's value

A run that closes both tasks with no finding at all. S7's pilot found twelve
false self-claims; this harness has never run from this repository's
artifacts. A finding is the expected outcome, not a failure.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/unattended-ops/templates/bindings/opencode/` | `TASK-0086`, `TASK-0089` | driver, `run-gate.sh`, template binding |
| `~/.config/opencode/agents/` | `TASK-0090` | nine roles, each `(primary)` |
| `.ai/tasks/TASK-0093-*.md`, `TASK-0094-*.md` | this commit | `ready`, committed |
| `.ai/tasks/TODO.md` | this commit | a `- [ ]` row for each |

## Scope

### Included

- The worktree, the filled binding, gate map and queue.
- The dry run; its journal and handover shown to the human.
- On the human's go: the live run, watched.
- Findings recorded here; `ADR-0022` F3, F7, F9 verdicts wherever the run
  settles them; `SPRINT-CURRENT.md`, `CURRENT_STATE.md`.

### Not included

- Landing `agent/pilot` on `master` — the human's.
- Fixing any finding in this task; each becomes its own task or backlog item.
- Changing either pilot task's brief after this commit.

## Likely files

`.ai/tasks/TASK-0092-s10-7-pilot.md`, `.ai/decisions/0022-*.md` (F-rows),
`.ai/planning/SPRINT-CURRENT.md`, `.ai/context/CURRENT_STATE.md`.

## Execution plan

1. Commit the three briefs and the tracker rows on `master`; push.
2. `scripts/worktree.sh add pilot`; write `.pilot-scratch/s10-7/` there.
3. `check-binding.sh` on the filled binding.
4. Dry run: `driver.py --binding … --run-id s10-7-dry --dry-run`.
5. Show the human the journal and handover; ask go / no-go.
6. On go: live run, `--run-id s10-7-live`; watch it.
7. Record, update F-rows and state; ask the human about landing.

## Acceptance criteria

- [ ] The filled binding passes `check-binding.sh`.
- [ ] The dry run completes and writes a handover; its outcome is recorded
      verbatim.
- [ ] The live run starts only after the human's go, and writes a handover.
- [ ] Every task attempted ends closed with a hash **or** parked with a
      stated reason — nothing half-done in the worktree.
- [ ] Nothing is pushed by the run.
- [ ] Every finding is recorded, and each falsifiable claim the run touched
      carries its observed verdict.

## Mandatory validations

- [ ] `check-binding.sh` on the filled binding
- [ ] `git -C <worktree> status --porcelain` empty after the run
- [ ] `git log origin/master..agent/pilot` shows only the run's commits
- [ ] `tests/validate.sh` on `master` after recording

## Risks and rollback

- **Real agents with write access in a real repository** — contained to the
  worktree and its branch; `master` is untouched until the human lands it.
  Rollback: `scripts/worktree.sh remove pilot` and delete `agent/pilot`.
- **Model cost** on the human's Perplexity account — two tasks, a task cap of
  2, an attempt bound of 2 and a 30-minute role timeout bound it.
- **The Perplexity provider may not support tool calls as OpenCode needs
  them.** Untested; the dry run is where it would show.

## Outputs / handover

*Not yet written — forecast until verified.*

| Artifact | End state |
|----------|-----------|
|          |           |

**Next task starts here**: —

## Status
- Status: in_progress
- Owner: agent (choices and go-live: human)
- Created: 2026-09-24
- Updated: 2026-09-24

## Execution log
### Attempt 1 — the dry run (2026-09-24)
- Date: 2026-09-24
- Agent: Claude Opus 5.5 (1M context), driving `driver.py`; roles on
  `perplexity-agent/anthropic/claude-sonnet-5`
- Actions: briefs committed (`e2e8326`); worktree `agent/pilot` created;
  `.pilot-scratch/s10-7/` written (binding, gate map, queue);
  `check-binding.sh` → **BINDING OK** (20 slots, 14 steps, no uncited rule);
  dry run `--run-id s10-7-dry`.
- Result of the dry run: **halted at preflight, correctly.** Driver exit 1;
  handover written by `run-scribe`; worktree clean; zero commits; nothing
  pushed. The driver's own structural lock check (step 2) had **passed** —
  one committed file per task — but the `preflight` role reported both task
  files **not found** (`criteria_present: false`) while reading `TODO.md` from
  the same commit, and was denied two `bash` calls. The loop did what it says:
  an unverified lock is a halt, not something to interpret.
- Findings (the pilot's product; none fixed here):
  1. **The preflight role could not see files the driver saw — CONFIRMED:
     OpenCode's glob tool does not see dot-directories.** In a throwaway
     repository holding the same file at `.hidden/TASK-1-x.md` and
     `visible/TASK-1-x.md`, the glob tool returned *"No files found"* for
     `.hidden/TASK-1-*.md` and the file for `visible/TASK-1-*.md` (opencode
     1.18.31, default agent). This repository's task files live under
     `.ai/`, so any role told to *glob* its task file cannot find it; reading
     by exact path works (the role read `TODO.md`). The driver already
     resolves each task file structurally (step 2), so the paths it hands the
     role are sufficient — the role must read them, not glob.
  2. **`opencode run` stalls silently, intermittently, on tool-using
     prompts.** From 17:20Z, eight tool-using runs stalled (`init`, then
     nothing, never `event connected`, killed at 90–600 s) across **three
     providers** — Perplexity, GitHub Copilot, and an `anthropic/…` model id
     that turned out not to be configured — with and without `--agent`, in
     the worktree and in neutral directories, with and without
     `--print-logs`. **One identical tool-using run succeeded** in the middle
     of them. Every tool-free prompt returned (8–123 s). Ruled out by test:
     a stale `*.lock` in OpenCode's snapshot store, a stray process, a `*` or
     a slash-plus-`*` path in the prompt, the provider.
     **Root cause found — the human spotted it:** the runs were opening the
     OpenCode *desktop app*. The user's config loads the plugin
     `opencode-arcade-hub`, which wraps a hosted MCP gateway needing a
     one-time OAuth; a run that loads it attempts that auth, which hands off
     to the desktop app and blocks before the model is reached
     (`mcp-auth.json` was rewritten during the stalled runs; a desktop-app
     `opencode serve --hostname 0.0.0.0` process appeared). With
     `opencode run --pure` ("run without external plugins") the same
     stalling prompt ran **2 of 2** in 15–16 s with both tool calls, left
     `mcp-auth.json` untouched, and spawned no `serve`. This is `ADR-0022` clause 5.3's
     symptom — silent hang after `init` — **with `-m` passed**, so a missing
     model is not the only cause of it.
  3. **At `role_timeout: 30m` and a mechanical bound of 3, one such stall
     costs a run 90 minutes** before the task parks.
  4. **OpenCode's shell tool runs `/usr/bin/pwsh`**, not bash, on this
     machine (logged `shell tool using shell shell=/usr/bin/pwsh`). The
     allowlists still matched `git …` commands; `cat`/`echo` were denied, as
     declared.
  5. An `opencode serve --hostname 0.0.0.0` process (pid 2229) has run since
     17:13Z, before the pilot started — not started by this session; left
     alone. Whether it relates to finding 2 is unknown.
- Live run: **not started** — the dry run halted, and go-live is the human's.

### Attempt 2 — the second dry run, `s10-7-dry2` (2026-09-24)
- Between runs: `TASK-0095` (read resolved paths, never glob); the human
  **uninstalled the `opencode-arcade-hub` plugin** — three tool-using runs
  then passed in 14–17 s without `--pure` (the `plugin` line remains in the
  user's config, harmlessly; the `arcade` MCP entry now only warns
  `needs_auth`); worktree fast-forwarded to `1dd381e`.
- Result: **halted at preflight, correctly, one step further.** Both task
  files found at their given paths, criteria present, sources agreeing
  (`'ready'` vs an unchecked tracker row). The role halted because *"the two
  silent-failure checks the driver must run and hand to preflight per
  ADR-0022 clauses 5.1/5.3 … were not supplied … An absent check is not a
  passed check."*
- Findings:
  6. **The driver ran step 1's two silent-failure checks and handed the role
     neither result** — a real gap between the driver and
     `agents/preflight/`, which forbids inferring them. Fixed by `TASK-0096`
     (the human's choice: pass the evidence; the role is not relaxed).
  7. **Roles cannot read the `unattended-ops` skill.** OpenCode's
     `external_directory` rule denied reads under
     `~/.config/opencode/skills/unattended-ops/`, while role bodies say to
     read `references/return-schemas.md` there. Not blocking — the driver's
     prompts carry every return shape. **Recorded, to be decided after the
     pilot** (the human's choice).
  8. Roles still try shell commands outside their allowlists (`echo`, `ls`)
     and are denied, as declared; harmless, but each denial is a wasted
     model turn.

### Attempt 3 — the third dry run, `s10-7-dry3` (2026-09-24)
- On worktree `2a26063` (after `TASK-0096`). **Driver exit 0; completed.**
- Journal, in order: `run-start` (queue `TASK-0093`, `TASK-0094`; start
  `2a26063`); a plan per task, each naming exactly the files its brief allows
  (`loops/release-check/loop.md` + `.ai/planning/SPRINT-CURRENT.md`; and
  `.ai/context/CURRENT_STATE.md` alone); four gates, every one `PASSED` and
  `recorded: true`; `run-end` with nothing closed, parked or pushed.
- Evidence file, verbatim (run root shortened to `<P>`):
  `GATE TASK-0093.a1.validate NAME=validate STATE=PASSED EXIT=0 ELAPSED=3s …`,
  `GATE TASK-0093.a1.registry NAME=registry STATE=PASSED EXIT=0 ELAPSED=1s …`,
  `GATE TASK-0094.a1.validate NAME=validate STATE=PASSED EXIT=0 ELAPSED=3s …`,
  `GATE TASK-0094.a1.registry NAME=registry STATE=PASSED EXIT=0 ELAPSED=2s …`.
- Worktree clean, HEAD unchanged. Denied tool calls: one `bash` each for
  `preflight` and `run-scribe`, one `read` for `task-planner` (finding 8's
  pattern). Awaiting the human's go for the live run.

### Attempt 4 — the first live run, `s10-7-live` (2026-09-24), stopped by the human
- **Go given by the human.** Preflight `proceed`; TASK-0093 planned and
  implemented — exactly the two declared files, and the diff met the brief on
  reading; `validate` and `registry` both `PASSED` on the changed tree.
- **The refuter timed out three times at `role_timeout: 10m`** — not the
  earlier stall: OpenCode's log shows it working, 27–40 model rounds per
  attempt. (The human noted a parallel LM Studio job was loading the machine.)
  On the third timeout the driver did what `ADR-0022` requires for a silent
  refuter: journalled `refuter-mechanical` then **`refuter-synthesised`** —
  `refuted: true` carried into adjudication. **The fail-closed path ran live
  for the first time, and behaved as specified.**
- The adjudicator was deciding over that objection when **the human chose to
  stop**, raise the timeout and rerun. Stopped by PID: the adjudicator call
  (whose kill made the driver retry once — that retry, an orphan after the
  driver died, was stopped too) and the driver (exit 143, so no handover was
  written). TASK-0093's work **stashed by hand, never discarded**:
  `stash@{0}` on `agent/pilot`, *"unattended/s10-7-live/TASK-0093 stopped by
  the human: …"*; a `stopped-by-human` line appended to the journal.
- Findings:
  9. **`role_timeout: 10m` is too short for a thorough refuter** on this
     model. Raised to 30m for the rerun, by the human's choice.
  10. **Rule 2 is structural in prompts, not against the filesystem.** The
      refuter **read `.pilot-scratch/s10-7/gates.json`** (the gate map, with
      its commands) and `binding.md` with its `read` tool. No prompt carried a
      command, but a role with file access can open the map. This bears on
      the sprint's checkpoint question; OpenCode could deny it with a
      per-role `read` rule for the map's path.
  11. **Killing a role call mid-flight triggers the driver's mechanical
      retry**, which starts a fresh call; stopping a run cleanly means
      stopping the driver first. The driver has no stop signal and writes no
      handover when killed.
- Commit: *(this record)*
