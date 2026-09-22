# TASK-0048 — Spike: verify ponytail's and graphify's real integration surfaces

## Objective

Establish, by observation on this machine, what ponytail and graphify
actually do when installed into OpenCode and Claude Code — so that
`TASK-0049` and `TASK-0050` describe behaviour rather than transcribe
vendor prose, and so `ADR-0021` is ratified on evidence.

Three questions must be answered with a version-stamped observation each.
A fourth is a bonus if cheap.

## Minimal context

This is a spike: it produces **findings, not components**. No
`server.json`, no `configs/` section, no registry change comes out of it.

### Why it exists at all

`ADR-0020`'s standing rule is that a capability claim about a third-party
client cites vendor documentation *or* a version-stamped observation.
Everything currently known about these two products is vendor
documentation — and **two of those documents already contradict each
other**, found during planning by reading source instead of READMEs:

1. graphify's README lists OpenCode among platforms with no hook point,
   using `AGENTS.md` instead. `src/cli.ts` defines
   `OPENCODE_PLUGIN_ENTRY = ".opencode/plugins/graphify.js"` and an
   `OPENCODE_PLUGIN_JS` template that hooks bash tool calls.
2. `graphify serve` looks unable to start without an existing graph:
   `src/serve.ts:188-195` shows `createReloadingGraphStore` calling
   `validateGraphFilePath`, then `console.error` and `process.exit(1)` on
   failure; `serve.ts:896-897` defaults the path to
   `resolveGraphInputPath()`.

S7's `TASK-0036` is the direct precedent and its lesson is the reason this
task is first in the sprint: *a doc-confirmed field is not an installed
field*. It found four of ADR-0018's "established" facts wrong within four
days, and it found one negative claim that was false because the search was
too small (**"the brief named three pages; the fact was on a fourth"**).
Both traps are live here.

### What this task must not do

It must not conclude from a README. It must not conclude an absence from
one directory — `ADR-0020`'s generalisation is that **directory-name
inference is not evidence in either direction**, which is the mistake that
cost this repo two sprints of a false belief about Bionic.

### A note on ponytail's OpenCode entry

`@dietrichgebert/ponytail@4.10.0` has no `bin`, and its `main` and
`exports` both point at `./.opencode/plugins/ponytail.mjs` — a path inside
a dotfile directory. OpenCode's documented npm-plugin loading installs the
package via Bun and imports it. Whether that resolution works is a real
question, not a formality, and a negative answer is a publishable finding.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `ADR-0021` | this sprint (PLAN-0005) | `Proposed`; names three falsifiable claims in its Consequences |
| `.ai/planning/plans/PLAN-0005-third-party-agent-extensions.md` | this sprint | written; F3 and F4 are the questions below |
| `opencode` on PATH | pre-existing | `1.18.31` — re-check, do not assume |
| `claude` on PATH | pre-existing | `2.1.246` (Claude Code) — re-check |
| `~/.config/opencode/opencode.jsonc` | pre-existing | has a `plugin` array with `opencode-arcade-hub`; **back it up before editing** |
| `~/.claude/plugins/` | pre-existing | exists; `known_marketplaces.json` plus `claude-plugins-official` |
| `~/.claude/settings.json` | pre-existing | `{"theme":"dark"}` — note it, since ponytail may add a `statusLine` |
| `node`, `npm` on PATH | pre-existing | node ≥20 for graphify; needed for ponytail's hooks |
| `tests/smoke-mcp.sh` | TASK-0009 | passing/present; read its three-outcome contract before judging graphify |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

- Recording exact versions of both clients and both packages **before**
  anything is installed.
- **Q1 (graphify / OpenCode):** does `graphify install --platform opencode`
  write a plugin file, an `AGENTS.md` section, or both? Prefer the CLI's
  own dry-run/preview if it has one (`src/cli.ts` references a
  `printMutationPreview` / `platformInstallPreview`) so the answer costs
  no mutation.
- **Q2 (graphify / MCP):** run `graphify serve` in a directory with **no**
  `.graphify/graph.json` and record the exit code and stderr verbatim.
  Then, if cheap, build a graph on a small throwaway corpus and re-run, to
  confirm it *does* speak MCP once a graph exists.
