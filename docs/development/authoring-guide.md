# Component Authoring Guide

## Skills
SKILL.md is required, case-sensitive. No README.md inside skill folders.
`tests/validate.sh` enforces the **Gated** column below. Rows marked *no* are
conventions a reader must uphold; nothing checks them.

The column replaced the sentence *"enforces every frontmatter rule below, so
the guide and the gate cannot drift apart"*, which was false in both halves:
the `LICENSE`-file half of the `license` row is unchecked, and a promise that
two files "cannot drift" is exactly the construction TASK-0046 logged as a
false structural claim (its **B3**). Marking each row is what keeps the guide
checkable against the gate.

| Rule | Detail | Gated |
|------|--------|-------|
| Frontmatter delimiters | `---` on line 1, terminated by a closing `---`. | **yes** |
| `name` | Required, non-empty, and **must equal the directory name** — it determines the install path, so a mismatch deploys to somewhere no client looks. `_template*` directories are exempt from the equality rule only. | **yes** |
| `description` | Required, non-empty, **single line**. It renders into one registry table cell; a folded (`>`) or block (`|`) scalar breaks that row — including a bare sigil like `>-`, which reaches the registry as the sigil with the text dropped. | **yes** |
| `license` | Optional, but non-empty if present. | **yes** |
| `license` backed by a repo `LICENSE` file | A `license:` claim should be backed by a real `LICENSE`. | **no** — convention only; `validate.sh` never reads `LICENSE` |
| `metadata.author` | Optional. | not applicable |
| `metadata.version` | Optional; semver when present (`MAJOR.MINOR.PATCH`, optional pre-release/build). See Versioning below. | **yes**, when present |

- Keep SKILL.md lean; push detail into `references/`. This is a judgment
  call, **not** a machine-checked limit — no line or byte budget for
  SKILL.md is defined, and ADR-0008 records why one was deliberately not
  invented. To add one, define it here first (in bytes, with a rationale),
  then enforce it.
- Scripts must be idempotent and safe to re-run.

## MCP servers
Two shapes (ADR-0005). A server directory must contain **exactly one** of
`pyproject.toml` (authored) or `server.json` (external) — never both,
never neither. The shape is derived from which file is present, so it
cannot drift out of sync with the directory's actual contents;
`scripts/sync-registry.sh` reports it in the registry's Shape column.

- **Authored (Python)**: Python 3.10+, src layout, hatchling, FastMCP.
  One tool per concern; document every argument; tests required. Copy
  from `mcp-servers/_template/`.
- **External (npm, PyPI CLI, etc.)**: no source vendored. Described by a
  `server.json` manifest (schema below). Copy from
  `mcp-servers/_template-external/`. Per-client wiring goes in
  `configs/*/README.md`; the manifest, not the wiring snippet, is the
  machine-readable source of truth.

### `server.json` schema (external servers)
All keys below are required unless marked optional. `scripts/install.sh`
reads `launch` and `environment`; `tests/validate.sh` enforces required
keys and the `capabilities`/`authorization` rule.

