# REVIEW-0012 — Sprint S10, unattended runs: the bindings, the gate server, and the pilot

- Task(s) reviewed: `TASK-0086`…`TASK-0097` (S10.1, S10.2, S10.3, S10.5,
  S10.7 and the six tasks the pilot's findings produced); `ADR-0024`,
  `ADR-0025`, `ADR-0026`.
- Reviewer: Claude Opus 5.5 (1M context), 2026-09-24, against `ROADMAP.md`
  Phase 10's exit criteria as written **before** the work (`TASK-0085`).
- Verdict: **approve the work; the sprint cannot close yet** — S10.4 (Bionic)
  has not started. See *Closing*.

## The pre-committed question, answered first

> **Did the OpenCode port actually enforce what the Claude one only asks for
> — demonstrated against an emitted file and a real run, not asserted?**

**Partly — and the pilot is what showed where.** Demonstrated against the
emitted roles and a real run (`TASK-0092`, run `s10-7-live2`):

| What was enforced, observed | What was not |
|---|---|
| Every role invoked `(primary)`, checked against `opencode agent list` before the run, the result handed to preflight as evidence | **Bulk staging.** With the closer's exact emitted permissions, `git add -- .` and `git add -- "."` were **allowed** and staged the whole tree (`TASK-0092` finding 18) — `TASK-0083`'s recorded limitation, now observed live |
| `-m` on every call; a silent refuter synthesised as `refuted: true` — **observed live** in `s10-7-live` | **Reading the gate map.** No prompt carried a command, but the refuter **opened `gates.json`** with its `read` tool (finding 10). Rule 2 is structural in prompts, not against the filesystem |
| No role attempted `git push`, `git add -A`, a reset or a checkout; `git add -A` was denied when tried in isolation | **Staging depends on quoting.** `git add -- .ai/x` denied, `git add -- ".ai/x"` allowed (finding 12) |
| The driver issued no git write in any run | **What the closer writes.** It committed a false self-claim into both task files (finding 17) |

The bulk-staging gap is now caught **structurally at the binding layer** —
the driver halts on any committed file outside the declared paths
(`TASK-0097`) — but that check has run against a stub only. The honest
summary: OpenCode enforces the *command* boundaries it was declared with;
the declarations themselves let through two things the harness depends on
not happening, and the pilot found both.

## Diff summary

| Deliverable | Where | Task |
|---|---|---|
| S10.1 — OpenCode driver, `run-gate.sh`, binding | `skills/unattended-ops/templates/bindings/opencode/` | `0086` |
| S10.2 — Claude Code Workflow template, binding | `…/bindings/claude-code/` | `0087` |
| S10.3 — `mcp-servers/gates/`, first authored server; template repaired; `ADR-0010` superseded | `mcp-servers/`, `tests/smoke-mcp.sh`, `tests/validate.sh`, guide | `0088`, `ADR-0024` |
| Who starts a gate / writes the evidence | loop, role, references, both bindings | `0089`, `ADR-0025` |
| S10.5 — installed for both clients; gates verified connected in both, unwired | `configs/*/README.md` | `0090` |
| Stale emissions pruned | `scripts/emit-agents.py` | `0091`, `ADR-0026` |
| S10.7 — the pilot: two tasks closed unattended, landed | `57dbd49`, `ec0efa4` | `0092`–`0094` |
| Pilot fixes: read resolved paths; preflight evidence; commit-paths check | driver, loop, `agents/preflight/` | `0095`–`0097` |

S10.6 (registry and state) has no task of its own: the registry was
regenerated where a component changed (`0088`, the `gates` row) and
`CURRENT_STATE.md` was updated by every task above; `sync-registry.sh`
reports no diff at review time.

## Exit criteria — six met, one partly

| # | Criterion | Verdict |
|---|---|---|
| 1 | The human authorization block exists before any destructive capability is declared | **Met.** Signed by the human in `TASK-0088` before the server existed; `validate.sh` observed failing with `granted = false` and with a nonexistent `task` path |
| 2 | `ADR-0010` superseded on its own terms, three obligations discharged | **Met.** `ADR-0024`; `smoke-mcp.sh` handshakes authored servers (`PASS gates`); the guide rewritten from a server that ran — which found the template could be neither built nor imported |
| 3 | The OpenCode driver enforces rather than asks — against an emitted file and a real run | **Partly met.** See the answer above: enforced where declared, and two declared boundaries (bulk staging, reading the map) do not hold |
| 4 | A binding reintroduces nothing the role boundary denies | **Met for the binding** — the driver issued no git write in any run, asserted by the stub suite and observed in the real ones. The *role boundary* itself admits `git add -- .`; the binding now catches the result (`TASK-0097`) |
| 5 | A null refuter fails closed in every binding | **Met.** Both suites, revert-proved; **observed live** in `s10-7-live` (`refuter-synthesised` after three timeouts) |
| 6 | No binding states a rule of its own | **Met, for the mechanical part.** `check-binding.sh` accepts both templates filled and the pilot's real binding; it checks declarations, not the Python or JavaScript |
| 7 | The pilot runs, and is believed only if it finds something | **Met.** Two real tasks closed, verified and landed; **eighteen findings**, two of which halted the run correctly before it could act on a wrong premise |

## Findings

### 1. Two correct halts were the harness working, and both were the driver's fault

The first dry run halted because OpenCode's glob tool cannot see `.ai/`; the
second because the driver ran its own step-1 checks and handed preflight
neither result. In both, **preflight refused rather than guessed**, exactly
as its role says. Both defects were in the binding, both were fixed
test-first (`0095`, `0096`), and neither would have been found by the stub
suite, which models OpenCode's tools as always seeing everything.

### 2. The stall was the environment, and the human found it

Runs stalled silently before reaching the model, across three providers. The
cause was a user plugin (`opencode-arcade-hub`) attempting an OAuth that
opened the desktop app — spotted by the human, not by the diagnosis. The
lesson for the harness: **an unattended run inherits every plugin in the
operator's config.** The human removed the plugin; the driver still loads
whatever is installed.

### 3. The stub suites were necessary and nowhere near sufficient

Fifty-two stub tests across the two bindings, every behaviour revert-proved.
The real run then found the glob blindness, the missing preflight evidence,
the skill-read denials, the quoting asymmetry, the bulk-staging allow, the
false self-claim and the timeout sizing — **none reachable by a stub**. This
is the same shape S7's pilot found. Keep doing both.

### 4. The Claude Code binding has not been run at all

It is stub-proven only, and has the commit-paths gap `TASK-0097` closed for
OpenCode. Nothing in S10 exercised it against a real Workflow run.

## Follow-ups

Raised to the backlog (`B-029`…`B-034`), each from a pilot finding:

| ID | From | What |
|---|---|---|
| `B-029` | findings 7, 13 | Roles are denied reading the `unattended-ops` skill their bodies cite — 57 wasted model rounds in one run |
| `B-030` | finding 10 | A role with `read` can open the gate map; deny reads of `gate_map` per role, or move the map outside the worktree |
| `B-031` | finding 17 | Nothing checks what the closer writes in a task file's log; it wrote a false claim |
| `B-032` | `TASK-0097` | The Claude Code binding's `verifyHead()` does not check the commit's file list |
| `B-033` | findings 9, 11 | Timeout sizing (10 m too short for a refuter) and no clean stop: killing a role call triggers a retry, and a killed driver writes no handover |
| `B-034` | findings 12, 16 | OpenCode's permission matching depends on quoting; roles keep reaching for denied shell utilities — both worth a role-body note and an upstream report |

**Left open by S10, stated:** S10.4 (Bionic); `ADR-0022` F7 (long gates inside
the cap — every pilot gate took 1–3 s) and F9 (an interrupted run leaves the
tracker untouched — the one interruption came before any close); F8 in
Bionic.

## Validation results

- `tests/validate.sh`: OK at review time.
- OpenCode binding suite: 26 tests OK; Claude Code suite: 23/23; `gates`
  server: 14 passed; `tests/smoke-mcp.sh --server gates`: PASS.
- `scripts/sync-registry.sh`: no diff.

## Closing

The work is approved. **The sprint stays open** because S10.4 has not
started, and closing S10 over an unstarted deliverable would be the
status-drift this repo has repeatedly had to sweep. Closing — or cutting
S10.4 to a later sprint — is the human's decision.