- **Q3 (ponytail / OpenCode):** does `"plugin": ["@dietrichgebert/ponytail"]`
  load, given `main` points into `./.opencode/plugins/`? Record what
  OpenCode logs, and whether `/ponytail` becomes available.
- **Q4 (ponytail / Claude Code), if cheap:** does the marketplace install
  work, and what does it write outside its own plugin directory?
- Recording every file created or modified outside this repo, by absolute
  path — including anything upstream writes that no uninstaller removes.
- Reverting the machine to its prior state, and **verifying** the revert
  rather than assuming it.

### Not included

- Writing `mcp-servers/graphify/server.json` — that is `TASK-0049`.
- Writing any `configs/*/README.md` section — that is `TASK-0050`.
- Any omniroute install or test. It is out of scope by human decision; do
  not install a gateway service to satisfy curiosity.
- Changing `tests/smoke-mcp.sh`. This task *reports* the precondition
  problem; `TASK-0049` decides it, and a human authorizes it (PLAN-0005,
  Human decisions 4).
- Building a graph over **this** repo if that writes anything tracked.
  `.graphify/` is not in `.gitignore`; use a throwaway directory under
  `/tmp/` instead, or add the ignore entry in `TASK-0049` deliberately.

## Likely files

Forecast, written before the work. Inside this repo, this task should
touch **only** its own log:

- `.ai/tasks/TASK-0048-spike-third-party-extension-surfaces.md` (this file)
- `.ai/sessions/SESSION-*.md` and `.ai/sessions/INDEX.md`
- `.ai/context/CURRENT_STATE.md`

Outside this repo (expected to change, then be reverted):
`~/.config/opencode/opencode.jsonc`, `~/.claude/plugins/`,
possibly `~/.claude/settings.json`, `~/.config/ponytail/config.json`,
`~/.claude/.ponytail-active`, and a throwaway `/tmp/` corpus.

If this task ends up editing a component file, that is a scope breach and
belongs in Outputs as a finding.

## Execution plan

1. Record `opencode --version`, `claude --version`, `node --version`, and
   the resolved `latest` of both npm packages. Copy
   `~/.config/opencode/opencode.jsonc` and `~/.claude/settings.json` to a
   backup outside the repo. Note the current contents of
   `~/.claude/plugins/`.
2. **Q2 first**, because it is the cheapest and needs no client: install
   graphify (global or via `npx`), run `graphify serve` in an empty
   directory, record exit code and stderr **verbatim**. Do not paraphrase
   an error message — S7's TASK-0042 nearly recorded a false negative by
   matching a message remembered from a sibling check.
3. **Q1**: run graphify's install preview for `--platform opencode` if one
   exists; otherwise install into a throwaway project directory and list
   what appeared. Record whether a plugin file, an `AGENTS.md` section, or
   both were written, and quote the decisive output.
4. **Q3**: add the ponytail plugin entry to `opencode.jsonc`, start
   OpenCode, and record whether the plugin loads — from OpenCode's own
   log, not from the absence of an error. Check whether `/ponytail`
   exists.
5. **Q4** if steps 2–4 were cheap: ponytail into Claude Code via the
   marketplace, then enumerate what was written outside the plugin
   directory.
6. Revert everything: restore the backed-up configs, remove installed
   plugins, delete throwaway directories. **Verify** by diffing the
   restored files against the backups and confirming they match.
7. Write the findings into the Execution log, each labelled with the
   version and date observed. For any question that could not be answered,
   record **why** — an unanswered question recorded as such is a result; an
   unanswered question left blank is a hole.

## Acceptance criteria

- [ ] Both client versions and both package versions recorded, from the
      tools themselves.
- [ ] **Q1 answered**: graphify's OpenCode integration is stated as plugin,
      `AGENTS.md`, or both, with the observed output quoted.
- [ ] **Q2 answered**: `graphify serve` with no graph — exit code and
      stderr recorded verbatim; the `serve.ts:188-195` reading confirmed or
      corrected.
- [ ] **Q3 answered**: whether ponytail loads from an npm `plugin` entry,
      evidenced by OpenCode's log rather than by inference.
