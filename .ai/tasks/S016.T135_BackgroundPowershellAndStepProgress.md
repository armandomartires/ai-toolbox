# TASK-0249 — agent-watch 0.11.3 and 0.12.0: PowerShell background shells, and step progress of a background run

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-07
- Updated: 2026-11-07
- Applies to: `mods/agent-watch/`
- Source: live, 2026-11-07 (desktop 2.1.317/2.1.318): in a sigma-infrastructure session the gates were run through the PowerShell tool. The call passed its 600 s timeout and was moved to the background as `b0xa8rys0`, and the Agents pane never showed it. The owner then asked for a multi-step background run (a gate script of seven gates) to fill its row step by step instead of `0/1` until it ends.

## Objective

A background PowerShell command is a shell row like a Bash one. A background run that prints its known steps (`step n/m <label> <ok|FAIL>`), relayed by a Monitor, shows `n/m` on its row and turns FAILED on a `FAIL`. Also find why agent-watch's `classic.Stop` reconcile never runs on this machine.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `claude/.claude-plugin/types/claude-code-tools/index.d.ts`, PowerShell output | `backgroundTaskId`, `timedOutAfterMs`, `backgroundEndsWithFinalResponse`, as for Bash |
| `mods/agent-watch/claude/hooks/model.ts` | `backgroundStarted` reads Bash and Monitor only; `notificationOf` reads a missing `<status>` as `completed` |
| A Monitor's event, live (2.1.318) | reaches `prompt.submit` with origin `task-notification` as `<event>…</event>` with no `<status>`; its expiry is `<event>[Monitor expired after …]</event>` |

## Scope

- In: `backgroundStarted` for PowerShell; `stepOf`, `monitorEventsOf`, `backgroundStepped`, `backgroundLinked`, `drawnBackground`; `steps` and `linkedTo` on `BackgroundTask`; the STEPS cell, arc, caption, badge and `N RUNNING` count; tests; README (the step convention), DEVELOPING; versions 0.11.3, then 0.12.0.
- Out: `cc-plugin-sec-default@builtin`, which passes every `classic.*` event over the user tier with `next.to(e, "append")`, so `classic.Stop` and `classic.SubagentStop` never reach an installed mod on this machine. That is by design, and only an organization administrator can change it (managed `prependPlugins`). The `document-skills@anthropic-agent-skills` load error (its marketplace is not registered) is unrelated.

## Likely files

- `mods/agent-watch/claude/hooks/model.ts`, `sessions.ts`, `sunburst.ts`, `panel.tsx`, `register.tsx`, `background.test.ts`, `register.test.tsx`
- `mods/agent-watch/claude/types/index.d.ts`, `claude/.claude-plugin/plugin.json`, `README.md`, `DEVELOPING.md`
- `CHANGELOG.md`

## Execution plan

1. Confirm the PowerShell result's fields from the engine's types and the live transcript; accept PowerShell; test; red-prove.
2. Read the cause of the `classic.Stop` skip from the 2.1.317 binary's bundled `cc-plugin-sec-default` module.
3. Prove with a temporary probe that a Monitor's per-line events reach the mod's hooks, and in what shape; remove the probe and its store key.
4. Parser, tie, apply, draw; tests; live 3-step check; docs; versions.

## Acceptance criteria

- [x] A PowerShell `run_in_background` call, or one moved to the background at its timeout, opens a running shell row (start backdated by `timedOutAfterMs`) that its notification ends
- [x] `step n/m <label> <ok|FAIL>` is parsed (`ok`/`FAIL` in any case, label optional); malformed lines, `n` under 1 or above `m`, and `m` above 999 are no step
- [x] A Monitor's event is not an end (the first event used to draw the monitor done); its expiry line is an end, read as `killed`
- [x] A Monitor whose command names a running shell's id as a whole word is tied to it: the shell's row takes the steps, the monitor draws no row and is not counted in `N RUNNING`; untied, the monitor is the row
- [x] The row shows `n/m` in its STEPS cell and arc, `n/m STEPS · <last>` or `· FAIL <label>` in its caption, and the FAILED badge from the first `FAIL` on
- [x] README *How a run reports its steps*, DEVELOPING, plugin.json and the pane's version line 0.12.0, CHANGELOG
- [x] Live: a 3-step PowerShell script in the background with a Monitor tailing its output file filled the row 1/3 → 3/3 and ended `failed`, exit 1, `FAIL typecheck` (read from the store's rows)
- [x] Live, by the human: the same seen in the Agents pane on the desktop (2026-11-07, a 3-step demo run: `1/3 · lint`, `2/3` FAILED with `FAIL typecheck`, `3/3`, `EXIT 1`; the human: "looks ok")

## Mandatory validations

- [x] `cd mods && claude plugin test agent-watch/claude`: 166 pass, 0 fail (the two PowerShell tests fail with the fix taken out)
- [x] `scripts/mod-dev.sh check agent-watch`: OK (5 mods)
- [x] `scripts/mod-dev.sh validate agent-watch`: passed with warnings (no icon, as before)
- [ ] `tests/validate.sh`: run by the pre-commit hook at the commit

## Risks and rollback

- A monitor that names a running shell's id for another reason is tied to it and drawn as part of that run.
- A `FAIL` turns the row FAILED while the run is still running; it still counts in `N RUNNING` until it ends.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| agent-watch | 0.12.0, committed |

Next: none. `.ai/GOALS.md`, `TODO.md` and `CURRENT_STATE.md` were recorded in a second commit, since another session held uncommitted edits to them.

## Execution log

- 2026-11-07 · Claude Code (Opus 5.5, side session of the sigma-infrastructure coordinator) · PowerShell fields confirmed (types and transcript `72b67785…`, `{"backgroundTaskId":"b0xa8rys0","timedOutAfterMs":600000}`); fix, tests, red-proof; sec-default cause read from the binary (`e("classic.*",(n,r,o)=>o.to(r,"append"))`).
  - Evidence: `claude plugin test agent-watch/claude` → `160 pass`; with the fix taken out, both PowerShell tests `(fail)`
- 2026-11-07 · same session · Monitor events proved with a temporary probe (removed, and its store key deleted through `$.store.delete`); 0.12.0 built; live check run.
  - Evidence: `claude plugin test agent-watch/claude` → `166 pass`; store rows: `bheot928z` `failed`, exit 1, `steps {done: 3, total: 3, failed: 'typecheck', last: 'tests'}`, monitor `bhx0rqpyj` `linkedTo: bheot928z`
