# PLAN-0005 — Third-party agent extensions: ponytail, graphify, and one tool left out

## Objective

Bring three human-requested third-party "plugins" into this repo's
governance in the category each one actually belongs to, cross-client
where a client genuinely supports the capability — **without** creating a
component category, changing any plumbing, or vendoring anyone's source.

Scope, decided before planning finished:

- **graphify** → an external MCP server (`mcp-servers/graphify/server.json`).
- **ponytail** → per-client wiring documentation in `configs/*/README.md`.
- **omniroute** → **out of the component layer** (human decision,
  2026-09-16). Documented once as an optional third-party tool a user may
  want to install, and nothing more.

Everything rests on `ADR-0021` and on one spike that runs first.

## Context consulted

### This repo

- `AGENTS.md` — objective and scope ("every component must be
  self-contained and portable across every client that supports its
  capability"), security rules, definition of done, the ambiguity policy.
- `ADR-0016` (hooks as a category — **declined**) — its plumbing findings
  are the load-bearing precedent, and were **re-verified on 2026-09-16**
  rather than cited. All three still hold.
- `ADR-0005` (two MCP server shapes) and
  `docs/development/authoring-guide.md:48-76` (the `server.json` schema).
- `ADR-0004` (three-copies problem), `ADR-0002` (symlink-first),
  `ADR-0009` (no runtime-presence validation),
  `ADR-0020` (capability claims about third-party clients must cite vendor
  docs or a version-stamped observation).
- `ADR-0008` (definition before enforcement) — quoted for the ordering it
  would impose *if* plumbing were ever needed. It is not, in this sprint.
- `tests/validate.sh` — read for the checks that will judge these
  artifacts: manifest schema (`:122-200`), the `.env.example` completeness
  check (`:684-712`), the wiring-snapshot-per-client check (`:643-652`),
  the `## Inputs` / `## Outputs / handover` handover contract (`:820-893`),
  and the registry-integrity checks.
- `scripts/sync-registry.sh:100-133`, `scripts/install.sh:34-165`,
  `tests/smoke-mcp.sh:1-60`.
- `.ai/context/CURRENT_STATE.md`, `.ai/planning/ROADMAP.md`,
  `.ai/planning/SPRINT-CURRENT.md` (S7), `.ai/planning/BACKLOG.md`.

### Upstream (fetched 2026-09-16, not recalled)

- `registry.npmjs.org` metadata for `@dietrichgebert/ponytail` (4.10.0),
  `@sentropic/graphify` (0.18.0), `omniroute` (3.8.50),
  `@omniroute/opencode-plugin` (0.2.1), and `ponytail-mcp` (**404 — not
  published**).
- `github.com/DietrichGebert/ponytail` — README, repo tree,
  `skills/ponytail/SKILL.md`, `ponytail-mcp/README.md`,
  `ponytail-mcp/package.json`.
- `github.com/rhanka/graphify` — README, and crucially `src/cli.ts` and
  `src/serve.ts`, which is where two README claims were falsified.
- `opencode.ai/docs/plugins/` — the plugin loading model, directories and
  load order.

### The live machine (read as evidence)

- `opencode 1.18.31`, `claude 2.1.246` (Claude Code), `codex-cli` present.
- `~/.config/opencode/opencode.jsonc` — already carries a `plugin` array
  with one entry (`opencode-arcade-hub`), so the mechanism is in use and
  the wiring shape is known-good on this machine.
- `~/.claude/plugins/` — exists, holds `known_marketplaces.json` and one
  marketplace (`claude-plugins-official`); `~/.claude/settings.json` is
  `{"theme":"dark"}` only.
- No `.graphify/` anywhere in this repo, which is what makes the
  `graphify serve` precondition problem concrete rather than theoretical.

## Findings that shape this plan

### F1 — "Plugin" is three unrelated mechanisms, so there is nothing to abstract

ponytail is a plugin in both target clients but through two unrelated
mechanisms (an npm `plugin` entry vs. a marketplace install running two
Node lifecycle hooks). omniroute is a plugin in OpenCode and a *base URL*
in Claude Code. graphify is a plugin in neither sense: it is a CLI that
generates each platform's integration and can additionally speak MCP.

ADR-0006's resolution generalises: portability is scoped **per
capability**, and "plugin" is not a capability. Full evidence table in
`ADR-0021`.

### F2 — ADR-0016 already declined this category, and its reasons are current

Re-verified 2026-09-16, because the claims are two sprints old and are the
reason this sprint adds no plumbing:

- `sync-registry.sh:120-132` — four hardcoded `emit_section` calls.
- `validate.sh` — four hardcoded iteration roots (`:21`, `:122`, `:205`,
  `:412`).
- `install.sh:50` — a four-column `CLIENTS` table.

A new top-level directory is still silently ignored by all three and by
CI's staleness check. ADR-0016 also predicted this sprint's specific trap
in words: naming a category after one vendor's term for a capability
another implements differently.

### F3 — graphify's README contradicts graphify's source about OpenCode

The README lists OpenCode among platforms that use `AGENTS.md` because they
lack a `PreToolUse` hook. `src/cli.ts` defines
`OPENCODE_PLUGIN_ENTRY = ".opencode/plugins/graphify.js"` plus an
`OPENCODE_PLUGIN_JS` template that hooks bash tool calls — a real plugin.

**Neither is evidence of installed behaviour.** This is exactly the class
`TASK-0036` was created for in S7 (*"a doc-confirmed field is not an
installed field"*), and it is resolved by observation in `TASK-0048`, not
by choosing the more convincing document.

### F4 — `graphify serve` cannot start without a graph, which breaks the smoke test

From source: `serve.ts:188-195` — `createReloadingGraphStore` calls
`validateGraphFilePath` and on failure does `console.error` then
`process.exit(1)`; `serve.ts:896-897` defaults the path to
`resolveGraphInputPath()`.

`tests/smoke-mcp.sh` launches from `launch.command` and expects an
`initialize` reply. With no `.graphify/graph.json` it would report
**FAIL** where the truth is *precondition unmet* → **SKIP**. That script's
own header insists a SKIP is not a pass; this is the mirror defect — a
check lying in the other direction — and it must be decided in
`TASK-0049`, not discovered when someone next runs the smoke test.

### F5 — ponytail cannot use the external-server shape, on a checkable fact

Upstream ships `ponytail-mcp/`, which would be the portable answer: the
ruleset as an MCP prompt plus a read-only tool. But its `package.json`
says `"private": true` and `registry.npmjs.org/ponytail-mcp` returns **Not
found**. ADR-0005's external shape is for packages published upstream with
no source to vendor; with nothing published there is no `launch.command`.
So ponytail is `configs/` documentation only, and the reason is a fact
someone else can re-check in one command.

### F6 — Vendoring would silently make this repo the maintainer

`install.sh:105` deploys skills with `ln -sfn`. A vendored copy of
ponytail's six skills would be symlinked from this repo's working tree,
making this repo the maintainer-of-record for independently-shipping
upstream content. This is the same mechanism that killed ADR-0015's
"portable core plus per-project templates" shape in S6 — recorded there,
applying here unchanged.

### F7 — omniroute is a service, not an agent extension, and has the widest blast radius

It replaces where inference comes from: a daemon on `:20128`, an API key, a
dashboard. Two specifics worth carrying into the documentation rather than
discovering later:

- Its OpenCode plugin's `mcpAutoEmit` option **writes an `mcp.*` entry into
  the client config** — a mutation this repo forbids itself (emission
  writes role files only, never `opencode.jsonc`).
- Claude Code integration is not a plugin at all; it is an OpenAI-compatible
  base URL, optionally plus `claude mcp add-server`.

The human's decision to keep it out of the component layer is therefore
also the technically correct one, and `ADR-0021` records *why* rather than
just *that*.

### F8 — The value ranking, and this sprint's real risk

Highest value is **graphify** — it is the only one of the three that
becomes a real, pinned, indexed component with a machine-checked manifest.
Next is **ponytail**, whose value is entirely in accurate per-client
instructions. Lowest is **omniroute**, deliberately reduced to one
paragraph in a tools document.

The risk that follows: two of three deliverables are prose. That is the
pattern `mcp-servers/_template/`, `prompts/` and `agents/` each
demonstrated. The only defence is ordering — the spike runs first, so the
prose describes observed behaviour. **If this sprint shrinks, the honest
cut is a product, never the spike.**

## Phases / steps

Four phases. Phase 1 gates everything else, deliberately.

### Phase 1 — Verify before claiming

`TASK-0048`. Install and observe ponytail and graphify on this machine,
one client at a time, recording versions and dates. Answers F3, F4 and the
three falsifiable claims `ADR-0021` names. **No component files are
written in this phase.**

This ordering is S7's amended principle (*verify before claiming*) applied
from the start rather than after a correction.

### Phase 2 — graphify as a pinned external server

`TASK-0049`. `mcp-servers/graphify/server.json`, regenerated registry, and
the smoke-test decision from F4. Depends on Phase 1.

### Phase 3 — ponytail as per-client wiring

`TASK-0050`. Sections in all three `configs/*/README.md`, each describing
that client's own mechanism, including Bionic's honest *unverified*
status. Depends on Phase 1.

### Phase 4 — Make the rule findable, and record what was left out

`TASK-0051`. The `ADR-0021` placement rule into
`docs/development/authoring-guide.md`, and a new
`docs/development/third-party-tools.md` holding omniroute plus anything
else deliberately not made a component. Depends on Phases 2 and 3, since
it documents what they actually did.

Then `REVIEW-0009` closes the sprint.

## Tasks generated

| Task | Depends on | Status | What |
|------|-----------|--------|------|
| `TASK-0048` | none | planned | **Spike.** Verify ponytail and graphify on this machine; resolve F3 (graphify's OpenCode surface), F4 (`serve` without a graph), and whether ponytail loads from an npm `plugin` entry. Version-stamped observations only |
| `TASK-0049` | TASK-0048 | planned | `mcp-servers/graphify/server.json` pinned to `0.18.0`; registry regenerated; the smoke-test precondition decision made and recorded |
| `TASK-0050` | TASK-0048 | planned | ponytail wiring in `configs/claude-code`, `configs/opencode`, `configs/lm-studio-bionic`; the out-of-plugin-dir state files noted |
| `TASK-0051` | TASK-0049, TASK-0050 | planned | Placement rule into the authoring guide; `docs/development/third-party-tools.md` created with omniroute |
| `REVIEW-0009` | all | planned | Sprint checkpoint, with its headline question pre-committed below |

`TASK-0049` and `TASK-0050` are dependency-independent of each other but
**must not be assumed safely concurrent**. S7's TASK-0038/0039/0040
sequence is the precedent: three tasks that looked parallel shared a file
and a registry-visibility hazard. Here both would regenerate
`docs/registry.md` — only `TASK-0049` changes its content, but a
concurrent run makes the diff ambiguous. Sequence them, or check the
collision explicitly before parallelising.

## Acceptance criteria

Sprint-level. Per-task criteria live in the task files.

- [ ] `ADR-0021` is ratified or rejected by a human, on `TASK-0048`'s
      evidence — not on agreement with its prose.
- [ ] No `plugins/` directory exists; `install.sh`, `sync-registry.sh` and
      `validate.sh` have **no** new-category plumbing. (A precondition-aware
      fix to `smoke-mcp.sh` is permitted and is not category plumbing.)
- [ ] No third-party source is vendored: `skills/`, `agents/`, `loops/`
      gain nothing from ponytail, graphify or omniroute.
- [ ] `mcp-servers/graphify/server.json` exists, passes the manifest
      checks, and is pinned to an exact upstream version.
- [ ] Every required env var in that manifest appears in `.env.example`
      (the gate enforces this; if the manifest needs none, that is stated).
- [ ] Each of the three `configs/*/README.md` describes ponytail's real
      mechanism *for that client*, or states plainly that there is none.
- [ ] Bionic's ponytail status is recorded as **unverified**, with the
      B-018 approval-gating constraint referenced rather than restated.
- [ ] `docs/development/third-party-tools.md` documents omniroute as
      optional and never-installed, including `mcpAutoEmit`'s config
      mutation.
- [ ] The authoring guide carries the placement rule, so the category
      question is answered where an author will look.
- [ ] Every capability claim about a client is labelled *vendor doc* or
      *observed on <date>, <version>*.
- [ ] `tests/validate.sh` passes; `scripts/sync-registry.sh` re-run and the
      regenerated registry committed.
- [ ] `REVIEW-0009` answers its pre-committed question with evidence.

## Risks

- **Two of three deliverables are prose, which is this repo's known
  failure pattern.** Third instance after `mcp-servers/_template/` and
  `agents/`/`prompts/`. Mitigation is ordering (spike first) and nothing
  else. If the sprint shrinks, cut a product, not `TASK-0048`.

- **The spike could rubber-stamp the vendor READMEs.** Two README/source
  discrepancies were already found *before* the spike started, so a spike
  reporting zero findings is more likely weak than reassuring.
  `REVIEW-0009` must judge the spike's method, not just its verdict.

- **Third-party claims decay faster than this repo's own — and faster than
  the cross-client claims S7 already flagged.** These are three
  independently-shipping products plus two clients. ponytail is at
  4.10.0, graphify at 0.18.0 (pre-1.0, so breaking changes are expected by
  convention). A pinned version in a manifest is a *record*, not a
  guarantee; re-verify at the moment of acting.

- **An upstream installer may write outside its own directory, and nothing
  here can prune that.** ponytail's own README lists state it leaves
  behind: `~/.claude/.ponytail-active`, `~/.config/ponytail/config.json`,
  entries in `~/.cursor/hooks.json`, and a `statusLine` entry in
  `~/.claude/settings.json`. This repo neither creates nor removes any of
  it. Must be documented in `configs/`, since a user finding it will
  otherwise have no explanation — the same courtesy ADR-0017's
  two-`git-ops` note provides.

- **graphify's own surface includes destructive operations, and the
  manifest must not imply the whole CLI is read-only.** `graphify serve`
  is read-only, but `graphify ontology serve --write`,
  `graphify hook install` (writes git hooks and a merge driver) and
  `graphify store push` are not. `capabilities.destructive` describes the
  *wired* command; the rest belongs in `preconditions` or a note, or the
  manifest tells a comfortable half-truth.

- **`smoke-mcp.sh` could be made to lie in a new way.** If graphify is
  excluded to avoid a false FAIL, the exclusion must be visible, or the
  script silently stops covering a server it appears to cover. A check
  that cannot fail is this repo's most-repeated lesson.

- **Sprint S7 is not formally closed** (see the sprint file's note), so
  this plan opens Phase 8 while Phase 7 lacks its `REVIEW-0008`. Recorded
  rather than worked around; it is a human's call whether to close S7
  first.

## Human decisions required

1. **Ratify or reject `ADR-0021`**, after `TASK-0048` reports. Rejection is
   a legitimate outcome and has a precedent (`ADR-0017`).
2. **Confirm the omniroute reduction is as intended** — documented as an
   optional tool, no manifest, no wiring snippet, no registry row. Already
   given 2026-09-16; restated here because it is the decision that shapes
   the sprint's scope.
3. **Decide whether S7 closes with `REVIEW-0008` before S8 proceeds**, or
   whether the two sprints overlap deliberately.
4. **Authorize any change to `tests/smoke-mcp.sh`** if `TASK-0049`
   concludes the script needs a precondition-aware outcome. It is an
   existing validated test, and S7's experience is that editing shared test
   files is where task collisions live.