- [ ] Every out-of-repo file created or modified is listed by absolute
      path, including anything no uninstaller removes.
- [ ] The machine is reverted, and the revert is **verified** by comparison
      with the backups — not asserted.
- [ ] Each of `ADR-0021`'s three named falsifiable claims is marked
      confirmed, corrected, or untested — with untested being an acceptable
      recorded outcome.
- [ ] No component file in this repo was changed.
- [ ] `tests/validate.sh` passes.

## Mandatory validations

- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed — **expected: not
      run, because nothing should change**. If it *is* needed, that is a
      scope breach worth recording.)

## Risks and rollback

- **Installing into live client configs is the real hazard.** Both configs
  are in daily use. Back them up first, revert at the end, and verify the
  revert. Rollback for every step is "restore the backup".
- **Upstream leaves state behind that its own uninstaller does not
  remove** — ponytail's README lists several such paths. Enumerate them;
  do not assume `/plugin remove` is complete. This is a *finding*, not a
  cleanup failure.
- **A partial answer misrecorded as a full one is the failure that
  matters.** S7's TASK-0036 had five corrections to its own log, including
  a fabricated command output. Quote real output; if a step was skipped,
  say skipped.
- **`graphify install` may mutate this repo if run here.** Run it in a
  throwaway directory. `.graphify/` is not currently gitignored.
- **Do not install omniroute** to "complete the picture". It is a service
  with a daemon and an API key, explicitly out of scope.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `.ai/tasks/TASK-0048-*.md` | This log. **Q1, Q2, Q3 answered; Q4 answered by package inspection rather than by install**, stated as such. Every out-of-repo path listed; revert verified by md5 |
| `ADR-0021` | **Unchanged.** Its three falsifiable claims are marked below: **1 falsified (and then some), 2 refuted, 3 confirmed** |
| `.ai/context/CURRENT_STATE.md` | Records what the spike found, including the two vendor/plan claims it overturned |
| The machine | **Restored and verified** — `opencode.jsonc` md5 `36d0ed60…` and `settings.json` md5 `1db56080…` both identical to backups. **Zero residue**: no `~/.config/ponytail`, no `~/.claude/.ponytail-active`, no `~/.graphify`, no `~/.cache/opencode/node_modules`, no global npm install of either package |
| Components | **Unchanged**, as forecast. No manifest, no wiring snippet, no registry row |

**Next task starts here**: **`TASK-0049` does not simplify** — claim 3 is
confirmed, `graphify serve` exits 1 without a graph, so B-020's smoke-test
precondition problem is real and still needs deciding. **`TASK-0050` gains
scope**: both products are multi-surface, so `configs/opencode/README.md`
must describe more than one mechanism per product, and clause 2's
"rows are not exclusive" consequence is now triggered by *both*, not just
graphify.

**Deviations from the Plan — three, all recorded rather than smoothed:**

1. **Q1 needed no mutation of a live config and no `--platform` flag.** The
   CLI exposes a dedicated `graphify opencode install` subcommand whose own
   `--help` states the answer. Confirmed empirically in a throwaway git repo
   with `--project`.
2. **Q3's planned method could not answer it, and the control proves why.**
   Adding the plugin entry and starting OpenCode — the brief's step 4 — was
   run twice (`opencode serve`, then `opencode debug startup`), with the
   entry temporarily in the **live** `opencode.jsonc` and restored both
   times. Neither produced a single plugin log line **for ponytail or for
   the pre-existing `opencode-arcade-hub`**, and `~/.cache/opencode/node_modules`
   stayed absent. A known-good plugin logging nothing is the control that
   makes the silence uninformative, so the question was answered a different
   way — see Q3.
3. **Q4 was answered by reading the published package, not by installing
   into Claude Code.** Cheaper and lower-risk than a marketplace install,
   and sufficient for what `TASK-0050` needs. Marked as a package-level
   answer, not an observed-install one.

## Status

- Status: done
- Owner: agent
- Created: 2026-09-16
- Updated: 2026-09-22

## Execution log

### Attempt 1

- Date: 2026-09-22
- Agent: Claude Opus 5 (1M context)

