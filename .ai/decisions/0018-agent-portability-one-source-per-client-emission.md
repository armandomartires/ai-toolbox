# ADR-0018 — Agent portability is scoped per capability; one source, per-client emission

## Status
**Accepted — 2026-09-15.** Opened by `PLAN-0004` (sprint S7). Extends
ADR-0006 to a third capability class.

**Ratified on evidence, not on agreement.** `TASK-0036` re-fetched both
vendors' documentation and tested fixtures against the installed clients
(`opencode 1.18.31`, `claude 2.1.246`). The mechanism this ADR proposed —
one client-agnostic source per role, emitted per client — **is confirmed**.
Its *reasoning* is replaced, four of its stated facts are corrected, and it
gains one new clause.

### Corrections made at ratification

Recorded in place rather than silently, following ADR-0019's precedent: a
decision whose own factual basis has been corrected must show the
correction, or a later reader cannot tell which claims were tested.

1. **The reason to reject a superset file was wrong.** The proposed text
   said the blocker was *semantic* — that `permission` and `tools` are
   different models, not different spellings. That is true but it is not
   the blocker. The blocker is a **safety** failure, observed: a superset
   file **loads in both clients** and silently discards the safety contract
   in one. See Context.
2. **OpenCode identity is not simply the filename.** The docs say only
   *"The markdown file name becomes the agent name"* and never mention a
   `name:` field. Observed: a `name:` field **overrides the filename**.
3. **The overlap is one field, not three.** `description` alone is
   portable. `model` and `color` overlap *in name* while their **values are
   mutually invalid**.
4. **Unknown keys are not inert in OpenCode.** The vendor documents them as
   *"passed through directly to the provider as model options"* — so a
   foreign key in an OpenCode agent file is an untyped pass-through to a
   third party, not a no-op.

**Every claim below carries its source.** Cross-client facts are dated
2026-09-15 and attributed to `TASK-0036`'s log, which holds the fixtures,
the per-row markers and the negative controls. **Three of the twelve
mapping rows changed in four days**, so a future reader acting on this ADR
should re-verify rather than cite it — the same instruction this ADR gave
`TASK-0036`, now pointed forward.

## Context

### What was tested, and how

`TASK-0036` did not confirm this ADR's table; it rebuilt the mapping from
freshly fetched pages and then tested the parts that documentation cannot
settle. The instrument for OpenCode was `opencode agent list` in a scratch
project; for Claude Code, `claude -p` enumeration plus a delegated subagent
reporting its own tool pool. `claude plugin validate` was **proved able to
fail** on a malformed fixture before any passing result from it was trusted.

### Agent definitions are not portable — confirmed, with the overlap narrower than claimed

| Concern | OpenCode | Claude Code |
|---|---|---|
| Location | `~/.config/opencode/agents/`, `.opencode/agents/` — **and `agent/` singular also loads**, undocumented | `~/.claude/agents/`, `.claude/agents/`, plus managed settings, `--agents` JSON, and plugin dirs; scanned recursively |
| Identity | the **filename** — **unless a `name:` field is present, which overrides it** | a **required `name` field**; filename need not match |
| Capability gating | `permission`: **15** keys, each `allow`/`ask`/`deny`; **10** also accept a glob→action object | `tools` allowlist / `disallowedTools` denylist / `permissionMode` |
| Primary vs subagent | explicit `mode: primary\|subagent\|all`, default `all` | inferred; **no equivalent field**. Primary only via `--agent` or the `agent` setting |
| Model reference | `provider/model-id` | an alias (`opus`), a full ID, or `inherit` |
| Restricting delegation | `permission.task` glob, last match wins | `tools: Agent(worker, researcher)` — **ignored inside a subagent definition**; honoured only for a `--agent` main thread |
| Subagent nesting | `subagent_depth`, **default 1** (documented on the *config* page, not the agents page) | 3 layers by default; `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` |
| Iteration cap | `steps` (`maxSteps` now explicitly deprecated) | `maxTurns` |

