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
  from `mcp-servers/_template/`. Verified against the template below.
- **External (npm, PyPI CLI, etc.)**: no source vendored. Described by a
  `server.json` manifest (schema below). Copy from
  `mcp-servers/_template-external/`. Per-client wiring goes in
  `configs/*/README.md`; the manifest, not the wiring snippet, is the
  machine-readable source of truth.

### Authored (Python) servers, read from `mcp-servers/_template/`

**No authored server exists in this repo yet.** `mcp-servers/ansible` and
`mcp-servers/graphify` are both external, so `_template/` holds the only
`pyproject.toml` here and everything below is read from scaffolding rather
than from a server that has run. That is `ADR-0010`'s deferral arriving and
its **obligation 2** — *"the authored-server section gets verified against
reality rather than assumption"* — being discharged by reading. `TASK-0067`
walks the path for the first time and will find what reading cannot.

The template is **three files**, with no `README.md` and no `__init__.py`:

```
mcp-servers/_template/
  pyproject.toml
  src/template_mcp_server/server.py
  tests/test_server.py
```

| Element | What the template actually does | Gated |
|---|---|---|
| Shape marker | `pyproject.toml` present, `server.json` absent. The shape is derived from the marker, never self-declared. | **yes** |
| Python | `requires-python = ">=3.10"`. | **no** |
| Build backend | `hatchling`, declared in `[build-system]`. | **no** |
| Layout | src layout — `src/<package>/server.py`, the package being the project name with hyphens as underscores, which is what hatchling auto-detects. **There is no `__init__.py`.** Nothing here has built the template, so whether hatchling packages it as it stands is **unverified**; `TASK-0067` finds out. | **no** |
| Dependencies | Exactly one: `mcp>=1.0`. | **no** |
| "FastMCP" | `from mcp.server.fastmcp import FastMCP` — the FastMCP **bundled in the official `mcp` SDK**, not the standalone `fastmcp` distribution on PyPI. They are different packages on different version lines, and the bare word "FastMCP" in this guide has always meant the bundled one. | **no** |
| One tool per concern | One `@mcp.tool()`, on `echo(text: str) -> str`. | **no** |
| Document every argument | A Google-style `Args:` block in the tool's docstring. FastMCP derives the argument schema from the annotated signature and the tool description from the docstring, so an undocumented argument reaches the client unexplained. | **no** |
| Entry point | `[project.scripts] template-mcp-server = "template_mcp_server.server:main"`, with `main()` calling `mcp.run()`. | **no** |
| Tests | `tests/test_server.py`, importing the tool function directly. **pytest is not declared anywhere and nothing in this repository runs it** — "tests required" is a convention here, not a gate. | **no** |

**What `tests/validate.sh` checks on an authored server is the marker file,
and nothing else.** It never reads `pyproject.toml`. In particular the
destructive-capability gate and the `.env.example` completeness check both
parse `server.json`, so they **never see an authored server at all** — raised
as `B-024`. The first authored server this repo plans to ship is a command
runner, the most destructive surface it could have, which is why `ADR-0022`
makes closing `B-024` an acceptance criterion of that server's own task
rather than a follow-up.

**`tests/smoke-mcp.sh` skips authored servers entirely.** It iterates
`mcp-servers/*/` and `continue`s past any directory without a `server.json`,
with the comment *"authored Python servers: none yet"*. That is `ADR-0010`'s
**obligation 1**, still open and owned by `TASK-0067`.

**`scripts/sync-registry.sh` reads the registry row out of `pyproject.toml`
by line prefix** — `grep '^name = '` and `grep '^description = '`, first match
of each, quotes stripped. So both must be single-line, double-quoted values
starting at column 1. A folded, multi-line or single-quoted `description`
reaches the registry mangled: the same defect class as the skills' single-line
`description` rule, in a different file format.

#### Two launch-form discrepancies, both owned by `TASK-0067`

Named here rather than fixed — this section defines, `TASK-0067` resolves
(`ADR-0008`).