#### Versions, recorded before anything was installed

| Thing | Observed 2026-09-22 | Brief expected |
|---|---|---|
| `opencode --version` | **1.18.31** | 1.18.31 ✓ |
| `claude --version` | **2.1.246 (Claude Code)** | 2.1.246 ✓ |
| `node` / `npm` | **v22.23.2** / 10.9.8 | ≥20 ✓ |
| `bun` | **absent from PATH** | not stated |
| `@dietrichgebert/ponytail` latest | **4.10.0** | 4.10.0 ✓ |
| `@sentropic/graphify` latest | **0.18.0** | not stated |

**One Inputs row had drifted.** The brief expected
`~/.claude/settings.json` to be `{"theme":"dark"}`. It actually carries six
keys (`model`, `modelSettings`, `theme`, `remoteControlAtStartup`,
`inputNeededNotifEnabled`, `agentPushNotifEnabled`). Backed up regardless;
noted because the brief's own instruction is to verify, not assume.

#### Q1 — graphify / OpenCode: **plugin, `AGENTS.md`, config *and* a skill — four surfaces**

The README-vs-source contradiction is settled **in favour of the source**,
by the vendor's own CLI help:

> `graphify opencode install` — *"Write graphify section to AGENTS.md +
> tool.execute.before plugin"*

Confirmed empirically in a throwaway git repo (`graphify opencode install
--project`, exit 0). Four things were written, not two:

```
  skill installed  ->  .opencode/skills/graphify/SKILL.md
Preview: graphify opencode install will touch:
  writes:
  - /tmp/t48-q1-project/AGENTS.md
  - /tmp/t48-q1-project/.opencode/plugins/graphify.js
  - /tmp/t48-q1-project/.opencode/opencode.json
  hooks/config:
  - .opencode/opencode.json: tool.execute.before graphify plugin
```

**The tool's own preview under-reports what it writes.** The skill
(`.opencode/skills/graphify/SKILL.md` plus `.graphify_version`) was written
*before* the preview printed and is **absent from the preview's `writes:`
list**. A reader trusting `printMutationPreview` would miss an installed
Agent Skill.

Two further observations, neither asked for:

- **The plugin is a `tool.execute.before` hook that prepends an `echo` to
  every `bash` command** once `.graphify/graph.json` exists. That is the
  same interception mechanism `ADR-0016` studied, observed live in a second
  product — independent corroboration that OpenCode interception works.
- **It merges; it does not clobber.** Run against a project that already had
  `.opencode/opencode.json` with a `$schema`, a populated `plugin` array and
  an `mcp` block, it **appended** to `plugin` and preserved `$schema` and
  `mcp` intact, and **appended** its section to a non-empty `AGENTS.md`. It
  does reformat the JSON, which will show as diff noise.
- The installed `SKILL.md` carries a non-spec `trigger: /graphify` frontmatter
  key alongside `name`/`description`. Harmless — OpenCode ignores unknown
  keys — but it is not in this repo's ADR-0003 schema.

#### Q2 — `graphify serve` with no graph: **exit 1**, verbatim

Run in an empty directory with no `.graphify/`:

```
EXIT CODE: 1
stdout: (empty)
stderr: error: Graph base directory does not exist: /tmp/t48-q2-emptydir/.graphify. Run the graphify skill first to build the graph (for Codex: $graphify .).
```

It created nothing. **The `serve.ts:188-195` reading in the brief and
`ADR-0021` is confirmed**, though the message is about the *base directory*
rather than the graph file. **B-020 stands**: `tests/smoke-mcp.sh` would call
this FAIL when the truth is an unmet precondition.

#### Q3 — ponytail from an npm `plugin` entry: **it resolves. The brief's concern is refuted**

The planned method failed to answer this either way, and **the control is
what proves the silence uninformative** — see deviation 2 above. Answered
instead at the level the risk actually lives:

- The published tarball **does ship** `package/.opencode/plugins/ponytail.mjs`
  — the file `main` and both `exports` point at. Dotfile directories inside a
  package tarball are not excluded.
- A real `npm install @dietrichgebert/ponytail@4.10.0` followed by a dynamic
  `import()` — which is what OpenCode's npm-plugin loading does — returned:

