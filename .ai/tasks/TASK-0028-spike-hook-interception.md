# TASK-0028 — Spike: can a client hook intercept an MCP tool call?

## Objective
Determine, by evidence rather than belief, whether Claude Code's
`PreToolUse` hooks can match and block a call to an MCP-provided tool
(e.g. `mcp__ansible__ansible_navigator`), and what OpenCode's equivalent
mechanism is — or whether it has one.

This single fact decides whether a hooks component category is worth
having at all (ADR-0016). It is **deliberately non-blocking**: TASK-0031's
guard works at the git/lint layer regardless of the answer.

## Minimal context

### Why this must be a spike and not an assertion
The premise behind hooks — "a skill says follow this process, a hook says
it cannot be bypassed" — is only true for MCP tool calls if hooks can
*see* MCP tool calls. I believe they can via tool-name matchers, and that
belief is exactly what must not go into an ADR unverified.

This repo has already paid for that error once. TASK-0019 retracted a
default-branch mismatch that never existed, and `CURRENT_STATE.md` keeps
it visible for the pattern rather than the non-gap: **a claim about
external state restated three times without re-verification, each time
more specific.** A hooks category built on an unverified interception
claim would be the same error with a larger blast radius.

### What the repo currently knows about hooks: nothing
Established by exploration during PLAN-0003: zero occurrences of "plugin"
anywhere in the repo; zero of `PreToolUse`, `PostToolUse`, `SessionStart`,
`UserPromptSubmit`; zero of `settings.json`. All 130 matches for "hook"
refer to the git pre-commit gate. `configs/claude-code/README.md` knows
only `~/.claude.json` and `.mcp.json`, both MCP-only surfaces — Claude
Code's hooks live in `settings.json`, which this repo has never
referenced.

So this is genuinely new ground, not a gap in documentation of something
already used.

### Why the answer may not favour hooks
Two structural problems exist independently of the interception question,
and the spike should weigh them:

- **Two implementations, one capability.** Claude Code hooks are JSON
  configuration invoking shell commands; OpenCode's equivalent is a
  TypeScript plugin. `AGENTS.md` requires components be "portable across
  every client that supports its capability" — two unrelated
  implementations of one guard is a real portability problem, not a
  packaging detail.
- **No category plumbing exists.** `sync-registry.sh:114-124` has three
  hardcoded sections; `install.sh:36-39` has one hardcoded skills-target
  path per client with MCP print-only; `validate.sh` has ~8 hardcoded path
  patterns. A new top-level directory would be **silently ignored** by all
  three and by CI's staleness check — invisible rather than loud. And
  precedent is poor: `prompts/` and `agents/` are declared categories with
  3-line stub READMEs and zero tooling.

### The decision this feeds
Human decision, 2026-09-14: **the working guard beats the portable
abstraction.** If hooks cannot intercept MCP calls, or can only do so in
one client, ADR-0016's answer is "no category" and the guard ships as a
portable script with documented `pre-commit`/`ansible-lint` wiring. That
is the expected outcome; this spike exists to make it an informed one.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `PLAN-0003` | this session | Written; records the two structural problems above and the expected "no" |
| Claude Code installation | pre-existing | Present on this machine; `~/.claude/` exists (`install.sh:37` targets `~/.claude/skills`) |
| OpenCode installation | pre-existing | Present — this session runs in it; `~/.config/opencode/` exists |
| `mcp-servers/ansible/server.json` | TASK-0007 | The server whose tool names would be matched. **Note: TASK-0026 may have disabled `ansible_navigator` by the time this runs** — if so, use another tool name for the probe |
| `scripts/install.sh` | TASK-0006, TASK-0014 | `:36-39` hardcoded client list; no third deploy path |
| `scripts/sync-registry.sh` | TASK-0011 | `:114-124` three hardcoded sections |
| Vendor documentation | external | **Must be fetched and read, not recalled.** Versions change; a remembered API is a stale claim |

**Verify the expected state; don't assume it.** Especially the last row:
read the current vendor docs. If TASK-0026 has already landed, do not probe
with a disabled tool and misread its absence as a hook failure.

## Scope

### Included
- Read current Claude Code hooks documentation; establish whether tool-name
  matchers apply to MCP-provided tools and what the naming convention is.
- Read current OpenCode plugin/hook documentation; establish whether an
  equivalent interception point exists.
- If feasible **without risk**, prove it: a hook that matches a read-only
  MCP tool and blocks or logs it. A read-only tool only —
  `list_available_tools` or `zen_of_ansible`, never `ansible_navigator`.
- Record exactly what was observed versus what was only read.
- Recommend for ADR-0016, including the two-implementations problem.