1. **`cd` versus `--directory`.** `scripts/install.sh` prints
   `cd mcp-servers/<name> && uv run <name>`. That is a correct instruction for
   a human at a shell and **not usable in a client config**: an MCP client
   launches the command with a working directory of its own choosing, so a
   config needs the cwd-independent form `uv --directory <absolute-path> run
   <name>`. One of the two must change, or both must be stated with which is
   for which. `ADR-0010`'s obligation 1 anticipated `uv run <name>` as the
   authored launch convention and did not anticipate this split.
2. **`uv run <name>` names the console script, not the directory.**
   `install.sh` prints `uv run $(basename "$d")`, so the printed command only
   works when the `[project.scripts]` entry point **equals the directory
   name**. The template does not model that: its directory is `_template` and
   its script is `template-mcp-server`. There is no rule that they match — the
   external shape requires `name` to equal the directory name, the authored
   shape has no such requirement and nothing checks one. A server copied
   verbatim from the template into `mcp-servers/foo/` gets an `install.sh`
   line that does not run.

Neither is settled here. Both are facts about the repository as it stood on
2026-09-23, read from `install.sh`, `sync-registry.sh`, `smoke-mcp.sh`,
`validate.sh` and the template itself.

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
| `mode` | Required. `primary` or `subagent`, and **only** those two — OpenCode accepts a third value, `all`, which this repo rejects deliberately; see below. Not inferred: OpenCode has an explicit `mode` field while Claude Code has none, so the emitter must be told rather than guess. An interactive role **must** be `primary` — Claude Code strips `AskUserQuestion` from every subagent regardless of its tool list, and OpenCode's default `subagent_depth: 1` stops a subagent spawning workers. A role a driver invokes with `opencode run --agent` must **also** be `primary`: a `subagent`-mode role is not refused, it is **silently replaced by OpenCode's default agent**, which answers with well-formed stdout and exit 0 (`TASK-0055`, `ADR-0022` clause 5.1). |
| `capabilities` | Required, non-empty list drawn **only** from the vocabulary below. This is the role's safety boundary, stated in abstract terms because the emitter has to translate it into two different permission models — a boundary written in one client's syntax cannot be translated into the other's, and is silently discarded rather than rejected. |
| `delegates_to` | *Required **iff** `capabilities` includes `delegation-allowlist`; forbidden otherwise.* A non-empty **block list** of role names this role may invoke — one `- name` per line. The inline flow form (`[a, b]`) is **not read** and fails the gate. Held in its own key rather than inside `capabilities` because every vocabulary term is a plain string and the parsers read flat sequences; nesting a parameter would change the schema's shape for one term. Stated as `iff` because it is checkable in both directions, and both are checked. Every name must resolve to a role in `agents/` that is emitted for **every** client the delegating role declares — see *A delegate must exist for every client the caller declares* below. |
| `bash_allow` | *Required **iff** `capabilities` includes `bash-allowlist`; forbidden otherwise.* A non-empty **block list** of command patterns this role may run — one `- 'git *'` per line, quoted because a glob is not a bare YAML scalar. Everything not matched is **denied**, not prompted. Same block-list-only rule as `delegates_to`, for the same parser reason. Entries are gated: see *Both command allowlists are constrained* below. |
| `test_allow` | *Required **iff** `capabilities` includes `test-allowlist`; forbidden otherwise.* A non-empty **block list** of test-command patterns, same quoting, block-list-only rule and **entry guards** as `bash_allow`. Merges into the same emitted `bash` map, so a role may hold both keys. |
| `clients` | Required. List of clients this role is emitted for: `claude-code`, `opencode`, or both. Declared rather than derived, because a role asking for a capability a client cannot enforce is a **scoping decision**, not something the emitter should silently resolve. |
| `model` | *Optional.* A **tier name**, never a client-native model ID. The two clients' model formats are mutually invalid — OpenCode wants `provider/model-id`, Claude Code wants an alias, a full ID or `inherit` — and OpenCode accepts a foreign value at parse time and **fails only at run time**. **Omit it: no tier resolver exists in this repo** — see the note below. |
| Body | Required, non-empty. Everything after the frontmatter is the system prompt, emitted verbatim to both clients. It is the one part of a role that is genuinely portable. |

#### `mode: all` is rejected on purpose, not overlooked

