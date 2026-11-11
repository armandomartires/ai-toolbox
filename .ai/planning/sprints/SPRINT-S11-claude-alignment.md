# Sprint S11 — Claude-centric alignment

**OPEN — promoted 2026-11-10** by `TASK-0286`, on the human's decision, in the same commit that added **Phase 11** to `ROADMAP.md`.

Planned from `docs/reports/2026-11-10-alignment/ALIGNMENT-PLAN.md` (commit `a4704ca`), with all fifteen decisions answered in `docs/reports/2026-11-10-alignment/decisions.yaml`. No item is blocked by a decision any more.

## Goal

Raise the alignment score from **54.5 / 100** toward a Claude-centric toolbox with generated ports. The assessment's weakest dimensions are packaging (1/4), subagents and orchestration (1/4, Claude Code gets 4 of 15 roles), hooks, evals and MCP hygiene (2/4 each). The sprint makes the marketplace and plugins the primary Claude Code install, lets the roles reach Claude Code with their boundaries proven, adds a Claude provider and a larger multi-trial eval suite, and turns OpenCode and Codex into ports generated from a Claude Code reference profile.

## Decisions record

| Id | Answer | Effect |
|----|--------|--------|
| D1 | B | P1.1 starts with a measurement, one fixture per refused term (like TASK-0107). A new ADR supersedes ADR-0018 clause 8.3 only for the terms that pass. |
| D2 | B | Marketplace and plugins are the primary Claude Code install; `install.sh` stays for development and non-Claude ports. |
| D3 | B | Per-role tiers, default `inherit`, table kept in `.ai/context` (opus: adjudicator, critic, designer-manager, refuter, task-planner; sonnet: git-ops, ideator, implementer, qa-test, review; haiku: closer, gate-runner, park-steward, preflight, run-scribe). ADR-0017 is rejected and ADR-0018 clause 7 forbids the table, so `TASK-0268` starts with a new ADR, which the human accepted in advance on 2026-11-10 within that brief's scope. |
| D4 | B | Short `CLAUDE.md` importing `@AGENTS.md` plus Claude-only notes; `.claude/rules/` tracked; supersedes ADR-0002. |
| D5 | B | Add a Claude Agent SDK runner next to the current binding, compare on the golden run, then pick. |
| D6 | A, B, C | OpenCode supported (generated port, tests); Codex supported (S2 done); Bionic and LM Studio best-effort, untested. |
| D7 | B | gates gets an HTTP transport behind OAuth 2.1, sandboxed, with its own ADR; P2.6 stays HIGH risk. |
| Q8 | D | GitLab marketplace plus the claude.ai org library. |
| Q9 | C | k=5 trials, nightly, all three providers (Anthropic, xAI, OpenAI). |
| Q10 | A | The role guard answers `ask` for out-of-allowlist calls for two weeks, then `deny`. |
| Q11 | B | Plugins per component kind: skills, agents plus role guard, gates MCP, with dependencies. Counts of 8 skills, the agents the emitter emits for Claude Code and the gates server are taken across the three. |
| Q12 | B (re-decided 2026-11-10, was A) | Lock the 12 tools `graphify serve` lists and correct the manifest's prose; 17 was not reachable (four tools belong to the unwired ontology server, one name is the server). |
| Q13 | C | Permission rules everywhere; sandbox for unattended runs only. |
| Q14 | B | The Stop hook runs a fast subset (frontmatter, registry, hidden-Unicode) only when tracked files changed. |
| Q15 | B | Packaging first with the 4 current roles; the role guard after. |

## Deliverables

Plan ids in brackets. "Depends on" lists task ids; a soft dependency is marked.

### P0 — quick wins

| Task | Plan item | Depends on | What |
|------|-----------|------------|------|
| `TASK-0266` | P0.1 (Q1) | none | Marketplace manifest over the four mods; `claude plugin validate` in `tests/test-mods.sh`. |
| `TASK-0267` | P0.2 (Q2) | none (key in Vault) | Anthropic provider in `evals/run.py`; nightly live jobs for three providers. |
| `TASK-0268` | P0.3 (Q3) | none | New ADR superseding ADR-0018 clause 7 (human acceptance), then the 15-role tier table in `.ai/context`; `emit_claude_code` emits aliases. |
| `TASK-0269` | P0.4 (Q4) | none | gates tool annotations; new gates `server.json` and lock; graphify locked at 17 tools (live `tools/list` must serve 17, else stop and ask the human); listed-equals-locked CI check. |
| `TASK-0270` | P0.5 (Q5) | none | Stale loop text corrected; validate grep check. |

### P1 — near term