```
IMPORT OK. named exports: default
```

So **ponytail has a working OpenCode entry point.** Stated precisely: this is
**package-resolution evidence, not an observed in-client load**. The stronger
claim was not obtainable non-interactively and is not made.

#### Q4 — ponytail / Claude Code: answered from the package, not from an install

Ponytail is a **four-surface extension**, like graphify:

| Surface | Contents |
|---|---|
| OpenCode commands | `.opencode/command/*.md` — **6** (`ponytail`, `-audit`, `-debt`, `-gain`, `-help`, `-review`) |
| OpenCode plugins | `.opencode/plugins/ponytail.mjs`, `ponytail-frontmatter.cjs` |
| Agent Skills | `skills/*/SKILL.md` — **6**, frontmatter `name` + `description`, **schema-compatible with ADR-0003** |
| Client hooks | `hooks/{claude-codex,copilot,cursor,qoder}-hooks.json` + node scripts + a PowerShell statusline |

Its Claude Code hook shape, read from `hooks/copilot-hooks.json`:
`sessionStart` and `userPromptSubmitted`, each a `command` hook running
`node "${PLUGIN_ROOT}/hooks/…"` with `timeoutSec: 5`, with parallel `bash`
and `powershell` forms. It also ships `pi-extension/`, `.qoder/`,
`.qoder-plugin/` and its own `AGENTS.md`.

#### `ADR-0021`'s three falsifiable claims

| # | Verdict | What it means |
|---|---|---|
| 1 — graphify's OpenCode integration is a real plugin | **FALSIFIED, and further than the claim contemplated** | It is plugin **and** `AGENTS.md` **and** project config **and** an Agent Skill. Clause 2's "rows are not exclusive" consequence fires, and graphify occupies more than the two rows the claim imagined |
| 2 — ponytail does not load from an npm entry | **REFUTED** | It resolves and imports. Clause 6's honesty requirement is **not** triggered in the feared direction; there is a working surface to print |
| 3 — `graphify serve` starts without a graph | **CONFIRMED (i.e. it does not start)** | The smoke-test problem does **not** evaporate. `TASK-0049` does not simplify and B-020 stays real |

**Two of three went against the plan's expectations**, which is the outcome
the spike existed to produce.

#### Every out-of-repo path touched

| Path | What happened |
|---|---|
| `~/.config/opencode/opencode.jsonc` | **Modified twice**, ponytail added to the `plugin` array; **restored both times** via an `EXIT` trap. Final md5 `36d0ed608d1f806677a3d63cad75356e` = baseline |
| `~/.claude/settings.json` | **Read and backed up only. Never modified.** md5 `1db56080eb769d046d946ef9016a0403` = baseline |
| `~/.claude/plugins/` | **Untouched** — no marketplace install was performed |
| `/tmp/t48-*` (6 throwaway dirs) | Created and **deleted** |
| `~/.npm/_cacache` | Populated by `npx`/`npm install`, as any npm use does. Not reverted; this is npm's shared cache, not product state |
| `~/.cache/opencode/node_modules` | **Never created** — OpenCode never fetched either plugin |
| `~/.config/ponytail`, `~/.claude/.ponytail-active`, `~/.graphify` | **Never created** |

**Revert verified by comparison, not asserted**: `diff -q` against both
backups reported identical, and both md5s match the baseline recorded before
any change.

- Validation: `tests/validate.sh` → **OK**. `scripts/sync-registry.sh`
  **deliberately not run** — no component changed, which the brief names as
  the correct outcome. **No component file in this repo was touched**; the
  only repo files changed are this log and `CURRENT_STATE.md`, both forecast.
- Result: **done.** Q1, Q2, Q3 answered from observation; Q4 answered from
  the published package and labelled as such. All nine acceptance criteria
  met, with the Q3 criterion met by a different method than planned and the
  substitution recorded.
- Commit: `90db5a4` — "Run TASK-0048: both extensions are multi-surface; 2 of 3
  claims overturned". Pre-commit hook ran `tests/validate.sh` → OK.
- Push: **confirmed** to `origin`; branch in sync, remote token-free.
