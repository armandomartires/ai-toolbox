# ADR-0014 — Accept the pinned ansible MCP surface; narrow it rather than extend it

## Status
**Proposed**, 2026-09-14. Opened by `PLAN-0003` (sprint S6).
**Body written 2026-09-16** against `TASK-0027`'s observed lint result, per
the human decision of the same date: draft the bodies from spike evidence,
leave them `Proposed` for ratification. **Still owes ratification.**

Its stated dependency is met: `TASK-0027` is **done**, so the "do not accept
before that task reports" condition no longer blocks. What remains is a human
act, not more evidence.

## Context

The evidence below was gathered at plan time and **re-verified before being
restated**, per lesson 7 (*planning prose is a hypothesis about files*).
Where a plan-time claim did not survive, that is recorded rather than
smoothed over.

### The capability gap, re-verified
The pinned server (`@ansible/ansible-mcp-server@26.6.0`) exposes ten tools:
`zen_of_ansible`, `ansible_content_best_practices`, `list_available_tools`,
`ansible_lint`, `ansible_navigator`, `ade_environment_info`,
`ade_setup_environment`, `adt_check_env`, `create_ansible_projects`,
`define_and_build_execution_env`. The human-supplied analysis recommended MCP
expose `ansible-doc`, linting, syntax checks, inventory inspection, playbook
preview, execution, and verification. **Linting and execution are present;
the other five are absent — and the two present are the two destructive
ones.** The 2-of-7 count stands.

### `ansible_navigator` cannot express the safe workflow — re-verified 2026-09-15
Its parameters are `userMessage`, `filePath`, `mode`, `environment`,
`disableExecutionEnvironment`. **No inventory, no limit, no `--check`, no
`--diff`.** So it cannot perform a change preview or scope a run, while it
*can* execute a playbook against live managed infrastructure. `TASK-0028`
incidentally re-confirmed on 2026-09-16 that it is **still enabled**, so the
exposure is live until `TASK-0026` lands.

### `userMessage` undercuts the determinism argument
It is a natural-language string the server parses to locate the playbook. The
common claim that MCP provides "deterministic command invocation rather than
inventing shell commands" **does not hold for this tool**: invocation is
LLM-message-parsed, not schema-pinned.

### What the accepted surface is actually good for — now measured, not assumed
`TASK-0027` ran the one non-destructive tool that matters. Its underlying
binary (`ansible-lint 26.8.0`, `ansible-core 2.20.8`) evaluated **53 rules**
against the target estate's two real playbooks under `profile: production`
and returned **0 failures, 0 warnings, exit 0**. So the linting capability is
real and works. Two qualifications that belong in this ADR rather than only
in the task log:

1. **A clean lint result is a narrow claim.** It says the playbooks satisfy
   53 structural rules. It says nothing about whether the modules involved
   implement check-mode meaningfully (ADR-0015's problem) and nothing about
   the `ansible_mounts` hazard, which no built-in rule encodes.
2. **The MCP lint tool inherits a silent-no-op mode.** `TASK-0027` observed
   that a custom `ansible-lint` rule can be **loaded, listed, and never
   evaluated at exit 0** when it is outside the active profile and not named
   in `enable_list`. Since the MCP server invokes `ansible-lint`, any
   estate-specific rule reached *through* MCP is subject to the same trap.
   **A green MCP lint result is not evidence that an estate's own rules
   ran.**

### The reopen trigger, deliberately not pulled
`ADR-0010` deferred the authored (Python) MCP shape **with a reopen
trigger**, recording that it "needs a real reason … not a synthetic one". The
2-of-7 gap is arguably such a reason. **The human decided on 2026-09-14 not
to pull it in S6**, and nothing found since changes that: the missing
capabilities are all available from the control venv's own binaries, which
`TASK-0027` used directly and successfully.

## Decision

1. **Accept the pinned surface as-is.** No Python MCP server is authored in
   S6. **`ADR-0010` stays closed and its reopen trigger is explicitly not
   pulled** — recorded here so that the next reader who notices the 2-of-7
   gap does not re-raise it as new. That is the B-009 failure mode, where an
   item was raised from a single grep hit against a false premise, and the
   gap here is the opposite case: **it was measured, and accepting it was a
   decision.**
2. **Narrow rather than extend.** `ansible_navigator` is disabled in all
   three wiring snippets (`TASK-0026`). The missing capabilities are supplied
   by the control venv's own binaries, invoked through the skill and the
   loop — the route `TASK-0027` proved works — never by adding MCP tools.
3. **Record what the accepted surface is good for, and what it is not.**
   Good for: asking about installed modules, running `ansible-doc`,
   scaffolding, and **linting** — the last now demonstrated rather than
   asserted. Weak at: enforcing an organisation's workflow, and preventing
   unsafe production actions, because the server enforces no controls of its
   own.
4. **A green MCP lint result carries the caveat in Context 2.** Any component
   that tells an agent to lint through MCP must not present a pass as
   evidence that estate-specific rules were evaluated. This binds
   `TASK-0031`, whose guard is exactly such a rule.

## Consequences

- **The MCP layer contributes little to this repo's Ansible story, and the
  spike confirmed rather than softened this.** Both playbooks in the target
  estate are read-only, the server's two relevant tools are one linter and
  one disabled executor, and the linter's value was realised by calling the
  venv binary directly. **The value in S6 is in the skill, the loop and the
  guard — not in MCP.** That is the plan's finding 6 (value inverts from the
  analysis's ranking) surviving contact with evidence.
- **Accepting a surface is not endorsing it.** Read this ADR as "we chose not
  to build a server", never as "the pinned server is sufficient".
- **The 2-of-7 gap remains a standing, measured observation.** If a future
  task needs structured preview or verification through MCP, `ADR-0010`'s
  trigger is the correct route — reopened deliberately, with a task and a
  human decision, not by drift.
- **A new consequence the plan did not forecast:** because the pinned server
  shells out to `ansible-lint`, this repo's guard can reach agents *through*
  MCP without any change to the server or this ADR. That is a genuine benefit
  of accepting the surface — it was `TASK-0027`'s deciding argument for the
  custom-rule route — but it is **conditional on the rule being proven to
  fire**, per Context 2.
- **Risk this ADR must not create:** a future reader concluding the gap was
  unnoticed. It was enumerated live, counted, and accepted.
- **Ratification still owed.** This body rests on `TASK-0027`'s observations;
  the decision to accept rather than build remains the human's, and the ADR
  stays `Proposed` until they take it.
