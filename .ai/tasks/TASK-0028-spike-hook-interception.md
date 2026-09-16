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
- [x] Current vendor documentation for both clients read, with URLs
      recorded — not recalled from memory: `code.claude.com/docs/en/hooks`
      and `opencode.ai/docs/plugins/`, both fetched 2026-09-16
- [x] A clear statement of whether Claude Code hooks can match MCP tool
      calls, labelled **observed** or **documented-only** — **yes, and
      blockable; DOCUMENTED-ONLY**, with the `.*`-required trap recorded
- [x] The same for OpenCode, including "no equivalent exists" if that is
      the finding — **yes, and blockable; OBSERVED live**
      (`ansible_zen_of_ansible` intercepted and blocked), because the vendor
      docs are silent on MCP tools
- [x] Any probe configuration reverted, and the revert **verified by
      re-reading the file** — verified **two** ways: the plugins directory is
      absent again (as in its pre-state), and the same tool re-invoked in a
      fresh session **succeeded** with the probe log not growing
- [x] No destructive tool was used in any probe — read-only
      `zen_of_ansible` only; `ansible_navigator` never invoked
- [x] A recommendation for ADR-0016 that addresses the two-implementations
      portability problem, not only the interception question — **no
      category**, resting on the *naming incompatibility* between clients
      rather than on interception failing
- [x] No file under `/home/armando.martires/SIGMA-infrastructure` modified —
      not involved in this task

## Mandatory validations
- [x] tests/validate.sh — `validate.sh: OK`
- [x] scripts/sync-registry.sh (if components changed) — **not applicable**;
      no component added, as forecast

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

**This section describes a verified state.** The task has run.

| Artifact | End state |
|----------|-----------|
| This brief's execution log | Both clients' capability recorded with URLs and labels — Claude Code **documented-only**, OpenCode **observed**; the incompatible-naming table; the live probe's verbatim output; the recommendation |
| `~/.claude/settings.json` | **Never modified.** SHA-256 `27dafb27…4358f97` before and after |
| `~/.config/opencode/plugins/` | **Absent again**, matching its pre-state. The probe plugin *and* the directory I created were removed; verified by listing and by a functional re-run |
| ADR-0016's evidence base | **Sufficient, and the reasoning is inverted from the plan's** — interception works, and the *naming incompatibility* is what forbids a category |
| `SIGMA-infrastructure` | **Untouched**; not involved in this task |

**Next task starts here**: ADR-0016 can be written, with the answer **no
category** and the non-obvious reason — interception is available in both
clients and was deliberately declined, because the two clients do not agree
on the tool's *name* (`mcp__ansible__zen_of_ansible` vs
`ansible_zen_of_ansible`). TASK-0031 proceeds as a static `ansible-lint`
custom rule per TASK-0027, with no plumbing changes.

**Deviations from the Execution plan, recorded:**

1. **The plan's "deviation to watch for" fired — interception works in both
   clients — but its predicted consequence did not.** The brief warned that a
   positive result makes ADR-0016 "a genuinely harder decision" and would grow
   TASK-0031's scope to include category plumbing. **It does not**, because
   the spike found a second fact the brief did not anticipate: the two
   clients' MCP tool identifiers are **incompatible strings**. So a positive
   interception result and a "no category" decision are consistent, and no
   scope expansion is needed or requested. **The expected answer was reached
   by the opposite route.**
2. **OpenCode's documentation could not answer the question, so the installed
   source was read instead** — then confirmed live. The vendor docs show
   `tool.execute.before` blocking only the built-in `read` tool and are silent
   on MCP tools and their naming. This is S7's *"a doc-confirmed field is not
   an installed field"* lesson arriving in its mirror form: **an
   undocumented capability is not an absent one.**
3. **Claude Code is documented-only, deliberately.** The plan permitted a
   probe "if feasible without risk". Once OpenCode's observation had settled
   the category question, a second probe would have meant editing a second
   live client config for no additional decision value. Labelled rather than
   quietly treated as equivalent to the OpenCode finding.
4. **A `.*`-required trap was found in Claude Code's matcher syntax**
   (`mcp__ansible` matches **nothing**; `mcp__ansible__.*` is required) and
   an **`experimental.codeMode`** caveat in OpenCode where per-tool hooks are
   not registered at all. Both are latent silent-no-op modes — this repo's
   most-repeated defect class — and both belong in any future ADR that
   revisits runtime enforcement.