**The overlap is `description`. That is all.** `model` values are mutually
invalid — OpenCode accepts a bare `haiku` at parse time and **fails at run
time**. `color` is an 8-name enum in Claude Code and hex-or-7-theme-names in
OpenCode. So the previous claim of a three-field overlap overstated
portability by two fields, and both were fields a reader might have assumed
safe to pass through.

### The superset file: rejected on safety, not on syntax

This ADR was obliged to test the option it had pre-rejected. The result
inverts the expected reasoning.

**Both clients load a file carrying keys they do not recognise.** Neither is
fatal. On the proposed reasoning, that would have made a superset file
viable and this whole mechanism unnecessary.

**It does the opposite, because the discard is silent and lands exactly on
the safety contract.** Observed:

- A fixture declared read-only using **only** OpenCode's syntax
  (`permission: {edit: deny, write: deny, bash: deny}`), with no `tools`
  and no `disallowedTools`.
- Claude Code **loaded it**, and the subagent reported its own tool pool as
  including **`Write`, `Edit` and `Bash`**.
- A control fixture identical in intent but written in Claude Code's native
  `tools: Read, Grep, Glob` reported **`WRITE=no EDIT=no BASH=no`**.

The `permission:` block was parsed as an unknown key and dropped without a
warning. **That is this ADR's own predicted emitter failure — "a `review`
agent that can edit" — except a superset file produces it on every role,
with no emitter bug required.**

*Stated limit on the evidence:* pressed to write a file, the subagent
**refused** on the grounds of its own system prompt and made no tool calls,
so no write completed. **The breach is the tool pool, not a completed
write**; only model compliance stood between the two. The entire purpose of
a permission boundary is to hold when compliance does not.

Two further reasons a superset file fails, both from the same testing:

- **A key both clients define with incompatible types is fatal, and not
  only for its own file.** `tools` is the live case: OpenCode types it as an
  object, Claude Code as a comma-separated string. The malformed fixture
  produced `Configuration is invalid` and **`opencode agent list` returned
  nothing at all** — one bad file took down the whole agent list. A superset
  file hits this by construction, because the overlap is precisely where
  both clients hold an opinion.
- **OpenCode forwards unrecognised keys to the provider** as model options,
  by its own documentation. A Claude-Code-only key in an OpenCode file is
  therefore a silent API parameter. A `maxOutputTokens: 1` fixture did not
  visibly take effect on the provider path tested, so the effect was **not
  reproduced** — but a documented pass-through to a third party is not a
  property on which to base a deployment mechanism.

### The capability vocabulary is much smaller than expected, and asymmetric

This ADR predicted the abstract vocabulary would be *"smaller than either
client's native expressiveness."* It is smaller than that wording suggests,
and the shortfall is one-sided. Measured against the four roles
`agent-tiers` already ships:

| Abstract term | OpenCode | Claude Code | Portable? |
|---|---|---|---|
| `read-only` | `edit: deny`, `write: deny` | omit Write/Edit from `tools` | **both** |
| `no-delegation` | `task: deny` | omit `Agent` from `tools` | **both** |
| `no-webfetch` | `webfetch: deny` | omit WebFetch / `disallowedTools` | **both** |
| `worktree-only` | `external_directory: deny` | no per-agent equivalent | OpenCode only |
| `test-files-only` | `edit` glob map (7 globs) | **unexpressible per-agent** | OpenCode only |
| `bash-allowlist` | `bash` glob map (13 globs in `shell-runner`) | **unexpressible per-agent** | OpenCode only |
| `no-force-push` | `bash` deny globs | **unexpressible per-agent** | OpenCode only |
| `push-requires-confirmation` | `bash: {"git push*": ask}` | **no `ask` state exists** | OpenCode only |

