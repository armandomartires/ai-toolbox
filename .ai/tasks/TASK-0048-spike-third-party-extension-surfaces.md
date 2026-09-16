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

*Intended* end state — this task has not run, so the rows below describe an
intention, not a state.

| Artifact | End state |
|----------|-----------|
| `.ai/tasks/TASK-0048-*.md` | Execution log carrying Q1–Q3 (and Q4 if reached), each answer version-stamped and dated; every out-of-repo path listed; the revert verified |
| `ADR-0021` | Unchanged by this task, but its three falsifiable claims each marked confirmed / corrected / untested in **this** log, ready for a human to ratify or reject |
| `.ai/context/CURRENT_STATE.md` | A paragraph recording what the spike found, including any vendor claim it falsified |
| The machine | Restored to its pre-task state, verified against backups; any upstream leftover that could not be removed is named |
| Components | **Deliberately unchanged.** No manifest, no wiring snippet, no registry row |

**Next task starts here**: `TASK-0049` picks up from a recorded answer to
Q2 — whether `graphify serve` can be smoke-tested at all — and `TASK-0050`
from the answers to Q1, Q3 and Q4. Record any deviation from this plan
here; both downstream tasks were scoped against it.

## Status

- Status: planned
- Owner: agent
- Created: 2026-09-16
- Updated: 2026-09-16

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
