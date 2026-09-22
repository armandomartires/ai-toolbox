# ADR-0021 — Third-party agent extensions are wired, not vendored, and "plugin" is not a capability

## Status

**Proposed**, 2026-09-16. Opened by `PLAN-0005` (sprint S8).

**Not blocked.** Unlike ADR-0016 this decision rests on facts already
observed rather than on an unverified claim: the three products' integration
surfaces were read from npm metadata and upstream *source* during planning
(evidence below, with dates). What it does **not** yet rest on is any
behaviour observed on this machine — that is `TASK-0048`'s job, and this ADR
names in advance which of its clauses that spike could falsify.

## Context

A human asked for three "plugins" to be added to this repo and made
cross-agent compatible where possible: **ponytail**, **omniroute**,
**graphify**.

### The word names three unrelated mechanisms

Established by reading npm metadata and upstream repositories on
2026-09-16, against installed `opencode 1.18.31` and `claude 2.1.246`:

| Product | What it actually is | OpenCode surface | Claude Code surface |
|---|---|---|---|
| ponytail | `@dietrichgebert/ponytail` 4.10.0, MIT. A prompt ruleset plus six Agent Skills | npm plugin entry; package `main` is `./.opencode/plugins/ponytail.mjs` | **plugin marketplace** — `/plugin marketplace add` then `/plugin install`, running two Node lifecycle hooks |
| omniroute | `omniroute` 3.8.50. A **local gateway service** — an OpenAI-compatible endpoint on `:20128` fronting many providers | `@omniroute/opencode-plugin` 0.2.1, a *provider* plugin needing the service running and an API key | **not a plugin at all** — a base-URL redirection, optionally an HTTP MCP server |
| graphify | `@sentropic/graphify` 0.18.0, MIT, `node>=20`. A **CLI** (`bin: graphify`) that writes its own per-platform integrations | generated plugin file (see the discrepancy below) | `CLAUDE.md` section plus a `PreToolUse` hook, written by `graphify claude install` |

There is no single capability here to abstract. ponytail is a plugin in
both clients but by two unrelated mechanisms; omniroute is a plugin in one
client and a configuration value in the other; graphify is a plugin in
neither sense — it is a CLI that generates rules files and can also speak
MCP. ADR-0006's resolution generalises directly: **portability is scoped
per capability**, and "plugin" is not a capability.

### ADR-0016 already declined a category, and its reasoning still holds