**Five of eight terms map to OpenCode only, and they are the five that carry
the safety value.** The three that port are all whole-tool on/off. Every
term needing *intra-tool* granularity — which paths, which commands, or a
third `ask` state — has no per-agent Claude Code expression. Claude Code's
remedies are a session-wide `permissions.deny` rule or a `PreToolUse` hook,
both of which live **outside a single agent file** and therefore outside the
one-source model.

### Directional expressiveness: the loss is silent and one-way

- **Claude Code `tools` → OpenCode `permission`: faithful.** An allowlist is
  `{"*": "deny"}` plus per-tool `allow`. OpenCode's model is a strict
  superset of everything `tools` can express.
- **OpenCode `permission` → Claude Code `tools`: lossy, and silently so.**
  A whole-tool `deny` maps to omission. Glob→action and the `ask` state have
  no per-agent target, and dropping them produces a file that loads, runs,
  looks correct, and enforces less than it says.

**So the abstract profile must be defined at Claude Code's ceiling for
anything it promises to enforce in both clients.** A profile that silently
degrades is worse than one that refuses a term, because degradation
reproduces the observed fixture: a file claiming `deny` over an agent that
can write.

### The precedent this extends

ADR-0006 faced a criterion assuming cross-client uniformity, found it
unsatisfiable once tested, and resolved it by scoping portability **per
capability**. Agents are a third capability class; LM Studio supports
neither skills nor agents, so the class spans the same two clients as
skills.

`TASK-0036` extends that logic one level down. Portability is scoped per
capability — and **within the agent capability, per role**, because a role
whose safety profile cannot be expressed in a client is not portable to
that client no matter how well the file format is handled.

### The shape this borrows

ADR-0005's Clarification established that an MCP server's shape is
**derived** from which marker file is present, never self-declared, because
*"a self-declared `shape` field could contradict the directory's actual
contents; a derived one cannot."* The same logic makes a per-client agent
file **generated** rather than hand-maintained, so it cannot contradict the
role it implements.

### Established about this repo's deployment mechanism

- `install.sh:105` deploys skills with `ln -sfn` — one directory, linked into
  each client, so a repo edit is live everywhere with **no sync step**.
- `install.sh:36-39` is a `CLIENTS` heredoc with **three** columns
  (`name|skills target|parent`), and `validate.sh` parses that block with
  `sed` to require `configs/<client>/README.md` per client. Adding an agents
  target touches the block the gate reads.
- `~/.claude/agents/`, `~/.config/opencode/agents/` and
  `~/.config/opencode/agent/` **all remain absent** on this machine,
  re-verified after `TASK-0036`'s fixtures were confined to a scratch
  project. There is no installed base to preserve and no drift to inherit.

### What is no longer "not established"

All four open questions are answered; see `TASK-0036`'s log for the
fixtures and per-row markers. One correction to how that list was framed:
it asked whether unknown keys were *"ignored, or fatal,"* treating "ignored"
as the outcome favouring a superset file. **Both clients ignore them, and
that is the dangerous outcome** — a fatal key fails loudly at load, while a
discarded `permission:` block ships an agent with permissions nobody
granted.

## Decision

**Accepted 2026-09-15. Eight clauses, all normative.** Clauses 1 and 3–7
are unchanged from the proposal. Clause 2's *reasoning* is replaced.
Clause 8 is new and is the substantive addition from `TASK-0036`.

1. **The source of truth** is `agents/<role>/agent.md` — one directory per
   role, carrying a client-agnostic role contract: identity, purpose,
   primary-or-subagent, an abstract capability profile, and the system
   prompt. Never a client's native format.