OpenCode accepts a **third** mode. At `opencode 1.18.31`, `opencode agent
list` reports `(all)` beside `(primary)` and `(subagent)`, and
`opencode run --agent` selects an `all` role correctly — a discriminating
result, since the same fixture shape under `mode: subagent` fell back to the
default agent (`TASK-0055`). `tests/validate.sh` admits `primary` and
`subagent` only.

**That is a decision taken here, not an omission.** `ADR-0022` clause 5.2
required it to be made explicitly: *"deciding it by leaving `MODES` alone is a
decision; making it silently is not."* The decision is **reject**, for three
reasons.

1. **`mode` is a portability declaration, not a passthrough of OpenCode's
   field, and it is load-bearing for a safety rule.**
   `delegation-allowlist` is valid only with `mode: primary`, because Claude
   Code honours an `Agent(...)` allowlist for a main-thread agent and
   **ignores it inside a subagent definition**. `all` means *both*. A role
   declaring it would carry a boundary that is enforced or silently widened
   **depending on how it happens to be invoked**, which no reader can
   determine from the file. Preventing exactly that is what this field is
   for.
2. **Nothing needs it.** Every role a driver invokes must be `primary`
   (`ADR-0022` clause 5.1), and no role in this repo is both a driver target
   and a delegate. `ADR-0018` clause 8.1: *a term is not admitted merely
   because it can be written* — and "OpenCode accepts it" is that argument in
   another form.
3. **What `all` does beyond selection is untested.** `TASK-0055` established
   that `--agent` selects an `all` role. It did **not** establish that
   OpenCode's `task` tool offers one as a delegate, nor what either client
   does with `delegation-allowlist` on it. Admitting a schema value on a third
   of the evidence is what `ADR-0008`'s definition-first order exists to stop.

**The rejection is loud, and it fires in the right place.**
`tests/validate.sh` fails the commit with `mode 'all' is not one of: primary,
subagent` — in this repository, at authoring time, rather than in a client at
run time. Gated: **yes**, by `MODES` in `tests/validate.sh` as it stands.
`TASK-0059` changes no value in that set; what it owes is that the message
reads as a deliberate rejection rather than an unrecognised string.

**What would reopen it**, so this is a decision with a condition rather than a
wall: a role that genuinely must be *both* a driver target and a delegate.
Admitting `all` then requires, in this order — a run establishing whether an
`all` role appears in OpenCode's `task` delegate set and what each client does
with `delegation-allowlist` on it; this section rewritten to say so; and only
then the gate widened.

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

#### A delegate must exist for every client the caller declares

**The rule, in two halves, both checked.** If role `A`'s `delegates_to` names
`B`, then:

1. `B` must be a role directory under `agents/`; and
2. every client in `A`'s `clients` must also appear in `B`'s `clients`.

**The reason is evidence, not analogy.** Claude Code validates the top-level
`--agent` **loudly** — `claude -p --agent <absent>` exits 1 with 182 bytes of
stderr naming every available agent — and does **not** validate the names
inside an agent definition's `tools: Agent(...)` allowlist. A control fixture
naming only an absent delegate produced **0 bytes of stderr**, exit 0, and a
role that reported having **no delegates at all** (`TASK-0056`, `claude
2.1.246`). The second control is what makes the first meaningful: the warning
channel works, so the silence is a finding rather than a client that never
warns.

So a role whose entire purpose is delegation can load, run and look correct
while being unable to delegate — `ADR-0018` clause 8's invisible degradation,
occurring inside Claude Code's own mechanism.

**The emitter cannot catch this.** `scripts/emit-agents.py` sees one role at a
time and has no reason to doubt a name, so the check belongs at source, before
emission.

**Gated: yes.** `tests/validate.sh` enforces both halves and reports
`INVALID DELEGATION: …`. Added by `TASK-0075`, which closed `B-028` — the live
instance was `agents/designer-manager/`, declaring `clients: [claude-code,
opencode]` while delegating to the OpenCode-only `git-ops`; it was narrowed to
`opencode` only.

**Either side may move, and the author decides which.** Narrow the caller's
`clients`, or widen the delegate's. Widening a delegate that exists to enforce
an OpenCode-only capability is not an option — the emitter refuses it (clause
8), which is the intended outcome, so in practice the caller narrows.

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