| Key | Meaning |
|-----|---------|
| `name` | Server name; must match the directory name. |
| `description` | One line, for the registry. |
| `upstream.registry` | Where the package comes from: `npm`, `pypi`, … |
| `upstream.package` | Exact package name as published. |
| `upstream.version` | Version this repo has tested and wired. This repo does not own the number — record what upstream published. |
| `upstream.license` | Upstream's license identifier. |
| `upstream.homepage` | *Optional.* Upstream docs or repo URL. |
| `launch.command` | Argv array, exactly as a client should invoke it. |
| `launch.transport` | `stdio` or `sse`. |
| `runtime.declared` | Runtime the package *declares* it needs (e.g. `node>=24.0`). |
| `runtime.tested` | Runtime it was actually verified on here. Record both: npm `engines` is advisory by default, so a package can declare one version and run on another. Claiming only one number misleads either way. |
| `environment` | Object of `VAR: {required, description}`. Never put secret *values* here — only names and meanings. |
| `preconditions` | *Optional.* Array of things that must be true beyond env vars (a running desktop app, an installed extra). Prose, for a human. |
| `smoke_test.requires_paths` | *Optional.* Array of paths, resolved against the repo root, that must exist before `tests/smoke-mcp.sh` will attempt the handshake. If any is missing the server is reported **SKIP**, not FAIL. Use it when a server refuses to start until some state exists — such a server has not failed the handshake, it was never attempted. This is the machine-readable counterpart to the `preconditions` prose above; state a precondition in both if it is both. Mirror what the server itself checks: `mcp-servers/graphify/server.json` declares `.graphify/graph.json` rather than `.graphify/`, because the directory alone is not enough to let it start. |
| `capabilities.destructive` | Boolean. True if any tool can change state outside the agent's own context. |
| `capabilities.destructive_tools` | Array of `"tool: what it can do"` strings. Required (and non-empty) when `destructive` is true. The boolean is what validation gates on; this list is what a human needs to make an informed decision. |
| `authorization` | Required when `destructive` is true: `{granted, by, date, task}`. `task` is a repo-relative path to the task file carrying the authorization, and validation asserts that file exists — an authorization pointing at nothing is not an authorization. |

Adding an external server with `capabilities.destructive: true` and no
granted authorization fails `tests/validate.sh`. That is the mechanical
form of `AGENTS.md`'s rule that destructive capabilities need explicit
human authorization in the task file.

### When a server owes a per-client wiring section

**Not every server does.** `TASK-0073` settled this, closing `B-023`, which
had been blocked on the rule not existing: `ansible` has a section in all
three `configs/*/README.md` and graphify has none, so `configs/` and
`docs/registry.md` disagreed about how many servers a reader must wire —
with no way to tell an exemption from an omission.

A server owes a section in **every** `configs/<client>/README.md` if any of:

| Trigger | Why a section, rather than the manifest | Gated |
|---|---|---|
| A **required** environment variable | The variable's meaning, its blast radius and the consequence of setting it wrong are per-client prose the manifest cannot carry — `ansible`'s sections exist largely to carry `WORKSPACE_ROOT`'s | **yes** |
| `capabilities.destructive: true` | A human wiring this needs the disabled-tool instruction and the warning *at the point of wiring*, not only in a manifest key | **yes** |
| A launch a client **cannot perform from the manifest alone** — a wrapper, a client-set working directory, a per-client transport quirk | There is per-client knowledge with nowhere else to live | **no** — judgment |

Otherwise the server is **exempt**, and exempt means *deliberately absent*,
not pending. `scripts/install.sh` already prints the launch command,
transport, required variables and every `precondition` from the manifest, for
every client equally. A section that restated those would create a second
owner of facts the manifest owns — and it would drift.

**The first two triggers are checked.** `tests/validate.sh` requires a
non-template server declaring a required variable or `destructive: true` to
be named in every `configs/*/README.md`. The third is deliberately not
checked: "cannot perform from the manifest alone" is a judgment, and a check
that cannot really decide is a check that cannot fail — the lesson this repo
has paid for most often.

**graphify is the worked exemption, and it is not a clean case.** It declares
no required variable and no destructive tool, so neither gated trigger fires.
The third was genuinely arguable: its graph resolves from the **server's
working directory**, so a client launching it elsewhere serves a different
graph or fails to start. That was judged *not* to trigger a section, because
the manifest already carries it as a `precondition` and `install.sh` prints
it verbatim to every client — it is a fact about the server, not per-client
knowledge. **Re-run that judgment rather than inheriting it** if graphify's
launch surface changes.

Note also that graphify's **OpenCode-native** surface
(`graphify opencode install`) is a *separate* question from its MCP wiring,
per `ADR-0021`'s non-exclusive rows. Do not settle both in one section.