2. **The capability profile is abstract and mapped, not passed through.**
   A role declares intent (`read-only`, `test-files-only`, `no-force-push`)
   and the emitter translates it into each client's mechanism. A role file
   must not contain the string `disallowedTools` or a raw `permission:`
   block, or it has picked a client.

   **The reason is safety, not tidiness.** A raw `permission:` block in a
   file that reaches Claude Code is **silently discarded**, leaving an agent
   with the tools its own file denies. The observed fixture is the citation;
   any future argument that "both clients tolerate extra keys, so let the
   role file carry both" is answered by it.

   Three concrete prohibitions follow, each from an observation rather than
   a preference:
   - **Never emit a `tools:` key for OpenCode.** It is the one fatal
     type collision, it is deprecated upstream, and one malformed file
     **empties the entire agent list** rather than failing alone.
     `TASK-0038` should check that no `agents/<role>/agent.md` contains it.
   - **A role file must not carry a `name:` field.** It is required in
     Claude Code and silently overrides the filename in OpenCode. It
     belongs to emission, never to the source.
   - **`model` is emitted per client.** The two value formats are mutually
     invalid and an OpenCode model error surfaces **only at run time**, so
     `validate.sh` cannot catch it. Recorded as a known blind spot,
     consistent with ADR-0009, rather than answered with a runtime check.

3. **Emission forbids `link` mode, and that asymmetry with `skills/` is
   correct.** An emitted file's content differs per client by definition, so
   it cannot be a symlink to one source. Agents deploy by generation only:
   no `link`, no `copy`.

4. **No freshness check is possible, and none must be added.** Emission
   creates a fourth copy whose currency nothing verifies. ADR-0009 forbids
   validating runtime presence — *"a gate that cannot pass on a clean
   checkout stops being run, and a gate that is not run is worse than no
   gate, because it is still trusted."* The control is that emission is
   cheap and idempotent and `install.sh` is re-run. **Anyone who later
   "fixes" this by checking the deployed copy breaks every fresh clone and
   CI.** This clause exists to be cited when they try.

5. **What is validated instead**: that each `agents/<role>/agent.md` parses,
   carries its required keys, names a valid mode, and declares a capability
   profile the emitter recognises. Documentation and source completeness —
   never deployment state.

6. **The agent capability spans Claude Code and OpenCode only.** LM Studio
   is excluded by ADR-0006's logic and stays absent from the emission target
   list, as it is absent from the skills list.

   > **Re-grounded by ADR-0020, 2026-09-15.** The *conclusion* stands; the
   > *reason* given here does not. ADR-0006's logic is falsified — the client
   > is Bionic, it has an Agent Skills target, and it performs agentic work
   > (its bundle carries `lmstudio/exploration-subagent-v1` and two
   > `coder-*-subagents` entries). The exclusion now rests on a narrower
   > observation: **no user-authored agent-role directory has been found** in
   > Bionic, of the kind `~/.claude/agents/` and
   > `~/.config/opencode/agents/` are. Its subagents appear built-in and
   > internally named, so there is no surface to emit into — a findable gap,
   > not an absent capability.

7. **Model references belong in one place.** `agent-tiers`' `models.jsonc`
   already solved this for OpenCode with `{tier:<name>}` placeholders
   substituted at install time. Whether the emitter reuses that file or
   supersedes it must be decided in `TASK-0040`, not improvised — two
   mechanisms coexisting is how a second owner of one fact appears.

8. **The emitter refuses; it never degrades.** *(New — from `TASK-0036`.)*

   1. Each term in the capability vocabulary declares **which clients can
      enforce it**. A term is not admitted to the vocabulary merely because
      it can be *written*.
   2. When a role declares a term a target client cannot enforce, emission
      for that target **fails loudly**. It must not emit a file with the
      term dropped, weakened, or converted to a comment. Silent degradation
      reproduces the observed breach through the emitter instead of through
      a hand-written file.
   3. **A role whose profile cannot be enforced on a client is
      OpenCode-only, and is recorded as such.** This is ADR-0006's
      per-capability scoping applied per role. By the vocabulary above,
      **`git-ops` and `shell-runner` are OpenCode-only roles** — both exist
      to enforce a command allowlist, which has no per-agent Claude Code
      expression. Their disposition is settled here rather than left to
      `TASK-0045`, because a task that meets this for the first time will
      reach for a workaround.
   4. **The two workarounds are rejected for now, with reasons.** A
      session-wide `permissions.deny` rule leaks one role's boundary into
      every agent in the session; a `PreToolUse` hook puts enforcement in a
      second artifact that `agents/<role>/agent.md` does not own. Either may
      be revisited by a later ADR **with a worked example**, but neither is
      to be introduced inside an implementation task.
   5. The registry must show a role's client coverage, so an OpenCode-only
      role is visible as such rather than appearing universal.