| Task | Plan item | Depends on | What |
|------|-----------|------------|------|
| `TASK-0271` | P1.1 (N1), HIGH | `TASK-0268`; after `TASK-0272` (Q15=B); `TASK-0276` (soft, owns the push rules its fixtures assert) | Measure each refused term, then the role guard, ask-then-deny, ADR for passing terms. |
| `TASK-0272` | P1.2 (N2) | `TASK-0266`; `TASK-0271` relaxed by Q15=B | Three plugins (skills, agents plus role guard, gates MCP); closes on the emitter's agent count for `claude-code` (4 today) without waiting for `TASK-0271`, which adds the passing roles and their plugin entries. |
| `TASK-0273` | P1.3 (N3) | `TASK-0274` (the linter must accept `disable-model-invocation`); `TASK-0272` (soft, for the plugin build) | Five loop skills with `disable-model-invocation`, added to the skills plugin build. |
| `TASK-0274` | P1.4 (N4) | none | Claude skill controls in schema, linter and ports. |
| `TASK-0275` | P1.5 (N5) | none | `CLAUDE.md` imports `@AGENTS.md`; tracked `.claude/rules/`; supersedes ADR-0002. |
| `TASK-0276` | P1.6 (N6) | none | Permission rules everywhere; sandbox for unattended runs. |
| `TASK-0277` | P1.7 (N7) | none | Stop hook running the fast check. |
| `TASK-0278` | P1.8 (N8) | `TASK-0267` | 20 or more golden tasks, `--trials`, pass@k and pass^k, transcripts, skill-trigger evals. |
| `TASK-0279` | P1.9 (N9) | none | Claude Code OpenTelemetry to the collector. |

### P2 — strategic

| Task | Plan item | Depends on | What |
|------|-----------|------------|------|
| `TASK-0280` | P2.1 (S1), HIGH | `TASK-0271`, `TASK-0272` | Claude Code reference profile; OpenCode and Codex generated from it; parity matrix. |
| `TASK-0281` | P2.2 (S2) | `TASK-0280` | Codex install step: skills, custom agents, hooks. |
| `TASK-0282` | P2.3 (S3) | `TASK-0271` | Long-run harness alignment: progress file, commit per task, `maxTurns`. |
| `TASK-0283` | P2.4 (S4) | `TASK-0272` | Per-plugin tags and versions, signing, provenance, `cosign verify`. |
| `TASK-0284` | P2.5 (S5) | `TASK-0271`, `TASK-0282` | Agent SDK runner beside the current binding; golden-run comparison. |
| `TASK-0285` | P2.6 (S6), HIGH | none | Gates over HTTP behind OAuth 2.1, sandboxed, with an ADR. |

## Execution order

From the plan's "Order of execution", with Q15 = B applied.

1. **P0 first, in parallel.** `TASK-0266`, `TASK-0267`, `TASK-0268`, `TASK-0269` and `TASK-0270` have no item dependencies.
2. **Independent P1 items, any time.** `TASK-0274`, `TASK-0275`, `TASK-0276`, `TASK-0277` and `TASK-0279` have none; `TASK-0278` follows `TASK-0267`.
3. **Packaging track.** `TASK-0266` then `TASK-0272`, shipped with the 4 current roles (Q15=B). The plan's dependency of `TASK-0272` on `TASK-0271` is relaxed: `TASK-0272` closes on the emitter's agent count for `claude-code`; `TASK-0271` later adds `claude-code` to the passing roles and the agents plugin carries them. Under D1=B not every role may pass, so 15 agents is not a target.
4. **Role enforcement track.** `TASK-0268` then `TASK-0271` (measure, then guard, ask for two weeks, then deny). Its two-week trial runs while the later items proceed.
5. **After the plugins:** `TASK-0273` (soft on `TASK-0272`, and after `TASK-0274`), `TASK-0283`.
6. **After `TASK-0271` and `TASK-0272`:** `TASK-0280`, then `TASK-0281`.
7. **After `TASK-0271`:** `TASK-0282`, then `TASK-0284` (also needs `TASK-0282`).
8. **Human-gated, no item dependency:** `TASK-0285` depends on nothing and can start any time; it needs the human's authorization for any live exposure.

## Answers that are not the assessment's recommendation

Four answers differ from what the assessment recommended (Q12 was re-decided to the recommendation on 2026-11-10). Each one carries a cost the tasks name.

| Decision | Chosen | Recommended | Consequence |
|----------|--------|-------------|-------------|
| D5 | Add the SDK runner and compare (B) | Defer (D) | Two unattended runners to maintain during the trial; `TASK-0284` ends with a comparison note and a date to pick one. The Python SDK stays optional. |
| D7 | HTTP behind OAuth 2.1 (B) | stdio only (A) | An execution server becomes network-reachable. `TASK-0285` needs its own ADR, default-off transport, mandatory authentication, a sandbox and no live exposure without the human. P2.6 stays HIGH risk. |
| Q9 | k=5, nightly, three providers (C) | k=3, weekly Claude (B) | The highest API spend of the four options. `TASK-0267` and `TASK-0278` set a job timeout and a spend cap, and estimate cost before the first run. |
| Q11 | Three plugins by component kind (B) | One core plugin (A) | Dependencies and versions between three plugins to keep in sync. `TASK-0272` tests the counts across the three; `TASK-0283` owns the version rule; plugin subagents ignore hooks and `mcpServers`, so the guard sits in plugin-level hooks keyed on `agent_type`. |

## Task numbering

This sprint allocates `TASK-0266` to `TASK-0285`, in plan order (P0.1 = `TASK-0266` through P2.6 = `TASK-0285`). All briefs were written 2026-11-10 with status `planned`. `TASK-0286` opened the sprint. **Next free id: `TASK-0291`** (`TASK-0289` went to a Backlog fix on 2026-11-11; `TASK-0288` is held by an unpushed commit in the main checkout, and `TASK-0287` stays free).