## Loops
A loop is a repeatable multi-step agent workflow. `loop.md` is required;
copy from `loops/_template/`. `tests/validate.sh` enforces the **Gated**
column below — and only that column.

The Gated column exists because this sentence previously read *"enforces
every element below"*, which was false: the gate checks that the three
headings are present, not that `## Steps` are numbered or that each failure
path carries a bound. That is the same defect class TASK-0046 found twelve
times inside `skills/ansible-ops/` — **a claim an artifact makes about its
own structure that the artifact falsifies** — occurring here, in the guide
that governs the gate. Marking each row is how the claim stays checkable
against `tests/validate.sh` instead of decaying again.

| Element | Rule | Gated |
|---------|------|-------|
| Frontmatter `name` | Required. Must match the directory name. | **yes** |
| Frontmatter `description` | Required. One line — drives the registry and loop selection. A folded or block scalar (`>-`, `\|`) is rejected: it reaches the registry as the bare sigil with the text dropped, and the row's column count stays valid, so the registry check cannot see it. | **yes** |
| `## Trigger` | Required. What starts the loop, and what it is *not* for. | presence only |
| `## Steps` | Required. Numbered, each stating its expected output, so a step can be judged done or not done. | presence only — **numbering and expected outputs are not checked** |
| `## Exit conditions` | Required. Both the success path *and* the failure paths, each failure carrying a retry bound or an escalation. | presence only — **the bound and the escalation are not checked** |

Exit conditions are the point. A loop without them is an unbounded
instruction — the shape that has an agent retrying the same failing action
indefinitely. State a bound ("3 attempts, then escalate") and name the
cases that must escalate *without* retrying, such as anything destructive
or a discovered secret.

Loops state sequence and exit conditions; they **link** to the rules they
enforce rather than restating them. A loop that copies `AGENTS.md`'s rules
creates a second owner of those rules, which will drift. See
`loops/release-check/loop.md` for the worked example.

## Claims a component makes about its own wiring

**The rule applies to every component category. The gate enforces it for
`skills/*/scripts/*` only** — the file type the defect occurred in, and the
only one where "is this run?" is a meaningful question, because only a
script can be run. Prose in `SKILL.md`, `loop.md`, `agent.md`,
`references/` and `templates/` is **not** checked, and neither is
`mcp-servers/`. Defined here first so the gate enforces a requirement
rather than authoring one (ADR-0008).

TASK-0046's pilot found **twelve false claims** in one new skill, each an
assertion about the artifact's own structure that the artifact falsified.
The worst was a script header stating it *"is run from
`tests/validate.sh`"* when **nothing in the repository ran it** — an
artifact claiming to be enforced while being inert. Five review rounds each
caught a different instance by reading, because nothing mechanical could.

Most of that class is **not** mechanically decidable. "Every gate maps to a
field", "so it cannot drift" and "never restated" are claims about meaning,
and a check that pattern-matches prose for meaning fires on correct text and
gets deleted. This guide does not pretend the gate closes them. One subset
is decidable:

> **The rule.** If a script claims that a **named runner in this
> repository** executes it, that runner must actually reference the script's
> path. The gated runners are `tests/validate.sh`, `.githooks/pre-commit`,
> and any `scripts/*.sh`.

Write a wiring claim in one of two forms, so the claim's polarity is
unambiguous to a reader *and* to the gate:

- **Positive** — "run from `tests/validate.sh`", "invoked by
  `.githooks/pre-commit`". The named runner must contain the path of the
  file making the claim. If it does not, the gate fails.
- **Negative** — prefix with `NOT`, `never`, or `Nothing`: "**NOT** run
  from `tests/validate.sh`", "**Nothing** in this repository runs this
  script". Negative claims are exempt, because they assert absence and the
  absence is what the gate would otherwise verify.

Two further exemptions exist so the check does not fire on correct text:
**discussion** of a claim ("Example of a bad claim: …", "would be false",
"do not write …") and a claim **inside quotes**, which is being shown rather
than made. Both were added after a comment explaining this very rule tripped
the check.