## Consequences

- **A role is authored once**, and its safety profile cannot silently
  diverge between clients, because neither client's file is hand-edited.
- **Two of the four existing roles do not port, and that is now a known
  scope fact rather than a late discovery.** `git-ops` and `shell-runner`
  are OpenCode-only. `TASK-0045` inherits a stated disposition; without
  clause 8 it would have inherited an unsolved problem at the point of
  implementation.
- **The vocabulary is small and lopsided.** Three portable terms against
  five OpenCode-only ones. Anything needing intra-tool granularity is
  OpenCode-only until a later ADR admits an out-of-file mechanism. Expect
  this to be felt as a limitation and resisted; clause 8.4 is the answer.
- **A generated artifact enters the deployment path for the first time.**
  Everything this repo deploys today is either a symlink to a tracked file
  or a printed instruction. An emitted file is neither, and is the first
  thing `install.sh` produces with no tracked counterpart. Its absence from
  the gate's reach is a real, accepted weakness.
- **The emitter is load-bearing and the gate cannot test it.** A wrong
  mapping produces a *plausible* agent file with wrong permissions.
  `validate.sh` cannot catch that; only fixture-based testing can, and
  lesson 8 applies — knowing this has not prevented an unfailable check
  twice. The observed read-only fixture is the shape to test against.
- **`CLIENTS` grows a column and the gate's parsing must follow.** The
  client↔config pairing check reads that block; extending it without
  updating the check is how a client gets added with no wiring snapshot.
- **This ADR does not make agents portable to future clients.** It makes
  them portable to two, by construction, with a mechanism that can be
  extended. A third client supporting agents is a new emitter target, not a
  crisis — but by clause 8 it is also a re-assessment of which roles reach
  it.
- **The mapping will decay again.** Three rows changed in four days, and the
  installed Claude Code is **older than six of the patch versions its own
  documentation cites**. A doc-confirmed field is not an installed field.
  `TASK-0040` must be written against the installed client and re-verify at
  the point of use.

## What ratification unblocks, and what it does not

**Unblocked.** `TASK-0037` (`agents/_template/` plus the normative schema in
`authoring-guide.md`) opens with a gate requiring this ADR to be `Accepted`;
that gate is now satisfied. `TASK-0037` is **the critical path** — 0038,
0039 and 0040 are mutually independent once it lands, and `TASK-0043` sits
behind 0040.

`TASK-0037` now has an enumerated vocabulary with per-term client coverage
rather than an invented one, and clause 8.1 tells it that coverage is part
of each term's definition.

**Still blocked.** `TASK-0043` (design roles) needs `TASK-0040` → `TASK-0037`.
`TASK-0045` needs `TASK-0044`; it inherits clause 8.3's disposition for
`git-ops` and `shell-runner`.

**Unaffected.** `TASK-0034` and ADR-0017 (`agent-tiers` ownership) are an
independent front. `TASK-0035`'s import does not depend on this decision.

**Not settled here, and named so it is not assumed handled:** whether the
emitter reuses or supersedes `models.jsonc` (clause 7 assigns it to
`TASK-0040`), and what the emitted Claude Code file does about
`worktree-only`, which every existing role declares and which has no
per-agent target. Clause 8.2 makes that a **loud failure** rather than a
silent omission, which means `TASK-0040` will meet it immediately — by
design, since the alternative is four roles quietly emitted without
worktree confinement.