5. **Two things are explicitly COULD-NOT-DETERMINE**: OpenCode's tool naming
   under `experimental.codeMode`, and how a thrown hook error is surfaced to
   the model. Recorded rather than inferred, since this brief's whole premise
   is that an unverified belief must not enter an ADR.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-14
- Updated: 2026-09-16

## Execution log
### Attempt 1
- Date: 2026-09-16
- Agent: opencode (claude-opus-5)
- Actions: Recorded `~/.claude/settings.json`'s pre-state by SHA-256. Fetched
  both vendors' current documentation. Read the **installed** opencode
  binary's bundled source (delegated) to establish MCP tool naming rather
  than infer it. Installed a temporary OpenCode probe plugin, ran a
  **read-only** MCP tool through a fresh session, observed the result,
  removed the probe and verified the removal two ways.

- Observations:

  **1. Claude Code: MCP tool calls ARE interceptable and blockable —
  DOCUMENTED (fetched 2026-09-16), not observed.** Source:
  `https://code.claude.com/docs/en/hooks`, read against installed
  `claude 2.1.246`. The docs carry a dedicated *"Match MCP tools"* section:

  > MCP server tools appear as regular tools in tool events (`PreToolUse`,
  > `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`,
  > `PermissionDenied`), so you can match them the same way you match any
  > other tool name.

  Naming is `mcp__<server>__<tool>`, and `PreToolUse` is listed as *"Before a
  tool call executes. **Can block it**"*, via
  `hookSpecificOutput.permissionDecision: "deny"`.

  **A trap worth recording, because it is a check that cannot fail:** the
  docs state the `.*` is **required** —
  > a matcher like `mcp__memory` or `mcp__brave-search` contains only
  > exact-match characters, so it is compared as an exact string and
  > **matches no tool**.

  So `mcp__ansible` silently matches nothing while looking correct;
  `mcp__ansible__.*` is required. **Labelled documented-only**: no Claude
  Code probe was run, because the OpenCode probe already answered the
  category question and a second client probe would have meant editing a
  second live config for no additional decision value.

  **2. OpenCode: interception works, and this is OBSERVED, not documented.**
  OpenCode's plugin docs (`https://opencode.ai/docs/plugins/`, fetched
  2026-09-16) document a `tool.execute.before` hook and show blocking by
  `throw`ing — but **only for the built-in `read` tool**, and say **nothing**
  about whether MCP tools are visible to it or how they are named. That gap
  is exactly what this spike existed for.

  Established from the **installed** bundle (`opencode 1.18.31`), then
  confirmed live:
  - MCP tool IDs are **server-prefixed with a single underscore**:
    `sanitize(server) + "_" + sanitize(tool)`, where `sanitize` is
    `/[^a-zA-Z0-9_-]/g → "_"`. **Not** Claude Code's `mcp__server__tool`.
  - `tool.execute.before` fires for MCP tools with that namespaced ID, and
    fires **before** the permission prompt.
  - `Plugin.trigger` does **not** catch hook errors (unlike the dispose
    hook, which explicitly swallows them), so a `throw` propagates and
    short-circuits before the upstream MCP call.

  **The live probe confirmed all three.** A temporary global plugin logged
  every `input.tool` and threw on one **read-only** tool
  (`zen_of_ansible` — never `ansible_navigator`). Observed output:

  ```
  ✗ ansible_zen_of_ansible Unknown failed
  Error: TASK-0028 PROBE: blocked zen_of_ansible via tool.execute.before
  ```
  and the probe log contained exactly `TOOL=ansible_zen_of_ansible`.

  So the observed tool name is **`ansible_zen_of_ansible`** — matching the
  source reading exactly — and the call was **blocked**, not merely logged.

  **3. The two clients' MCP tool names are incompatible, and that is the
  decisive finding for ADR-0016.** Same capability, two irreconcilable
  identifier schemes, both verified this session:

  | | Claude Code | OpenCode |
  |---|---|---|
  | Tool ID | `mcp__ansible__zen_of_ansible` | `ansible_zen_of_ansible` |
  | Mechanism | `PreToolUse` matcher in `settings.json` (JSON + shell) | `tool.execute.before` in a JS/TS plugin |
  | Block by | `permissionDecision: "deny"` | `throw new Error(...)` |
  | Config surface | `~/.claude/settings.json` | `~/.config/opencode/plugins/*.js` |

  A single portable guard artifact cannot express this. There is no shared
  identifier, no shared file format, and no shared blocking convention —
  only a shared *concept*. This is ADR-0006's per-capability scoping again,
  and it upgrades ADR-0016's "two implementations" concern from a
  packaging inconvenience to a **naming incompatibility**: even the string
  the guard must match differs.

  **4. `ansible_navigator` is still enabled, so the risk TASK-0026 exists to
  remove is live.** The probe deliberately used a read-only tool. Recorded
  because it confirms TASK-0026 has not yet run, per this brief's own Inputs
  caveat.

  **5. An `experimental.codeMode` caveat, labelled COULD-NOT-DETERMINE.**
  The bundle returns early before MCP tool registration when
  `experimentalCodeMode` is set, so per-tool `tool.execute.before` would
  **not** fire in that mode. The chunk it loads instead was not decompiled.
  Recorded rather than glossed: an OpenCode-side guard has a mode in which it
  silently does not run. Also not traced: how the thrown error is surfaced to
  the model (tool-result error vs aborted turn) — the block was observed, its
  presentation was not characterised.

