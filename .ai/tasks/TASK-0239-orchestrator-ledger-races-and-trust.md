# TASK-0239 — task-orchestrator 0.5.8: ledger writes race-free, worker text framed, state scoped, the hand-off a first-class state

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-07
- Updated: 2026-11-07
- Applies to: `mods/task-orchestrator/`
- Source: the 0.5.7 review of 2026-11-07 (three read-only reviews: code, design, risk; every high finding checked against the source by the coordinator).

## Objective

Four verified high findings closed in one version:

1. **Ledger writes under concurrency.** `dispatch` reads the ledger, awaits, then writes the stale snapshot back (`register.tsx:476-510`); `start` sets `running` unconditionally after awaits so two ticks can spawn one task twice or revive a cancelled one (`:359-371`); `cancel` falls through for a `running` row with no `agentId` and never ticks (`:763-801`); `refreshSession` settles a session twice. Every ledger write becomes an updater over the current rows, `queued→running` is a compare-and-set, `tick` is serialised, cancel refuses "still starting" and ticks after.
2. **Trust boundary.** `note()` appends worker `next`/`reason` text as a user-role message (`:409-420`); dependency `findings` are pasted unframed into the next assignment (`:301-305`); `<cwd>/.claude/task-orchestrator.json` may set `optIn` and `limits` and `saveSettings` persists them (`:127-155`, `routing.ts:231-237`). Notes carry id and status only; `next` is one line of at most 200 characters with a leading `[task-orchestrator]` stripped; dependency findings are indented as quoted data and capped; the cwd file's `optIn` is ignored and its `limits` may only tighten; nothing from the cwd file is persisted.
3. **Store scope.** `task-orchestrator:settings` is keyed by the project root and `task-orchestrator:run` by the session id (`register.tsx:43`, `keep.ts:21`); a session whose first prompt starts with `# Assignment ` gets no protocol and is not turned on.
4. **The hand-off.** A subagent hand-off holds its slot and the writer lock like a session hand-off (`ledger.ts:47`), `overall` reports it as `running`, not `blocked` (`:111`), and `stalledBy` does not tell its dependants to re-dispatch (`:191`); the no-verdict is remembered for the session so later starts hand off at once.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/task-orchestrator/claude/hooks/register.tsx` | 0.5.7, the sites above |
| `mods/task-orchestrator/claude/hooks/ledger.ts`, `contract.ts`, `routing.ts`, `keep.ts` | 0.5.7 |
| `mods/task-orchestrator/claude/hooks/*.test.ts*` | 92 pass |

## Scope

- In: the four items, their tests, README/ARCHITECTURE/DEVELOPING lines that the change falsifies, CHANGELOG, plugin.json 0.5.8.
- Out (recorded for a later task): `..` resolution in `allowedFiles`, Bash writes, the guard lifted when off; `fallback()` stepping down for a full model id and the alias-only `fable` gate; parser code fences and the echoed template; restored `running` rows reconciled against `$.agent.list()`; `cancelled` in `RETRYABLE`; `HOME` vs `USERPROFILE`; the coordinator's own token count; `maxNesting`/`collectTimeoutMs`/providers/telemetry dead settings; the 142 type errors in `register.test.tsx`.

## Likely files

- `mods/task-orchestrator/claude/hooks/register.tsx`, `ledger.ts`, `contract.ts`, `routing.ts`, `keep.ts`, `register.test.tsx`, `ledger.test.ts`, `contract.test.ts`, `router.test.ts`
- `mods/task-orchestrator/README.md`, `ARCHITECTURE.md`, `DEVELOPING.md`, `claude/.claude-plugin/plugin.json`
- `CHANGELOG.md`

## Execution plan

1. Builder: items 1-4 with tests (concurrent dispatch keeps both tasks; a worker end during a dispatch is kept; two ticks start one task once; cancel of a starting row is refused and a cancel frees a slot that the next tick fills; the note has no worker text; findings are fenced; the cwd file's optIn is refused and limits only tighten; settings keyed by project, run by session; an `# Assignment` first prompt gets no protocol; a subagent hand-off holds a slot, is `running` in `overall`, and its dependant is not told to re-dispatch).
2. Reviewer: an independent read of the diff against the four items.
3. Tests, check-mods, docs, version.
4. Live: a two-task dispatch in one message under auto mode; `status` shows both handed off and `run: running`; the Agent calls adopt; one `collect` per end note.

## Acceptance criteria

- [x] Two `dispatch` calls in one message both appear in the ledger; a `turn.complete` during a dispatch's awaits is not reverted (test: `two dispatches in one message both land`)
- [x] Two concurrent ticks start a queued task once (the claim is a compare-and-set, `settle(when)`; the kit's spawn stub is synchronous, so the in-flight window itself is not staged); a task cancelled during `start` stays cancelled (code: the settle after the spawn is conditional, and the worker is stopped by its new id; not staged in the kit)
- [x] `cancel` of a `running` row without an id answers "still starting" (code; not staged, same reason); after a cancel the next queued task starts (test: `hand-offs hold their slots … a cancel starts what queued behind`)
- [x] A hidden note carries `<id> → <role> → <status>` and nothing the worker wrote; a dependency's findings appear indented under a "quoted data" line, at most 1500 characters (test: `the hidden note and the toast carry the mod's words only`)
- [x] `<cwd>/.claude/task-orchestrator.json` with `optIn.frontier: true` is refused with a reason in `status`; its `limits` may only lower the defaults; the store holds the home/`/orchestrate` values only (test: `a project's config file may narrow the limits`)
- [x] Settings are keyed by project (`task-orchestrator:settings:/p` in the test) and the run by session id (`task-orchestrator:run:sess-A`); the old unscoped keys are not read, so `/orchestrate on` is run once more per project
- [x] A session whose first prompt starts with `# Assignment ` gets no coordinator protocol and stays off (test: `a session whose first prompt is an assignment is a worker`)
- [x] Under a no-verdict deny, four dispatches hand off three and queue the fourth behind the cap; a handed-off writer holds the writer lock; `status` shows `run: running (… handed off …)`; a dependant of a hand-off waits on its Agent call (tests in `ledger.test.ts` and `register.test.tsx`)
- [x] README, ARCHITECTURE, DEVELOPING, CHANGELOG, plugin.json 0.5.8
- [x] Live (2026-11-07, desktop, auto mode, after `/reload-plugins --force` and `/orchestrate on`): two `lookup` dispatches in one message both handed off; `status` read `run: running (V1 handed off, V2 handed off)` with no `config refused` line; both Agent calls adopted (`[a64847cd…]`, `[a320a5b6…]`, observed `claude-haiku-5-5/low`); two end notes, one `collect` printed both reports

## Mandatory validations

- [x] `cd mods && claude plugin test task-orchestrator/claude`: 99 pass, 0 fail
- [x] `python scripts/check-mods.py`: OK (5 mods)
- [ ] `tests/validate.sh`: run by the pre-commit hook at the commit

## Risks and rollback

- Serialising `tick` adds latency to a dispatch burst; bounded by the spawn attempts already made.
- Keying the settings by project root turns orchestration off for every project until `/orchestrate on` is run there once; said in the CHANGELOG.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| task-orchestrator | 0.5.8 in the tree, live-checked, uncommitted |

## Execution log

- 2026-11-07 · Claude Code (Fable 5.1, coordinator) · task opened from the review; builder dispatched.
- 2026-11-07 · builder B1 (Sonnet 5.5, high) · `ledger.ts` (hand-off holds slot and lock, `overall`, `stalledBy`, `handoffRoot`) and `contract.ts` (`quotedFindings`, `next` to one line); stopped when auto mode gave its `Edit` of `register.tsx` no verdict three times (a tool failure, not a wrong implementation).
- 2026-11-07 · coordinator · `register.tsx` (`settle(when)`, dispatch inside the updater, the claim in `start`, `noVerdictSeen`, the tick chain, `cancel`, `queuedWhy`, `plain` notes, `projectOverride`/`loadConfig`/`saveSettings`, `settingsKey`, the `# Assignment` guard, `configRefused` in `status`), `keep.ts` (`runKey`), the tests (two updated, six added), docs, 0.5.8.
  - Evidence: `claude plugin test task-orchestrator/claude` → `98 pass, 0 fail`; `python scripts/check-mods.py` → `OK (5 mods)`
- 2026-11-07 · reviewer R4 (Sonnet 5.5, high) · request changes: F1 high, `/orchestrate opt-in` and `providers` changed `config` only, so `saveSettings` wrote the stale `trusted` back (a regression of this task); F2 medium, a `__proto__` key in the project file's `limits` set the prototype of the narrowed object and bypassed the check; F3 two early settles in `start` unconditional; F4 the project file's `policy` was persisted; F5 `return settle(...)` in `Promise<void>` functions; F7 an empty cwd fell back to the legacy shared key; F8 a refused duplicate dispatch shadowed the live assignment, and `cancel` judged a stale row; F10 the `# Assignment` guard took no leading whitespace. All fixed by the coordinator with two tests (opt-in persistence; `__proto__` limits). Recorded, not fixed: F6 (a `notes` append or token sum built from a row read before an await carries that older content), F9 (`sessions` captured when `tick` is called, not when it runs).
  - Evidence: `claude plugin test task-orchestrator/claude` → `99 pass, 0 fail`
- 2026-11-07 · coordinator · live check passed (above). The ledger of the earlier run was present after the forced reload; 0.5.8 reads the per-session run key, which 0.5.7 never wrote, so whether `$.state` survived this reload or the engine kept the instance is not settled by this observation.