ADR-0016 declined a `hooks/` category. **(Dated note, 2026-09-22,
`TASK-0054`: this section was written 2026-09-16, when ADR-0016 was
`Proposed`. It is now **Accepted — 2026-09-22**. The text is left as written;
only this note and the one at the end of the section are added, because that
status is asserted twice here and this ADR is itself still `Proposed` and
about to be read as the current sprint's.)** Its plumbing claims were **re-verified on 2026-09-16** rather
than cited, because they are the load-bearing half of this decision and
two sprints have landed since they were written. All three still hold:

- `scripts/sync-registry.sh:120-132` has **four** hardcoded `emit_section`
  calls (Skills, MCP Servers, Loops, Agents).
- `tests/validate.sh` hardcodes its iteration roots: `skills/*/SKILL.md`
  (`:21`), `mcp-servers/*/` (`:122`), `loops/*/loop.md` (`:205`),
  `agents/*/` (`:412`).
- `scripts/install.sh:50` has a four-column `CLIENTS` table with no notion
  of a fifth component category.

So a new top-level directory is still **silently ignored** by all three and
by CI's staleness check — invisible rather than loud.

ADR-0016 also named, in advance, the exact trap these three products fall
into: *"naming a category after one vendor's term for a capability the
other implements differently is how confusion starts."* That sentence was
written about hooks-versus-plugins and applies here unchanged.

**This ADR extends ADR-0016; it does not reopen it.** The two cover
adjacent cases: ADR-0016 declined a category for a capability this repo
would *implement itself*, and this one declines a category for third-party
extensions this repo would *consume*. Neither supersedes the other, and
~~ADR-0016 stays `Proposed` (it is still blocked on `TASK-0028`, which is
unrun and belongs to parked sprint S6).~~ **Superseded 2026-09-22
(`TASK-0054`): every clause of that parenthetical is now false. `TASK-0028`
ran on 2026-09-16 and is `done`; S6 was un-parked on 2026-09-17 and is closed
on `REVIEW-0010`; ADR-0016 is **Accepted — 2026-09-22**. Struck rather than
deleted, because it dates what this ADR was reasoning from.** The substantive
claim is unaffected: the two ADRs cover adjacent cases and neither supersedes
the other.

### Upstream already did the porting, and vendoring would take ownership

ponytail ships adapters for roughly twenty hosts; graphify's
`graphify install --platform <name>` covers seventeen. Re-implementing
either here would recreate the three-copies problem ADR-0004 paid for.

Worse, it would create an ownership this repo cannot honour. Skills deploy
with `ln -sfn` (`scripts/install.sh:105`, ADR-0002's symlink-first
preference), so a vendored copy of ponytail's six skills would become a
**symlink into this repo's working tree** — making this repo the
maintainer-of-record for content whose upstream ships independently. That
is the same mechanism which, in S6, invalidated ADR-0015's "portable core
plus per-project templates" shape: a deployed skill is a symlink, so
anything written into it is written into this repo.

### Two discrepancies found by reading source instead of READMEs

Both were found during planning, and both are recorded because they set
`TASK-0048`'s agenda and calibrate how much any vendor README is worth:

1. **graphify's README contradicts graphify's source about OpenCode.** The
   README's "Supported assistants" section lists OpenCode among platforms
   that *"use `AGENTS.md` as the always-on mechanism instead"* of a hook.
   But `src/cli.ts` defines
   `OPENCODE_PLUGIN_ENTRY = ".opencode/plugins/graphify.js"` together with
   an `OPENCODE_PLUGIN_JS` template whose own comment reads *"Injects a
   knowledge graph reminder before bash tool calls"* — a real OpenCode
   plugin with a `tool.execute.before` hook. Doc and source disagree;
   **neither is evidence of installed behaviour**, so this is resolved by
   observation in `TASK-0048`, not by choosing a side now.

2. **`graphify serve` cannot start without an existing graph.** Read from
   `src/serve.ts:188-195`: `createReloadingGraphStore` calls
   `validateGraphFilePath` and, on failure, does `console.error` followed
   by `process.exit(1)`. `serve.ts:896-897` defaults the path to
   `resolveGraphInputPath()`. So on a repo with no `.graphify/graph.json`
   the server exits 1 immediately — it never speaks MCP.

The second finding matters beyond graphify, because it collides with an
existing test. `tests/smoke-mcp.sh` launches each external server from its
manifest's `launch.command` and performs a real `initialize` handshake. Its
own header insists on three outcomes and that *"a SKIP is not a pass"*. An
unbuilt graph would make it report **FAIL** where the truth is
*precondition unmet* → **SKIP** — the mirror image of the defect that
header guards against, and a check that lies in the opposite direction. It
is named here so `TASK-0049` decides it deliberately instead of meeting it
at run time.

### What the existing categories already accommodate

- `mcp-servers/` external shape (ADR-0005): a published upstream package
  described by a `server.json` manifest, with no source vendored.
  **graphify fits**: real npm package, a `bin`, and a stdio MCP transport.
- `configs/*/README.md`: per-client wiring snapshots. **ponytail fits**,
  and this is the only category it can fit — see the next paragraph.

**ponytail cannot use the external-server shape, and the reason is
factual.** Upstream *does* ship an MCP server (`ponytail-mcp/`) that would
be the portable answer, exposing the ruleset as a prompt and a read-only
tool. But its `package.json` declares `"private": true` and it is **not
published to npm** (`registry.npmjs.org/ponytail-mcp` → *Not found*,
checked 2026-09-16). ADR-0005's external shape exists for *"servers that
ship as a complete upstream package … with no source to vendor"*; with
nothing published there is no `launch.command` to record. The shape's
premise fails, so ponytail is documented wiring only.

### omniroute is deliberately reduced in scope

**Human decision, 2026-09-16**: omniroute is kept **out** of the component
layer entirely and documented only as an optional third-party tool a user
may wish to install.

This is the right call and worth recording rather than merely obeying.
omniroute is a model-provider gateway: it replaces where inference comes
from, and it is a *service* with a daemon, an API key and a dashboard. It
does not extend an agent's behaviour the way a skill, a loop or a role
does. Documenting it as a component would have invited exactly the
question *"why is this a component?"* — with no good answer. It also has
the largest blast radius of the three: its OpenCode plugin's
`mcpAutoEmit` option **writes an `mcp.*` entry into the client config**,
which is a mutation this repo forbids itself (emission writes role files
only and never touches `opencode.jsonc`).

## Decision

**1. No new component category.** No `plugins/` directory is created, and
no plumbing changes are made to `scripts/install.sh`,
`scripts/sync-registry.sh` or `tests/validate.sh` for this work.

**2. A third-party extension is placed by what it *is*, not by what its
vendor calls it.** The routing rule, in order:

| If the extension… | Then it lives in… |
|---|---|
| has a published upstream package **and** an MCP transport this repo can launch | `mcp-servers/<name>/server.json` (ADR-0005 external shape) |
| integrates through client-native mechanisms only (plugin entries, marketplaces, hooks, rules files) | `configs/<client>/README.md`, one section per client |
| is a service or tool that changes the *environment* rather than the agent's behaviour | `docs/development/third-party-tools.md` — documented as optional, never installed |

The routing is decided by observed facts about the upstream package, so it
cannot be settled by a vendor's marketing term.

**3. Nothing is vendored.** No third-party skill, plugin, hook or ruleset
is copied into this repo. Upstream remains the maintainer. This repo
records a *pinned version*, the wiring, and the risks.

**4. Nothing is auto-installed.** `scripts/install.sh` is not extended to
write into `~/.claude/plugins/`, `~/.config/opencode/opencode.jsonc`, or
any client's plugin registry. The user runs upstream's own installer. This
preserves the line the repo already holds deliberately for agent emission.

**5. A capability claim about any of these three cites vendor
documentation *or* a version-stamped observation — and says which.** Where
a README and the upstream source disagree, neither is treated as
authoritative for installed behaviour; the disagreement is recorded and
resolved by observation. This is ADR-0020's standing rule applied to a new
class of external state.

**6. This repo produces *documentation* for ponytail and omniroute, and a
*pinned manifest* for graphify. That is the whole deliverable.** A
`configs/` section is not a deployment and must not be described as one.

## Consequences

- **Cross-agent compatibility is achieved by documenting each client's own
  mechanism accurately, not by inventing a portable abstraction over
  three mechanisms that share only a name.** For ponytail that means two
  genuinely different install procedures plus an unverified third client;
  for graphify, one manifest plus a caveat. Any single "install our
  plugins" instruction would be false for at least one client.

- **The `plugins/` question is now answered in writing, so it need not be
  re-raised.** B-009's lesson applies: an item's title encodes an
  assumption, and roughly a third do not survive contact with the files.
  Here the assumption was inside the human's word "plugins", and it did
  not survive.

- **Three of ADR-0016's stated reasons are re-confirmed as current** (four
  hardcoded registry sections, four hardcoded gate roots, a four-column
  installer table), which is a small piece of evidence that its `Proposed`
  status is a scheduling artifact rather than a doubt about its reasoning.