### Not included
- Implementing any production hook. That is a later task, only if ADR-0016
  says yes.
- Adding a `hooks/` directory or any category plumbing.
- Probing with a destructive tool, in any client, under any circumstances.
- Any change to `SIGMA-infrastructure`.
- Changing this machine's client configuration **permanently**. Any probe
  config must be reverted, and the revert verified.

### Explicitly open
Whether "hooks" is even the right name for the category, if one is
created. OpenCode calls its mechanism a plugin. Naming a category after one
vendor's term for a capability the other implements differently is how the
`ADR-0013` confusion started.

## Likely files
- `.ai/tasks/TASK-0028-spike-hook-interception.md` — the findings land in
  this brief's execution log
- possibly `~/.claude/settings.json` — **temporarily**, reverted and
  verified reverted
- possibly `/tmp/opencode/hook-spike/` for any probe scaffolding
- no committed component files

## Execution plan
1. Fetch and read the current Claude Code hooks documentation. Record the
   URL and what it says about matchers, MCP tool naming, and whether a hook
   can *block* rather than merely observe.
2. Fetch and read OpenCode's plugin documentation. Determine whether a
   pre-tool-execution interception point exists.
3. Record the state of `~/.claude/settings.json` before touching anything
   (exists? contents? absent?).
4. If a safe probe is possible: configure a hook matching a **read-only**
   ansible MCP tool, invoke that tool, observe whether the hook fires.
5. Revert the probe configuration. **Verify the revert** by re-reading the
   file and comparing to step 3 — `release-check` step 4: a script
   reporting success is not evidence the effect happened.
6. If no safe probe is possible, say so and mark the finding
   documentation-only. A documented-but-unproven answer is acceptable here
   **provided it is labelled as such** — that distinction is the whole
   point of this spike.
7. Write the recommendation: category or no category, and if yes, under
   what name and with what per-client implementation split.
8. `bash tests/validate.sh` — only this brief changed; expect green.

## Acceptance criteria
- [ ] Current vendor documentation for both clients read, with URLs
      recorded — not recalled from memory
- [ ] A clear statement of whether Claude Code hooks can match MCP tool
      calls, labelled **observed** or **documented-only**
- [ ] The same for OpenCode, including "no equivalent exists" if that is
      the finding
- [ ] Any probe configuration reverted, and the revert **verified by
      re-reading the file**
- [ ] No destructive tool was used in any probe
- [ ] A recommendation for ADR-0016 that addresses the two-implementations
      portability problem, not only the interception question
- [ ] No file under `/home/armando.martires/SIGMA-infrastructure` modified

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed) — **not expected**

## Risks and rollback
- **Risk: concluding from memory.** The failure mode this spike exists to
  prevent. Every claim must cite a document read this session or an
  observation made this session.
- **Risk: leaving a hook installed.** A stray `PreToolUse` hook silently
  altering tool behaviour in future sessions would be a genuinely nasty
  artifact. Step 5 is mandatory, including the verification re-read.
- **Risk: probing with a destructive tool.** Would be a live infrastructure
  change dressed as a test. Read-only tools only.
- **Risk: a negative result reading as failure.** "Hooks cannot intercept
  MCP calls" is a **successful** spike outcome — it saves building a
  category on a false premise. Record it as such.
- **Risk: scope creep into building the hook.** This task ends at a
  recommendation.
- **Rollback:** no committed component changes; revert the brief if needed.
  The only external state touched is a client config file, reverted in
  step 5.

## Outputs / handover

**Intended end state — this task has not run.** A plan, not a state;
`validate.sh` cannot tell the difference, so this sentence does.

| Artifact | Intended end state |
|----------|-------------------|
| This brief's execution log | Both clients' interception capability, each labelled observed vs documented-only, with URLs; probe result if any; recommendation |
| `~/.claude/settings.json` | **Byte-identical to its pre-task state**, verified by re-reading |
| ADR-0016's evidence base | Sufficient to decide category-or-not without further investigation |
| `SIGMA-infrastructure` | **Untouched** |

**Next task starts here**: ADR-0016 can be written. If the answer is "no
category" — the expected outcome — TASK-0031 proceeds as a portable script
plus documented wiring, and no plumbing changes to `install.sh`,
`sync-registry.sh` or `validate.sh` are needed.

Deviation to watch for: if interception **does** work in both clients,
ADR-0016 becomes a genuinely harder decision and TASK-0031's scope grows
to include category plumbing. Do not let that expansion happen silently —
it would need its own tasks and the human's agreement, since it was scoped
out at plan time.

## Status
- Status: planned
- Owner: agent
- Created: 2026-09-14
- Updated: 2026-09-14

## Execution log
### Attempt 1
- Date:
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