**The ceiling, stated plainly:** a false claim phrased to look like
discussion passes. Judging polarity from prose has that limit, which is why
the rest of the class — claims about totality, ownership and drift — is left
to review rather than pattern-matched. An unwired script is **not** a defect;
`skills/ansible-ops/scripts/` ships one deliberately, because the mandatory
gate must stay offline and hermetic (ADR-0007). Claiming to be wired when you
are not **is** the defect.

An unwired script is **not** a defect — `skills/ansible-ops/scripts/`
ships one deliberately, since the mandatory gate must stay offline and
hermetic (ADR-0007) and a record checker validates *another* repo's files.
Claiming to be wired when you are not **is** the defect.

## Agents
An agent is a **role**: an identity, a purpose, a capability boundary and a
system prompt. One directory per role, `agents/<role>/agent.md` is required;
copy from `agents/_template/`.

Agents are the only component category that is **emitted rather than
linked**. `scripts/install.sh` deploys skills with `ln -sfn`, so one file
serves every client. An agent file cannot work that way: the two clients'
formats differ in name, syntax and semantics, so a per-client file is
**generated** from `agent.md` (ADR-0018). There is no `link` mode and no
`copy` mode for agents, and **no freshness check on the emitted copy is
possible** — ADR-0009 forbids validating runtime presence, so the control
is that emission is cheap, idempotent, and re-run. Do not add a check that
inspects a deployed agent file; it would fail on every clean clone.