- **RECOMMENDATION for ADR-0016: NO new component category. Interception is
  real in both clients — and that strengthens the "no" rather than weakening
  it.** The expected answer is reached, but on inverted reasoning, which is
  worth stating plainly:
  - The plan expected "no" because hooks might **not** work. They **do**.
    Had the spike stopped at "can it intercept?", the answer would have
    pointed *toward* a category.
  - What actually forbids it is finding 3: **the two clients do not even
    agree on the tool's name.** A `hooks/` component would ship two
    unrelated artifacts, in two languages, matching two different strings,
    with nothing shared but intent — failing `AGENTS.md`'s "portable across
    every client that supports its capability" at the identifier level.
  - The plumbing objections re-verified in `PLAN-0005` still hold (hardcoded
    `emit_section` calls, `validate.sh` iteration roots, the `install.sh`
    `CLIENTS` table), so a new top-level directory is **silently ignored** by
    all three and by CI.
  - **The human's 2026-09-14 decision — the working guard beats the portable
    abstraction — is therefore correct on the evidence**, and TASK-0031
    proceeds as TASK-0027 recommended: a static `ansible-lint` custom rule.
  - **What ADR-0016 must record so this is not re-raised:** interception
    **is** available and was **deliberately not taken up**. That is the
    tension ADR-0016's own Consequences section demands be recorded rather
    than hidden. A future task wanting runtime MCP enforcement has a
    verified path — per client, never portable — and should open its own ADR
    with the naming table above as its starting evidence.
  - **Naming, if a category is ever created:** not `hooks/`. OpenCode calls
    it a plugin, Claude Code calls it a hook, and the same word now names a
    marketplace in one client (per `ADR-0021`'s finding). Both terms are
    vendor-specific.

- Validation: `bash tests/validate.sh` → **`validate.sh: OK`**; no component
  touched, so `sync-registry.sh` is not applicable.
  **Probe reverted and the revert verified two ways**, per the plan's step 5
  and `release-check`'s rule that a command reporting success is not evidence
  of effect: (a) `~/.config/opencode/plugins/` is **absent again**, matching
  its pre-state — it did not exist before, so the directory I created was
  removed too; (b) the same read-only tool was re-invoked in a fresh session
  and **succeeded** (`"Ansible is not Python."`) with the probe log **not
  growing**. `~/.claude/settings.json` was **never modified**: SHA-256
  `27dafb27…4358f97` before and after.
  `SIGMA-infrastructure`: untouched, not involved in this task.
- Result: **Done.** Both clients' interception capability is established —
  Claude Code documented-only, OpenCode observed — and ADR-0016's answer is
  **no category**, on stronger evidence than the plan anticipated.
- Commit: `ce05bf7` — shared with `TASK-0027` (both evidence-only spikes, no
  component change). `ADR-0016`'s body, which this spike unblocked, landed
  separately in `8217221`.
- Push: **confirmed.** `d278c64..ce05bf7 master -> master`, verified by
  `git fetch` + `git log origin/master`.