- **The deliverable for two of three products is prose, and that is the
  main risk this decision accepts.** A declared thing with nothing behind
  it is the pattern `mcp-servers/_template/`, `prompts/` and `agents/`
  each demonstrated, and ADR-0016 recorded what "later" has meant for the
  latter two: indefinitely. The defence is ordering — `TASK-0048` runs
  **first** and makes the prose *verified* rather than transcribed. **If
  sprint S8 shrinks, the honest cut is a product, never the spike.**

- **`tests/smoke-mcp.sh` may need a precondition-aware outcome**, or
  graphify must be excluded from it with the reason recorded in the
  manifest's `preconditions`. Deciding this is `TASK-0049`'s, and either
  outcome is acceptable provided a precondition failure is **never**
  reported as FAIL. Changing that script is *permitted* by clause 1, which
  bars new-category plumbing, not a correctness fix to an existing test.

- **Three claims here could be falsified by `TASK-0048`, and each has a
  named consequence.** Recorded so the spike cannot quietly rubber-stamp
  this ADR:
  1. If graphify's OpenCode integration is a real plugin (source) rather
     than `AGENTS.md` (README), `TASK-0050`'s scope is unaffected but
     `configs/opencode/README.md` must describe a plugin, and graphify
     then occupies **two** rows of clause 2's table at once — a manifest
     *and* a client-native plugin. The table's rows are not exclusive, and
     that must be stated where it is used.
  2. If `@dietrichgebert/ponytail` does not load from an npm `plugin`
     entry — plausible, since its package `main` points into a dotfile
     directory (`./.opencode/plugins/ponytail.mjs`) — then ponytail has
     **no working OpenCode surface**, and clause 6's honesty requirement
     means saying so rather than printing an entry that does not work.
  3. If `graphify serve` turns out to start without a graph (contradicting
     `serve.ts:188-195`), the smoke-test problem evaporates and
     `TASK-0049` simplifies. **A finding that removes work is a
     result**, and ADR-0017's rejection is the precedent: a spike that
     kills its own follow-up work succeeded.

- **Reopen trigger.** Revisit this decision only if **all three** hold:
  (a) three or more third-party extensions need the *same* per-client
  emission logic, so an abstraction would remove duplication rather than
  add a layer; (b) that logic is expressible without a vendor-specific
  term as its category name; and (c) the plumbing cost is scoped as its
  own tasks in ADR-0008's order — definition, enforcement, indexing,
  deployment — with a human's agreement, never inside a content task.
  A single new extension is **not** a trigger.