The agent capability spans **Claude Code and OpenCode only**. Bionic (LM
Studio's agent-oriented workspace) *is* agentic and does have subagents, but
no user-authored agent-role directory has been found in it, so there is no
surface to emit into (ADR-0020).

| Rule | Detail |
|------|--------|
| File | `agents/<role>/agent.md`, case-sensitive. One directory per role, because a role may later need `references/` beside it. |
| Frontmatter delimiters | `---` on line 1, terminated by a closing `---`. Claude Code reads a file whose opening `---` is not line 1 as having no frontmatter and silently treats it as documentation. |
| `name` | Required, non-empty, **must equal the directory name**. It determines the emitted filename and the Claude Code `name:` field, so a mismatch deploys a role the client cannot find. `_template*` is exempt from the equality rule only. |
| `description` | Required, non-empty, **single line**. It renders into one registry cell, and it is also what each client shows the delegating model — a folded (`>`) or block (`\|`) scalar breaks the row. |
| `mode` | Required. `primary` or `subagent`. Not inferred: OpenCode has an explicit `mode` field while Claude Code has none, so the emitter must be told rather than guess. An interactive role **must** be `primary` — Claude Code strips `AskUserQuestion` from every subagent regardless of its tool list, and OpenCode's default `subagent_depth: 1` stops a subagent spawning workers. |
| `capabilities` | Required, non-empty list drawn **only** from the vocabulary below. This is the role's safety boundary, stated in abstract terms because the emitter has to translate it into two different permission models — a boundary written in one client's syntax cannot be translated into the other's, and is silently discarded rather than rejected. |
| `delegates_to` | *Required **iff** `capabilities` includes `delegation-allowlist`; forbidden otherwise.* A non-empty **block list** of role names this role may invoke — one `- name` per line. The inline flow form (`[a, b]`) is **not read** and fails the gate. Held in its own key rather than inside `capabilities` because every vocabulary term is a plain string and the parsers read flat sequences; nesting a parameter would change the schema's shape for one term. Stated as `iff` because it is checkable in both directions, and both are checked. |
| `bash_allow` | *Required **iff** `capabilities` includes `bash-allowlist`; forbidden otherwise.* A non-empty **block list** of command patterns this role may run — one `- 'git *'` per line, quoted because a glob is not a bare YAML scalar. Everything not matched is **denied**, not prompted. Same block-list-only rule as `delegates_to`, for the same parser reason. |
| `test_allow` | *Required **iff** `capabilities` includes `test-allowlist`; forbidden otherwise.* A non-empty **block list** of test-command patterns, same quoting and block-list-only rule as `bash_allow`. Additionally gated: **no entry may be or begin with `*`**, and **no entry may contain `;`, `&&`, `\|\|`, `\|`, `$(`, a backtick or a newline** — see below for why this key is constrained where `bash_allow` is not. Merges into the same emitted `bash` map, so a role may hold both keys. |
| `clients` | Required. List of clients this role is emitted for: `claude-code`, `opencode`, or both. Declared rather than derived, because a role asking for a capability a client cannot enforce is a **scoping decision**, not something the emitter should silently resolve. |
| `model` | *Optional.* A **tier name**, never a client-native model ID. The two clients' model formats are mutually invalid — OpenCode wants `provider/model-id`, Claude Code wants an alias, a full ID or `inherit` — and OpenCode accepts a foreign value at parse time and **fails only at run time**. **Omit it: no tier resolver exists in this repo** — see the note below. |
| Body | Required, non-empty. Everything after the frontmatter is the system prompt, emitted verbatim to both clients. It is the one part of a role that is genuinely portable. |

#### Known gap: `model` has no resolver in this repo

`scripts/emit-agents.py` emits `model: "{tier:<name>}"` verbatim and **does
not resolve it**. That is deliberate (ADR-0018 clause 7: model references
belong in one place), but the file that owns the tier→model mapping —
`agent-tiers`' `models.jsonc` — **stays in `opencode-customization`**
(ADR-0017, rejected 2026-09-15). So a role declaring `model` emits an
unresolved placeholder that no client understands.

**Therefore: omit `model` until this is resolved.** Every role authored so
far does. A role needing a specific model is the trigger to decide, not a
reason to improvise.

**Do not close this gap by adding a second tier→model mapping here.** Two
owners of one fact is the defect clause 7 exists to prevent, and it is worse
than the gap. The real options, when a role forces the question, are: drop
`model` from this schema; own the mapping here and supersede clause 7 by a
new ADR; or emit a client-native model ID per client and accept the
duplication. ADR-0017's "one gap this creates" section carries the full
reasoning.

### Capability vocabulary
A role declares **intent**; the emitter translates it into each client's
mechanism. The vocabulary is fixed, and it is short: it is bounded by the
weaker of two clients, not by either client's native expressiveness.

| Term | Meaning | OpenCode | Claude Code |
|------|---------|----------|-------------|
| `read-only` | May read and search; may not create or modify files. | `edit: deny`, `write: deny` | omit `Write`, `Edit` from `tools` |
| `no-delegation` | May not invoke **any** other agent. | `task: deny` | omit `Agent` from `tools` |
| `delegation-allowlist` | May invoke **only** the roles named in `delegates_to`. Requires `mode: primary` — see below. | `task: {"*": "deny", "<name>": "allow", …}` | `tools: Agent(<name>, …)` |
| `no-webfetch` | May not fetch network resources. | `webfetch: deny` | omit `WebFetch`, `WebSearch` from `tools` |
| `worktree-only` | Confined to the project worktree. | `external_directory: deny` | **partial** — `isolation: worktree` gives an isolated *copy*, which is a different guarantee. See below. |
| `test-files-only` | May edit test paths only. | `edit` glob map | **not per-agent** |
| `bash-allowlist` | May run **only** the commands named in `bash_allow`; everything else is denied. | `bash: {"*": "deny", "<pattern>": "allow", …}` | **not per-agent** |
| `test-allowlist` | May run **only** the test commands named in `test_allow`; everything else is denied. Merges into the same `bash` map as `bash-allowlist`, so a role may carry both. | `bash: {"*": "deny", "<pattern>": "allow", …}` | **not per-agent** |
| `no-force-push` | May not force-push, hard-reset or rewrite history. | `bash` deny globs | **not per-agent** |
| `push-requires-confirmation` | Push prompts rather than proceeding. | `bash: {"git push*": ask}` | **no `ask` state exists** |
| `webfetch-requires-confirmation` | Network fetches prompt rather than proceeding. | `webfetch: ask` | **no `ask` state exists** |

**Four of the eleven are enforceable in both clients** — the first three plus
`delegation-allowlist`. The other seven are enforceable in OpenCode only, and
the reason is structural: Claude Code's `tools`/`disallowedTools` gate
**whole tools**, so anything needing *intra-tool* granularity — which paths,
which commands, or a third `ask` state between allow and deny — has no
per-agent expression. A `disallowedTools` entry with a specifier such as
`Bash(git push *)` removes the entire `Bash` tool, not the matching
commands.

`test-allowlist` is in the OpenCode-only seven for exactly that reason, and
it is why `qa-test` is an OpenCode-only role. Naming test commands is
intra-`Bash` granularity; Claude Code can give a role `Bash` or withhold it,
and nothing between. A Claude Code `qa-test` would ship with unrestricted
`Bash` — a **weaker** boundary than the one its description implies — so the
emitter refuses rather than emitting it (clause 8).

#### `delegation-allowlist` requires `mode: primary`, and that is a client constraint

Claude Code's `Agent(<name>, …)` allowlist is honoured **only for an agent
running as the main thread** (`claude --agent`). The docs are explicit that
in a *subagent* definition, *"any type list inside the parentheses is
ignored"* — the subagent gets unrestricted spawning instead, bounded only by
the depth limit.

So a subagent declaring `delegation-allowlist` would be enforced in OpenCode
and **silently widened** in Claude Code: exactly the invisible-degradation
failure ADR-0018 clause 8 exists to prevent. The pairing is therefore a
**schema rule**, not a style preference: `delegation-allowlist` is valid only
with `mode: primary`, and `tests/validate.sh` rejects the combination.

A subagent that must not delegate uses `no-delegation`, which *is*
expressible in both (omit `Agent` from `tools`). At OpenCode's default
`subagent_depth: 1` a subagent cannot spawn workers anyway, so
`no-delegation` on a subagent is belt-and-braces rather than redundant —
the depth limit is global config a user can raise, while the role's own
boundary travels with the role.

**Emitted glob order matters.** OpenCode's `permission` rules are
last-match-wins, so the emitter writes `"*": "deny"` first and the allowed
names after. Reordering an emitted file inverts its meaning.

#### The three parameterised terms deny by default

`delegation-allowlist`, `bash-allowlist` and `test-allowlist` are the only
terms taking an argument, and all three are **deny-first allowlists**: what is
not named is **denied**, never prompted.

That distinction is the whole point of the term. An earlier draft of the
emitter produced `bash: {"*": "ask"}` for `bash-allowlist` — which permits
*any* command subject to a prompt, where the roles it models **deny**
everything but a named set. For a role whose entire purpose is "git
operations only", `ask` means a human could approve `rm -rf` at a prompt the
role was designed to never reach. **A boundary that degrades to a prompt is
not the boundary that was declared**, and it fails silently, because the
emitted file still looks restrictive.

So a term that names a set must carry the set. If you add a fourth
parameterised term, give it its own key and make the default **deny**.

#### `test-allowlist` is constrained where `bash-allowlist` is not

The third parameterised term was added by `TASK-0071` to close `B-021`, whose
warning shaped it: *"do not resolve it by adding `bash: allow` — that hands a
test runner arbitrary shell and dissolves the boundary the role exists to
have."* A `test_allow` list that accepted anything `bash_allow` accepts would
be that resolution under a second name, so two constraints apply to its
entries and **both are gated**:

1. **No entry may be, or begin with, `*`.** An allowlist that opens universal
   is not an allowlist.
2. **No entry may contain a shell chaining metacharacter** — `;`, `&&`, `||`,
   `|`, `$(`, a backtick, or a newline. Otherwise `pytest; rm -rf /` is one
   "test command" and the boundary is decorative.

**The ceiling, stated plainly.** This term bounds the **command surface** a
role may invoke. It does not bound what the tests themselves execute, and no
per-agent permission model can: running a test *is* running arbitrary code. A
role holding `test-allowlist` cannot invoke `curl`; it can run a test that
does. Do not read the term as a sandbox — it narrows what the agent may type,
not what the repository's own test suite may do.

Neither constraint is applied to `bash_allow`, which has the same hazard.
That is deliberate scope, not an oversight: widening them would change the
boundary of `git-ops` and `shell-runner`, which `TASK-0071` was not scoped
against. Raised as a backlog item instead.

A term that only one client can enforce is **still a legal term**. It is
not excluded, because excluding it would mean a role could not state a
boundary it genuinely has. Instead:

- The role lists the term in `capabilities` **and** narrows `clients`
  accordingly.
- **The emitter refuses rather than degrades** (ADR-0018 clause 8): asked
  to emit a role for a client that cannot enforce a declared term, it
  **fails loudly**. It never drops the term, weakens it, or turns it into a
  comment.

That rule exists because the failure is otherwise invisible. A role
declaring `read-only` through OpenCode's native `permission:` syntax
**loads in Claude Code with `Write`, `Edit` and `Bash` still in its tool
pool** — the block is parsed as an unknown key and discarded without a
warning. Verified by fixture in TASK-0036. A file that says `deny` over an
agent that can write is worse than a file that refused to emit.

Consequently **`git-ops`, `review` and `qa-test` are OpenCode-only roles**:
each exists to enforce a command allowlist — `bash-allowlist` for the first
two, both `bash-allowlist` and `test-allowlist` for `qa-test` — and neither
term has a per-agent Claude Code expression.

> This sentence named **`shell-runner`** until `TASK-0071`, and
> `agents/shell-runner/` **has never existed**. It is a planned role
> (`CURRENT_STATE.md` records it as not authored, because no
> `loops/project-build/` step needs it yet), but this guide stated it in the
> present tense as a fact about the roles that ship — the false-present-tense
> class `REVIEW-0008` swept across four files. The task that found it was
> editing this very line for another reason and checked the name rather than
> reusing it. **`ADR-0017` and `ADR-0018` still name `shell-runner` and are
> deliberately left alone**: a decision record describes what was decided
> when it was decided, and `ADR-0021`'s falsified predictions are preserved
> on the same principle. Only the normative guide is corrected.

#### `worktree-only` is the one term with a semantic gap
The two mechanisms are not the same guarantee, so it is marked *partial*
rather than *maps both*. OpenCode's `external_directory: deny` **refuses
tool calls touching paths outside the working directory**. Claude Code's
`isolation: worktree` **gives the subagent an isolated copy of the
repository** and checks that its commands stay inside it — confinement by
redirection rather than refusal, and its check covers the whole repository
containing the launch directory. Both narrow blast radius; neither is a
drop-in translation of the other. TASK-0040 must decide explicitly whether
`worktree-only` emits `isolation: worktree` for Claude Code or refuses the
client, and record which — it is the term every existing role declares, so
resolving it silently would affect all of them.

### A role file must not contain client-native syntax
A role file must **not** contain a `permission:` block, the string
`disallowedTools`, or a `tools:` key. Any of them means the file has picked
a client, which defeats the one-source mechanism the category is built on.

`tools:` is the sharpest case and is worth its own warning: OpenCode types
it as an object while Claude Code types it as a comma-separated string, so
the same key is valid in both and means different things. A Claude
Code-shaped `tools: Read, Grep, Glob` in a file OpenCode reads produces
`Configuration is invalid`, and observed behaviour is that **one malformed
file empties the entire agent list** rather than failing alone. It is also
deprecated upstream in favour of `permission`.

A role file must also **not** carry a `name:` field in the Claude Code
sense of an identity that may differ from its filename. This repo's `name`
means "equals the directory". In OpenCode a `name:` field silently
**overrides** the filename; in Claude Code it is required. Reconciling the
two is the emitter's job.

### No size budget
No line or byte budget for `agent.md` is defined, and none should be
invented — the same treatment SKILL.md gets above, for the same reason
(ADR-0008). Keep the system prompt as long as the role genuinely needs.
To add a budget, define it here first, in bytes, with a rationale, then
enforce it.

One **vendor threshold** is worth knowing and is deliberately *not* a
gated rule: Claude Code warns at startup when the combined `description`
fields of its custom subagents exceed **15,000 tokens**, and advises moving
detail into the system prompt, which loads only when that subagent runs.
That is Anthropic's limit on their own client, measured across whatever
that machine has installed — including roles this repo did not emit. This
repo cannot compute it, so gating on it would be enforcing a number it
cannot measure. Prefer short descriptions because the delegating model
reads them, not because a check demands it.

## Placing a third-party extension

Someone else's product — a plugin, a ruleset, a CLI, a gateway — that a user
might want alongside this repo's components. **Route it by what it *is*, not
by what its vendor calls it.** The word "plugin" named three unrelated
mechanisms across the three products that produced this rule.

| If the extension… | Then it lives in… | Gated |
|---|---|---|
| has a published upstream package **and** an MCP transport this repo can launch | `mcp-servers/<name>/server.json` (external shape, above) | **no** |
| integrates through client-native mechanisms only — plugin entries, marketplaces, hooks, rules files | `configs/<client>/README.md`, one section per client | **no** |
| is a service or tool that changes the *environment* rather than the agent's behaviour | `docs/development/third-party-tools.md` — documented as optional, never installed | **no** |

**Nothing enforces any of this.** `tests/validate.sh` has no check for
placement and is not getting one: routing is a judgment call, and a check
that cannot really decide it would be a check that cannot fail — this
repo's most-repeated lesson. The gate does enforce the *shape* of whatever
you land on (a manifest's required keys, a `configs/<client>/README.md`
existing), but never that you chose the right row. Treat the column above
as honest rather than discouraging: two of the three rows produce
documentation, and documentation is the deliverable.

**Two standing constraints come with the rule**, and unlike the routing
they are absolute: **nothing is vendored** into this repo, and **nothing is
auto-installed** — `scripts/install.sh` never writes into a client's plugin
registry or config file. The user runs upstream's installer.

**The rows are not mutually exclusive.** A product can occupy two at once,
and the first one to do so did: **graphify** is an `mcp-servers/` component
(`mcp-servers/graphify/server.json`) *and* has a client-native OpenCode
surface — its `graphify opencode install` writes an `AGENTS.md` section, a
`tool.execute.before` plugin, a project config entry and an Agent Skill.
Placing it in the first row does not mean the second is wrong about it.
**ponytail** is the second-row worked example: no publishable MCP package
exists upstream, so it is documented in all three
`configs/*/README.md` and nowhere else.

**Why the rule lives here rather than only in the decision:** an author
needs it at the moment they are adding something, which is when they are
reading this guide. The reasoning, the evidence and the three products'
integration surfaces are in
[`ADR-0021`](../../.ai/decisions/0021-third-party-extensions-are-wired-not-vendored.md)
— read it before arguing with the table, and do not restate it here.

> **`ADR-0021` was ratified 2026-09-23** and is `Accepted`. The rule above is
> settled. Note that ratification covers the decision's clauses, not its
> context: two of the ADR's own predictions about these products were
> falsified by the spike that tested them, and are preserved in the file as
> written.

## Versioning
- Semver per component. Skills: `metadata.version` in SKILL.md
  frontmatter (see ADR-0003). Authored MCP servers: `pyproject.toml`.
  External MCP servers: the upstream package's own version, recorded in
  the `configs/*/README.md` snippet — this repo doesn't own that number.
- Interface-breaking changes get an ADR in .ai/decisions/.