#### Both command allowlists are constrained, by one rule

`bash_allow` and `test_allow` name commands, and both are gated identically —
one check, so the two cannot drift apart. `B-021`'s warning is what the rule
exists for: *"do not resolve it by adding `bash: allow` — that hands a test
runner arbitrary shell and dissolves the boundary the role exists to have."*

1. **No entry may be a bare `*`.** Under OpenCode's last-match-wins
   resolution, `"*": deny` followed by `"*": allow` **is** `bash: allow` with
   extra steps. A role that wants unrestricted bash simply omits the
   capability; an allowlist that allows everything is a contradiction in
   terms.
2. **No entry may contain a shell chaining metacharacter** — `;`, `&&`, `||`,
   `|`, `$(`, a backtick, or a newline. Otherwise `pytest; rm -rf /` is one
   "test command" and the boundary is decorative.

**Narrow wildcards are fine.** `*pytest*` matches commands containing
`pytest` and nothing else. Only the bare `*` is rejected.

> **Corrected by `TASK-0074`, closing `B-027`.** Two things were wrong here.
> First, `TASK-0071` gated `test_allow` and **not** `bash_allow`, so
> `bash_allow: ['*']` was a legal way to write the exact resolution `B-021`
> forbade. Second, its wildcard rule rejected every entry *beginning* with
> `*`, which **enforced more than its own justification supported** — the
> stated reason was that an allowlist must not open universal, and `*pytest*`
> does not. A rule that fires on a legitimate case gets deleted by the next
> author rather than argued with, so it was narrowed to the bare wildcard at
> the same time as it was extended to the second key.
>
> `B-027` also recorded a counter-argument — that a blanket `*` *"may be a
> legitimate thing for an author to write deliberately"* in the
> general-purpose term. **Retracted:** omitting `bash-allowlist` already
> expresses that, and expresses it honestly.

**The ceiling, stated plainly.** These terms bound the **command surface** a
role may invoke. They do not bound what the commands themselves execute, and
no per-agent permission model can: running a test *is* running arbitrary code.
A role holding `test-allowlist` cannot invoke `curl`; it can run a test that
does. Do not read either term as a sandbox — they narrow what the agent may
type, not what the repository's own test suite may do.

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
drop-in translation of the other.

**Still unsettled as of 2026-09-23, and recorded as such deliberately.**
`ADR-0018` clause 7 assigned the question to `TASK-0040`; it is still open,
and `TASK-0056` **tried and failed** to settle it, which is worth stating so
the gap does not read later as one nobody looked at.

`TASK-0056`'s run was **confounded**. A fixture declaring `isolation:
worktree` had every write refused by the *permission* layer, across three
different mechanisms, so the run could not distinguish isolation from denial.
Its `pwd` and `git rev-parse --show-toplevel` both returned the **real**
directory rather than a copy, which points *against* a copy being made — but
that fixture ran as a main-thread `claude -p` agent, and the behaviour
described above concerns **subagents**, which the run never exercised.
**Nothing in it is a verdict**, and it must not be cited as one.

**What the repo does today is behaviour, not a decision.**
`scripts/emit-agents.py` emits `isolation: worktree` for Claude Code and flags
the mapping `partial`. Read that as the unresolved state persisting in code,
not as the question having been answered in favour of emitting.

**One question settles it**: does a commit made by a `worktree`-isolated
**subagent** reach the real repository? It needs a run in an environment where
writes are permitted. It cannot be reasoned out, and this guide does not.

**Scope, stated so nobody has to re-derive it.** Every role in `agents/`
declares `worktree-only` — all six. Two of them, `critic` and `ideator`, are
emitted for Claude Code today, so they are the roles carrying the unresolved
mapping right now. All nine roles planned for the unattended-run set declare
it too (`ADR-0022`), and for the *acting* roles among them the difference is
material: **an isolated copy is the wrong confinement for a role that must
commit to the real tree.** Until this is settled, do not declare
`worktree-only` on a Claude Code role whose job is to commit — either narrow
that role to `opencode`, or wait for the answer.

Owner: `TASK-0040`, unchanged.

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
