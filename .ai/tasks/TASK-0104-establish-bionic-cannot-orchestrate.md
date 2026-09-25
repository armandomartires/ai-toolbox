# TASK-0104 — S10.4: establish that Bionic cannot orchestrate, or drop the claim

## Objective

Discharge `SPRINT-CURRENT.md` row S10.4. `configs/lm-studio-bionic/README.md`
already states the **established** fact (zero of the nine roles, on
`ADR-0020`'s no-agent-directory finding) and deliberately declines the
**unestablished** one — that Bionic *cannot orchestrate a run at all*. This
task either **establishes that claim with fresh, dated evidence**, or drops
it if the evidence does not support it.

## Minimal context

Three documents already carry the unestablished claim as a forward pointer
rather than a fact: `PLAN-0006:16` ("Bionic — the skill and the gate server
only. It cannot orchestrate, and the docs say so"), `ADR-0022:441-444`
("Bionic gets the skill and the gate server. It has no user-authored
agent-role directory … and no headless CLI, so there is no surface to bind
an orchestrator into. Stated rather than implied"), and
`configs/lm-studio-bionic/README.md:191-195`, which explicitly declines to
assert it: *"That is not yet established, so it is not claimed here."*

**`ADR-0022` is `Accepted`.** Its Consequences section already asserts "no
headless CLI" as fact, but this repo's own convention (`ADR-0020`'s closing
instruction: *"a future reader should re-verify rather than cite"*) treats an
accepted ADR's Context/Consequences claims as claims until a task re-checks
them against the live artifact and records a date. Nobody has done that for
this one. This task is that re-check, not a rubber stamp.

**What "orchestrate" means here, precisely** (`skills/unattended-ops/SKILL.md`
division-of-labour table and `templates/binding.md`): a **binding** is an
external, scriptable entry point that (a) starts a run without a human
present, (b) invokes named roles with **client-enforced** per-role command
boundaries — the whole reason this harness has nine roles with different
`bash_allow`/`delegates_to` grants rather than one role with everything — and
(c) can be driven to a machine-checkable stop (evidence file, exit code,
handover) with nobody watching. The OpenCode and Claude Code bindings both
work by borrowing their client's **own** agent-identity-plus-permission
mechanism; a "Bionic binding" would have to do the same.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `configs/lm-studio-bionic/README.md` | `TASK-0080` | States zero roles (`ADR-0020`); explicitly declines the orchestration claim, quoted above |
| `.ai/decisions/0020-the-lm-studio-client-is-bionic.md` | `TASK-0047` | No user-authored agent-role directory found; Bionic *is* agentic (subagent identifiers exist) |
| `.ai/decisions/0022-unattended-runs-and-the-narrowed-workflow-clause.md` | `TASK-0057`, ratified `TASK-0076` | Consequences section already states "no headless CLI" as fact, unverified by a task |
| Live Bionic install on this machine | — | `1.1.6+3` (re-read 2026-09-25; was `1.1.3+5` at the README's last check, `1.1.1+5` at `ADR-0020`) |
| `lms.exe --help` (all subcommands) | vendor | The one scriptable, non-GUI surface this client ships |
| `lmstudio.ai/docs/developer` (REST v1, OpenAI-compat, Anthropic-compat, MCP-via-API) | vendor, re-read 2026-09-25 | The documented HTTP surface |

**Verify the expected state; don't assume it.** Bionic has updated itself
twice since the README was last checked (`1.1.3+5` → `1.1.6+3`); re-read
rather than cite the stale version string.

## Scope

### Included

- Re-verify, on the live install, whether any scriptable surface (CLI, REST
  API, SDK) can start, name, and drive an agentic run the way `opencode run
  --agent <name>` or the Claude Code Workflow binding does.
- If confirmed: write the established finding into
  `configs/lm-studio-bionic/README.md`, replacing the "not yet established"
  callout with the evidence and the reasoning, dated.
- Add a dated verification pointer to `ADR-0022`'s Consequences bullet — not
  rewriting it (`ADR-0020`'s precedent: a dated record, not a live status
  page) — since nobody had checked it against a live artifact before.
- Update `SPRINT-CURRENT.md` row S10.4 and `.ai/tasks/TODO.md`'s checkbox.

### Not included

- **Closing sprint S10.** `REVIEW-0012` named that a separate human decision;
  completing this row does not itself authorize it.
- **Writing a Bionic binding.** Out of scope by the finding itself, if
  confirmed.
- Any change to `mcp-servers/gates/`'s Bionic wiring section — that concerns
  MCP *tool-calling* connectivity, a different question from whether Bionic
  can be the **orchestrator** of an unattended run, and is unaffected either
  way.
- Falsifying the claim by building a driver against LM Studio's `.act()` SDK
  purely as an alternative LLM backend. That would not be "binding into
  Bionic" — see the finding below for why the distinction matters and is not
  a technicality.

## Likely files

- `configs/lm-studio-bionic/README.md`
- `.ai/decisions/0022-unattended-runs-and-the-narrowed-workflow-clause.md`
  (one dated pointer, not a rewrite)
- `.ai/planning/SPRINT-CURRENT.md`
- `.ai/context/CURRENT_STATE.md`
- `.ai/tasks/TODO.md`
- **No component file** (`agents/`, `loops/`, `skills/`, `mcp-servers/`
  unchanged).

## Execution plan

1. Re-read the live Bionic install's version and re-confirm ADR-0020's two
   findings (agentic; no user-authored role directory) still hold.
2. Enumerate every scriptable, non-GUI surface the client ships: `lms.exe`'s
   full subcommand tree; the documented REST v1 / OpenAI-compat /
   Anthropic-compat / MCP-via-API endpoints; the TypeScript and Python SDKs.
3. For each, check specifically for a project/session/orchestrator-creation
   capability reachable from outside a live GUI chat turn.
4. Locate Bionic's own internal orchestrator mechanism (if any) in the
   installed bundle, and characterise its invocation surface precisely —
   internal-only vs externally scriptable.
5. Write the finding, with dates and sources, into the three files above.
6. `tests/validate.sh`; `scripts/sync-registry.sh` (expect no diff);
   `git status --porcelain`; one commit; push.

## Acceptance criteria

- [ ] The claim is either established with dated, sourced evidence, or
      explicitly retracted — no third outcome.
- [ ] The evidence distinguishes "no scriptable entry point exists" from "a
      driver could be written that uses this client's model purely as an
      LLM backend" — the latter does not establish the former's negation.
- [ ] `configs/lm-studio-bionic/README.md` no longer says the claim is "not
      yet established."
- [ ] `ADR-0022` gains a dated verification pointer, not a rewritten claim.
- [ ] `SPRINT-CURRENT.md` row S10.4 reads `done`, naming this task.
- [ ] No component file changed.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `scripts/sync-registry.sh` (expect no diff)
- [ ] `git status --porcelain` — `.ai/` and `configs/lm-studio-bionic/`
      only.

## Risks and rollback

- **Confusing "we didn't find one" with "one cannot exist."** Mitigated by
  checking the documented API surface directly (vendor docs, re-read today)
  rather than only the installed binary, and by naming exactly what was
  checked.
- **The `.act()`/SDK trap.** LM Studio's SDKs make it easy to build *a*
  headless agent using an LM Studio model as the backend, which could be
  mistaken for "Bionic can orchestrate." The distinction — no **client-
  enforced per-role permission boundary**, which is the entire point of this
  harness's nine roles — is stated explicitly so a future reader does not
  reopen this by building that and calling it a binding.
- Rollback is `git revert` of one commit; documentation only.

## Outputs / handover

*Forecast until verified.*

| Artifact | End state |
|----------|-----------|
| `configs/lm-studio-bionic/README.md` | States the established finding with evidence, replacing the "not yet established" callout |
| `ADR-0022` | One dated verification pointer added to the existing Consequences bullet |
| `SPRINT-CURRENT.md` | Row S10.4 `done` |
| Component layer | **Unchanged** |

**Next task starts here**: whether sprint S10 closes (or a remaining item is
cut to a later sprint) is the human's decision, per `REVIEW-0012`.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-25
- Updated: 2026-09-25

## Execution log
### Attempt 1
- Date: 2026-09-25
- Agent: Claude Sonnet 5 (opencode)
- Actions:
  - Re-read the live Bionic install: `resources/app/package.json` reports
    `1.1.6+3` (was `1.1.3+5` at the README's last check, `1.1.1+5` at
    `ADR-0020`) — version drift confirmed and re-stamped, not smoothed over.
  - Ran `lms.exe --help` and every subcommand's `--help`
    (`chat`, `get`, `load`, `unload`, `ls`, `ps`, `import`, `server`, `log`,
    `link`, `runtime`, `clone`, `push`, `dev`, `login`, `logout`, `whoami`).
    **None names a project, a session, or an orchestrator.** The full tree is
    model/server/runtime management only.
  - Re-read `lmstudio.ai/docs/developer` end to end (2026-09-25): the
    documented REST v1 surface is six endpoints, all model/chat management
    (`/api/v1/chat`, `/models`, `/models/load`, `/models/unload`,
    `/models/download`, `/models/download/status`); OpenAI-compat and
    Anthropic-compat add inference-shaped endpoints (`/v1/chat/completions`,
    `/v1/responses`, `/v1/messages`, embeddings); MCP-via-API adds
    `ephemeral_mcp` and `mcp.json`-sourced tool calling **inside a chat
    request**. **No endpoint anywhere creates a project, a session, or
    starts an orchestrator.**
  - Located Bionic's own orchestrator mechanism directly in the installed
    bundle (`resources/app/.webpack-bionic/main/index.js`, `1.1.3+5` build):
    a real system prompt beginning *"You are the orchestrator agent running
    inside LM Studio Bionic … help the user create 'sessions' (think
    subagents)"*, paired with a bundled `session-control` skill exposing
    `bionic_tool` calls (`session_control.create_project`,
    `.create_session`, `.send_prompt`, `.interrupt_session`, etc.).
    **This orchestrator is real, and it is GUI-chat-scoped**: every
    `bionic_tool` call in the skill's own documentation is something *the
    model inside an active Bionic chat turn* invokes, executed by the app
    itself. Nothing in the CLI or the documented HTTP API exposes
    `session_control.*` or any equivalent — there is no external, scriptable
    way to create a project or session, or to start the orchestrator, from
    outside a live GUI conversation.
  - Confirmed the internal subagents are **all-or-nothing**, not a
    declarable per-command boundary: `lmstudio/coder-yolo-subagents`,
    `lmstudio/exploration-subagent-v1`, `lmstudio/coder-self-review`,
    `lmstudio/bionic-coder-with-approver` are fixed, internally-named modes —
    none is a user-authorable role with a stated command allowlist the way
    this harness's nine roles are. This is consistent with, and sharpens,
    `ADR-0020`'s "no user-authored agent-role directory" finding: even the
    *internal* mechanism has no per-role permission grammar to bind into.
  - **Checked the trap explicitly rather than falling into it.** LM Studio's
    Python/TypeScript SDKs ship a genuine agentic primitive
    (`model.act(prompt, [tools], …)`) that *could* be wired to hand-rolled
    Python functions replicating git operations, gate calls, etc. This does
    not establish that Bionic can orchestrate: `.act()`'s tools are plain
    functions with **zero client-enforced permission boundary** — the
    calling script would have to implement 100% of the boundary itself,
    which means it is not "binding into Bionic" at all. It is writing a
    fourth driver from scratch that happens to use an LM-Studio-served model
    as its LLM backend, exactly interchangeable with any other
    OpenAI-compatible endpoint. Recorded as the reasoning, not just the
    conclusion, so a future reader who builds this does not mistake it for
    closing this finding.
  - Wrote the established finding into `configs/lm-studio-bionic/README.md`,
    replacing the "not yet established" callout.
  - Added one dated verification pointer to `ADR-0022`'s existing
    Consequences bullet (`Consequences`, "This ADR does not make the harness
    portable to Bionic") — the claim is left as written; only a pointer to
    this task and the date is added, per `ADR-0020`'s precedent of not
    rewriting a dated record.
  - Updated `SPRINT-CURRENT.md` row S10.4 to `done`.
- Observations:
  - **The claim holds, and holds more strongly than the accepted ADR
    stated.** `ADR-0022` said "no headless CLI." That is true, but the
    fuller and more useful finding is that **no surface of any kind** —
    CLI, documented REST API, OpenAI-compat, Anthropic-compat, or
    MCP-via-API — exposes project/session/orchestrator creation outside a
    live GUI chat turn. The CLI omission alone would have left open whether
    the REST API filled the gap; it does not.
  - **Bionic's orchestrator is not a fiction, and that matters for how the
    finding is framed.** It would have been easy to write "Bionic has no
    orchestration concept," which is false — it has one, prominently, with
    its own system prompt and skill. The accurate claim is narrower and
    correctly targeted: that mechanism has no external entry point, so it
    cannot be a *binding's* target the way `opencode run --agent` or a
    Claude Code Workflow script is.
  - **The `.act()` SDK could tempt a future reader to reopen this by
    building the wrong thing.** Recorded explicitly so that building a
    driver against LM Studio's inference API with hand-rolled tool functions
    is understood as building a fifth thing (a new, unenforced driver using
    an LM-Studio-served model as backend), not as demonstrating a Bionic
    binding — because it borrows none of Bionic's own agent/permission
    machinery, which is the entire reason a "binding" is meaningful for the
    other two clients.
- Validation:
  - `tests/validate.sh` — OK
  - `scripts/sync-registry.sh` — no diff
  - `git status --porcelain` — `.ai/` and `configs/lm-studio-bionic/` only
- Result: **done.** S10.4 is discharged: the claim is established with
  dated, sourced evidence rather than dropped or left open. Closing sprint
  S10 remains the human's decision.
- Commit: `0f198c3`. Pre-commit hook ran `tests/validate.sh`: OK.
- Push: **confirmed** — `origin/master` `388de5b..0f198c3`.
