# ADR-0014 — Accept the pinned ansible MCP surface; narrow it rather than extend it

## Status
**Proposed**, 2026-09-14. Opened by `PLAN-0003` (sprint S6).

Depends on TASK-0027's observed lint result. **Do not accept this ADR
before that task reports** — the whole point of sequencing the spike first
is that this decision rests on evidence rather than on the analysis that
prompted it.

## Context

To be completed when this ADR is written. The evidence gathered at plan
time, all of which must be **re-verified** before being restated here
(lesson 7: planning prose is a hypothesis about files):

- **The pinned server exposes 2 of the 7 recommended capabilities.** A
  live enumeration of `@ansible/ansible-mcp-server@26.6.0` returned ten
  tools: `zen_of_ansible`, `ansible_content_best_practices`,
  `list_available_tools`, `ansible_lint`, `ansible_navigator`,
  `ade_environment_info`, `ade_setup_environment`, `adt_check_env`,
  `create_ansible_projects`, `define_and_build_execution_env`. The
  human-supplied analysis recommended MCP expose `ansible-doc`, linting,
  syntax checks, inventory inspection, playbook preview, execution, and
  verification. **Linting and execution are present; the other five are
  absent** — and the two present are precisely the two destructive ones.
- **`ansible_navigator` cannot express the safe workflow.** Its parameters
  are `userMessage`, `filePath`, `mode`, `environment`,
  `disableExecutionEnvironment`. No inventory, no limit, no `--check`, no
  `--diff`. So it cannot perform a change preview or scope a run, while it
  can execute a playbook against live managed infrastructure.
- **`userMessage` undercuts the determinism argument.** It is a
  natural-language string the server parses to locate the playbook. The
  common claim that MCP provides "deterministic command invocation rather
  than inventing shell commands" does not hold for this tool: invocation
  is LLM-message-parsed, not schema-pinned.
- **The control venv's own `ansible-playbook` strictly dominates it** for
  every safety-relevant purpose.
- **ADR-0010** deferred the authored (Python) MCP shape **with a reopen
  trigger**, recording that it "needs a real reason … not a synthetic one".
  The 2-of-7 gap is arguably such a reason. The human decided on
  2026-09-14 **not** to pull that trigger in S6.

## Decision

To be written. The intended shape, per the human's decisions at plan time:

1. **Accept the pinned surface as-is.** No Python MCP server is authored
   in S6; ADR-0010 stays closed and its reopen trigger is deliberately not
   pulled. This ADR must close that door **explicitly**, so the next reader
   who notices the capability gap does not re-raise it as a new item — the
   B-009 failure mode, where an item was raised from a single grep hit
   against a premise that turned out to be false.
2. **Narrow rather than extend.** `ansible_navigator` is disabled in all
   wiring snippets (TASK-0026). The missing capabilities are supplied by
   the control venv's own binaries, invoked through the skill and loop,
   not by new MCP tools.
3. **Record what the accepted surface is actually good for**, per the
   analysis's own honest table: asking about installed modules, running
   `ansible-doc` accurately, scaffolding, linting and inspecting results,
   and invoking existing trusted automation. It is weak at enforcing an
   organisation's workflow and weak at preventing unsafe production
   actions unless the server itself enforces controls — which this one
   does not.

## Consequences

To be written. Expected, and to be stated plainly rather than softened:

- The MCP layer contributes **little** to this repo's Ansible story. Both
  playbooks in the target estate are read-only, and the server's two
  relevant tools are one linter and one disabled executor. The value in S6
  is in the skill, the loop and the guard — not in MCP.
- **Accepting a surface is not endorsing it.** This ADR should be readable
  as "we chose not to build a server", not as "the pinned server is
  sufficient".
- The 2-of-7 gap remains a standing observation. If a future task needs
  structured preview or verification through MCP, ADR-0010's trigger is
  the correct route — reopened deliberately, with a task and a human
  decision, not by drift.
- **Risk this ADR must not create:** a future reader concluding the gap was
  unnoticed. It was measured, and the decision was to accept it.
