# TASK-0047 — The LM Studio client is Bionic; correct the skills and agents findings

## Objective
Rename `configs/lm-studio/` to `configs/lm-studio-bionic/` and rewrite its
wiring snapshot to describe **Bionic**, LM Studio's agent-oriented
workspace, rather than the classic LM Studio local-LLM desktop app. Record
the resulting correction to ADR-0006 as a new ADR: Bionic **does** have an
Agent Skills target and **does** perform agentic work, so two findings this
repo has relied on since 2026-09-13 are false.

## Minimal context

A human observed that `configs/lm-studio` should be `lm-studio-bionic` —
"the Agent Oriented Workspace by LM Studio, not the classic LM Studio
LocalLLM desktop environment". Investigation confirmed the premise and
found that the rename is the *smallest* part of the change.

### Bionic is a distinct product, and it is LM Studio's

`~/AppData/Local/Programs/Bionic/resources/app/package.json`:

```json
{ "name": "lm-studio", "productName": "Bionic",
  "desktopName": "ai.elementlabs.bionic", "version": "1.1.1+5",
  "author": { "name": "LM Studio <team@lmstudio.ai>" } }
```

Separate binary (`Bionic.exe`, 225 MB), separate `AppData/Roaming/Bionic`,
separate update feed (`bionic-updates.lmstudio.ai`,
`versions-prod.lmstudio.ai/update/bionic/...`), separate webpack bundle
(`.webpack-bionic` vs classic's `.webpack`). It is provably LM Studio's
lineage: it loads `liblmstudio_bindings.node`, its updater cache is
`lm-studio-updater`, and it shares the `~/.lmstudio` data root while
namespacing its own state under `~/.lmstudio/apps/bionic/`.

### Classic LM Studio is *also* still installed

`C:\Program Files\LM Studio\LM Studio.exe`, version **0.4.24** per
`~/.lmstudio/.internal/historical-version-info.json`
(`targetHistories: [{target: "lmstudio", lastRecordedAppVersion: "0.4.24"}]`).
The two coexist; this is not one app renamed.

**The human chose to model them as one client** (one `configs/` entry,
renamed). That is defensible — Bionic is the agentic successor and the only
one of the two this repo has any reason to target — but it forces an
honesty problem, handled below under *the verification record*.

### ADR-0006's central finding is false, by its own evidence bar

ADR-0006 (`:59-62`) set the bar for reopening itself: *"the evidence bar for
reopening is its own documentation describing an Agent Skills directory, not
an inference from a directory name."*

Bionic ships exactly that documentation.
`~/.lmstudio/.internal/skills/skill-management/SKILL.md:23-25`:

> "In Bionic, skills are folders that contain at least one `SKILL.md`
> file... All global skills are located in the `~/.lmstudio/skills` folder
> and are available to all projects. Project skills are located in each
> project's `.agents/skills` folder."

The same file documents a full frontmatter schema (`name` kebab-case 1-63
chars, `description`, `display-name`, `disable-model-invocation`,
`user-invocable`) and the `skill.install` / `skill.list` /
`skill.uninstall` / `skill.setEnabled` tools. Five more bundled skills sit
beside it.

**The repo checked the wrong directory.** `configs/lm-studio/README.md:17`
rests its whole conclusion on `~/.lmstudio/hub/skills/`. That is a *hub
cache* — its siblings are `hub/models` and `hub/presets`. The real target,
`~/.lmstudio/skills/`, exists and is empty. ADR-0006 was right to refuse to
guess a path; it simply guessed at the wrong one.

### Bionic performs agentic work

`configs/lm-studio/README.md:31-32` claims LM Studio "**supplies models and
performs no agentic work**, so it has nothing an agent role would
configure." Bionic's main bundle contains subagent identifiers:

```
lmstudio/exploration-subagent-v1
lmstudio/coder-yolo-subagents
lmstudio/coder-v0-yolo-subagents
```

plus projects, per-session transcripts (`ng-sessions.sqlite`), a
permissions store, `bionic_tool` dispatch, and a `bionic-skills-onboarding-v2`
UI-state flag. The claim is not merely outdated; it is the opposite of true.

### Global skills are documented as *not* directly writable

This is why the rename does **not** come with an `install.sh` change.
`skill-management/SKILL.md:31`: *"DO NOT edit global skills directly. If you
need to install a new skill, you must prepare it in the scratchpad and then
use the following tools to install it."* Global installs go through
`skill.install`, which prompts the user for approval — incompatible with
`install.sh`'s symlink/copy model. Project skills at
`<project>/.agents/skills/` *are* ordinary files and directly writable.
Wiring that up is a design decision, deferred to a backlog item.

### MCP: one shared config, and an unused next-gen path

Only one MCP config exists: `~/.lmstudio/mcp.json`, currently holding the
`ansible` entry with a real `WORKSPACE_ROOT`. Bionic keeps no MCP state
under `apps/bionic/.internal/` and has no `mcp.json` of its own.

Both binaries contain exactly one `'mcp.json'` string literal **and** a
`ng-mcp.json` literal. The timestamps settle which is live:
`credentials/ng-mcp-oauth` is empty and untouched since 2026-07-22, while
`credentials/mcp-oauth` was written **2026-09-13 21:53:06**, the same second
as `mcp.json` itself. So `mcp.json` is the path in use and `ng-mcp.json` is
dormant on this machine.

That makes Bionic reading `mcp.json` a **strong inference, not a
verification**: no Bionic-side artifact records having loaded it
(`AppData/Roaming/Bionic/logs/main.log` contains zero `mcp` mentions across
240 lines). Documented as an inference, with a GUI check left as a human
action.

### The verification record

`configs/lm-studio/README.md:12` and `:101-106` record a UI verification
from TASK-0017 — server active in chat, tools enumerated by `qwen3.8 27b`,
2026-09-13. Classic LM Studio 0.4.24 is installed and was almost certainly
its subject; Bionic 1.1.1 was not named anywhere in that work.

Renaming the directory while leaving that row intact would silently
re-attribute the pass to Bionic — inventing evidence for a client that may
never have been tested. REVIEW-0006:74 credits this repo specifically for
not doing that. **Decision (human, 2026-09-15): attribute the pass to
classic 0.4.24 and mark Bionic unverified**, with a dated Bionic UI check
added to the runbook as an open human action.

### The rename is mechanically free

`lm-studio` is nowhere a machine-readable identifier. `tests/validate.sh:476-482`
derives its client list from `scripts/install.sh`'s `CLIENTS` block, from
which lm-studio is deliberately absent (ADR-0006); `tests/validate.sh:274`
hardcodes `CLIENTS = {"claude-code", "opencode"}` for agent frontmatter; no
`mcp-servers/*/server.json` and no line of `docs/registry.md` mentions it.
Renaming the directory breaks no gate.

## Inputs
| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `configs/lm-studio/README.md` | TASK-0006, TASK-0007, TASK-0016, TASK-0017, TASK-0026 | 153 lines; `hub/skills` claim at `:17`; models-only claim at `:31-32`; UI pass at `:101-106` |
| `.ai/decisions/0006-lm-studio-is-mcp-only.md` | TASK-0008 | Accepted; two findings about to be superseded; loops half unaffected |
| `.ai/decisions/0018-agent-portability-one-source-per-client-emission.md` | TASK-0036 | Accepted; `:265` excludes LM Studio from agents on now-falsified premises |
| `scripts/install.sh` | TASK-0005, TASK-0040 | `CLIENTS` = claude-code, opencode; lm-studio rationale comment at `:54-56` |
| `tests/validate.sh` | TASK-0011 onward | Passing; config-pairing check at `:476-482` |
| `docs/operations/runbook.md` | TASK-0016 | Client table at `:105`; LM Studio UI procedure at `:143-202` |
| `docs/development/authoring-guide.md` | TASK-0036 | Agent-capability statement at `:108` |
| `AGENTS.md` | pre-existing | MCP-only claim in Objective at `:8` |
| Bionic 1.1.1+5 install | external | `Programs/Bionic/`, `AppData/Roaming/Bionic/`, `~/.lmstudio/apps/bionic/` |
| Classic LM Studio 0.4.24 | external | `C:\Program Files\LM Studio\` |

## Scope

### Included
- `git mv configs/lm-studio configs/lm-studio-bionic`.
- Rewrite that README: Bionic identity and provenance; correct skills paths
  (`~/.lmstudio/skills/` global, `.agents/skills/` project); delete the
  false models-only/no-agentic-work claim; rewrite the Agents section;
  attribute the UI pass to classic 0.4.24 and mark Bionic unverified;
  record the `mcp.json` vs `ng-mcp.json` finding.
- **Keep `:108-125` (10-vs-9 tool count) and `:127-153` (WORKSPACE_ROOT
  placeholder defect) unchanged** — neither is client-specific, and both
  exist to stop a future reader "correcting" something already right.
- New ADR superseding ADR-0006's *client* findings; mark ADR-0006
  superseded; note ADR-0018's affected line.
- Update `AGENTS.md`, `docs/operations/runbook.md`,
  `docs/development/authoring-guide.md`, and `scripts/install.sh`'s comment.
- Backlog entry for wiring Bionic into `install.sh`.

### Not included
- Any behavioural change to `scripts/install.sh` or `tests/validate.sh` —
  comment text only. Adding Bionic as a deploy target needs its own brief,
  because the global-skills path is approval-gated and only project skills
  can be written directly.
- Editing dated `.ai/` history (sessions, reviews, prior tasks, sprints).
  Those are records of what was known then, not current claims.
- Verifying Bionic's MCP support in its GUI. Needs a human; documented as
  an inference and added to the runbook.
- Touching the live `~/.lmstudio/mcp.json` or anything outside this repo.
- Retiring `configs/` coverage of classic LM Studio 0.4.24 as a separate
  client. The human chose the one-client model; the README names the split
  so a future reader can reopen it.

## Likely files
- `configs/lm-studio/README.md` → `configs/lm-studio-bionic/README.md`
- `.ai/decisions/0020-the-lm-studio-client-is-bionic.md` (new)
- `.ai/decisions/0006-lm-studio-is-mcp-only.md` (status + pointer)
- `.ai/decisions/0018-agent-portability-one-source-per-client-emission.md` (note at `:265`)
- `AGENTS.md`, `docs/operations/runbook.md`, `docs/development/authoring-guide.md`
- `scripts/install.sh` (comment only)
- `.ai/planning/BACKLOG.md`, `.ai/tasks/TODO.md`, `.ai/context/CURRENT_STATE.md`

## Execution plan
1. `git mv configs/lm-studio configs/lm-studio-bionic`.
2. Rewrite the README per Scope, preserving `:108-153` verbatim.
3. Write ADR-0020; mark ADR-0006 superseded; annotate ADR-0018.
4. Update `AGENTS.md:8`, `authoring-guide.md:108`, `install.sh:54-56`.
5. Update `runbook.md`: client table row, retitle the UI procedure for
   Bionic, add the open Bionic MCP check with its unverified status.
6. Add the backlog item; tick this task in `TODO.md`; update
   `CURRENT_STATE.md`.
7. `tests/validate.sh`; `scripts/sync-registry.sh`; confirm the registry is
   unchanged (no component changed) or commit the regeneration.
8. Review the diff, commit, push, record hash and push result below.

## Acceptance criteria
- [x] `configs/lm-studio-bionic/README.md` exists; `configs/lm-studio/` gone.
- [x] Rename recorded by git as a rename, history preserved. **Met with a
      caveat, recorded rather than glossed:** the rewrite changed 228 of 261
      lines, so similarity is **31%** — below git's 50% default. `git mv`
      staged it as a rename and `git diff -M30%` confirms
      `rename configs/{lm-studio => lm-studio-bionic}/README.md (31%)`, but
      **`git log --follow` will not traverse it at default settings.** Use
      `git log --follow -M30%` or `git log -- configs/lm-studio/README.md`
      to reach the pre-rename history (last commit touching it: `36cab90`).
      This was foreseeable and is the cost of doing the rename and the
      rewrite in one commit; splitting them into two would have preserved
      `--follow` at the price of an intermediate commit asserting things the
      repo had already disproved.
- [x] README names Bionic 1.1.1+5 with `package.json` provenance and states
      that classic LM Studio 0.4.24 coexists.
- [x] The `hub/skills` claim is replaced by `~/.lmstudio/skills/` (global)
      and `<project>/.agents/skills/` (project), each cited to the vendor
      `SKILL.md`.
- [x] The "supplies models and performs no agentic work" claim is gone,
      replaced by the subagent evidence.
- [x] README explains why global skills cannot be symlinked
      (`SKILL.md:31`) and that project skills can.
- [x] The TASK-0017 UI pass is attributed to classic 0.4.24; Bionic is
      marked unverified. No verification is claimed for Bionic.
- [x] `:108-125` and `:127-153` survive byte-identical apart from any
      client renaming inside them. Verified by diffing the old tail against
      the new: **one** hunk, "LM Studio is a Windows app" → "this is a
      Windows app", which is the permitted renaming.
- [x] ADR-0020 exists; ADR-0006 is marked superseded **for its client
      findings only**, with its loops finding explicitly still standing.
- [x] `AGENTS.md`, runbook, and authoring guide no longer assert LM Studio
      is MCP-only or non-agentic.
- [x] `install.sh` behaviour unchanged (`CLIENTS` block untouched); only
      its comment updated, and it points at the new path. Verified by
      diffing for `CLIENTS`/client-row changes: none.
- [x] No stale `configs/lm-studio/` reference remains outside dated `.ai/`
      history and deliberate citations of the old path in ADR-0020 and this
      file.
- [x] Backlog item exists for the `install.sh` integration — **B-018**
      (B-014 was already taken; the `install.sh` comment was corrected to
      match after an initial wrong ID).

## Mandatory validations
- [x] `tests/validate.sh` — `validate.sh: OK`
- [x] `scripts/sync-registry.sh` — ran; `docs/registry.md` **unchanged**, as
      predicted (no component was added, removed or renamed; `configs/` is
      not a registry section)
- [x] `grep -rn "configs/lm-studio[^-]" --include='*.md' --include='*.sh' .`
      returns only dated `.ai/` history plus intentional citations
- [x] ~~`git log --follow`~~ — **does not work at default settings**; see the
      rename criterion above. `git log --follow -M30%` does.

## Risks and rollback
- **Risk: re-attributing a verification.** Mitigated by the explicit
  attribution decision above — the pass stays credited to classic 0.4.24.
- **Risk: the one-client model hides that two apps are installed.**
  Mitigated by naming both in the README, with versions and paths.
- **Risk: documenting Bionic's MCP support as proven.** Mitigated by
  labelling it an inference and stating what would prove it.
- **Risk: the observed skills paths are machine-specific.** They come from
  the vendor's own bundled `SKILL.md`, not from directory-name inference —
  the failure mode ADR-0006 fell into. `SKILL.md:23` itself notes a rare
  legacy location (`~/.cache/lm-studio/skills`), which the README records.
- **Risk: Bionic's layout changes.** Version-stamp every observation.
- Rollback: single commit, `git revert`.

## Outputs / handover
| Artifact | End state |
|----------|-----------|
| `configs/lm-studio-bionic/README.md` | 261 lines. Bionic 1.1.1+5 identity with `package.json` provenance; classic 0.4.24 named as coexisting; corrected skills paths; subagent evidence; approval-gate explanation; MCP status split by app with Bionic **inferred, not verified**; `ng-mcp.json` dormancy recorded. Tool-count and `WORKSPACE_ROOT` sections **preserved** |
| `.ai/decisions/0020-the-lm-studio-client-is-bionic.md` | New, accepted. Supersedes ADR-0006's client findings only. Six numbered decisions, incl. the generalisation that directory-name inference is not evidence *in either direction* |
| `.ai/decisions/0006-lm-studio-is-mcp-only.md` | Annotated `Superseded in part`; body untouched as a dated record. Loops finding explicitly still standing |
| `.ai/decisions/0018-*.md` | Clause 6 re-grounded: same conclusion (no agent emission to this client), new basis (no user-authored role directory found, not "client is inert") |
| `AGENTS.md` | Objective names Bionic and ADR-0020; states the skills target exists but is approval-gated |
| `docs/operations/runbook.md` | UI procedure retitled for both apps; per-app status table; **Bionic check is an open human action**; step 1 warns about `ng-mcp.json`; step 6 requires naming app + version |
| `docs/development/authoring-guide.md` | Agent-capability statement re-grounded |
| `scripts/install.sh` | **Comment only.** `CLIENTS` untouched — Bionic is still not a deploy target |
| `.ai/planning/BACKLOG.md` | B-018 raised; **B-005's stated reason retracted** (its action stands); open count 7 → 8 |
| `.ai/tasks/TODO.md` | This task ticked. Also **flags TASK-0046's unticked box** — `done` since 2026-09-15 with a recorded commit — left unticked deliberately, as correcting it belongs to a commit about the pilot |
| `.ai/context/CURRENT_STATE.md` | New section on the client correction; the "all three clients verified" claim amended in place to name classic 0.4.24 as the verified one |
| `docs/registry.md` | **Deliberately unchanged.** Regenerated and byte-identical |
| `tests/validate.sh`, `mcp-servers/`, `skills/` | **Deliberately unchanged.** No behavioural change in this task |

**Next task starts here**: `configs/` names Bionic correctly and ADR-0020 has
corrected the record, but **nothing is deployed to Bionic and its MCP support
is unverified**. Two concrete follow-ups, neither started: **B-018** (deploy
project skills to `<project>/.agents/skills/`; needs a decision about whether
a per-project target belongs in a global installer) and the **Bionic UI
check** in `docs/operations/runbook.md`, which is a human action.

Deviations from the Plan, for a reader who scoped against it:
1. **Numbering.** The plan said TASK-0046/ADR-0019; both were taken (S7's
   pilot and the design-convergence ADR). Used **TASK-0047 / ADR-0020**.
2. **Backlog ID.** Planned "a backlog entry"; B-014 was taken, so **B-018**.
   The `install.sh` comment initially cited B-014 and was corrected.
3. **Scope grew by two files** not in *Likely files*: `.ai/planning/BACKLOG.md`'s
   B-005 row and summary paragraph. Found while adding B-018 — B-005 had
   closed on the exact premise ADR-0020 falsifies. Annotating it was
   in-scope for honesty; leaving it would have kept a false reason in a
   current planning doc.
4. **`git log --follow` does not traverse the rename** (31% similarity). Not
   anticipated; recorded in the criteria rather than worked around.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-15
- Updated: 2026-09-15

## Execution log
### Attempt 1
- Date: 2026-09-15
- Agent: opencode
- Actions:
  1. Investigated the human's premise before planning. Confirmed Bionic is a
     distinct app (`package.json`: `productName: "Bionic"`, `version:
     "1.1.1+5"`, `author: LM Studio`), with its own binary, Electron profile,
     update feed and webpack bundle, sharing `~/.lmstudio` and namespacing
     state under `~/.lmstudio/apps/bionic/`.
  2. Found **classic LM Studio 0.4.24 also installed**
     (`historical-version-info.json` → `targetHistories[target=lmstudio]`),
     which forced the verification-attribution question.
  3. Found Bionic's bundled `skill-management/SKILL.md` documenting the real
     skills paths — clearing ADR-0006's own reopening bar — and the
     `hub/skills` error.
  4. Found subagent identifiers in the main bundle, falsifying the
     "no agentic work" claim.
  5. Established the MCP picture: one `~/.lmstudio/mcp.json`; both binaries
     carry a dormant `ng-mcp.json` literal; credential-directory timestamps
     (`ng-mcp-oauth` empty since 2026-07-22 vs `mcp-oauth` written
     2026-09-13 21:53:06, same second as `mcp.json`) show which is live.
  6. Asked the human four questions before editing: one/two clients, task
     scope, MCP verification, and how to handle the existing detail.
  7. Wrote this brief (Goal + Plan) **before** any edit, then executed:
     `git mv`, README rewrite, ADR-0020, ADR-0006/0018 annotations, four
     normative-doc updates, B-018, TODO, CURRENT_STATE.
- Observations:
  - **The rename was the smallest part.** Two load-bearing findings were
    false, and both had propagated into ADRs, docs and an installer comment.
  - **ADR-0006 saved itself.** Its explicit reopening condition (`:59-62`)
    is why this was a checkable correction and not an argument. An ADR that
    writes down what would falsify it is worth more than one that does not.
  - **The error was one step short of a good instinct.** ADR-0006 correctly
    refused to invent a path into an unverifiable directory, then treated
    that single directory as proof of absence for the whole client. ADR-0020
    generalises: directory-name inference is not evidence *in either
    direction*.
  - **No gate could have caught this.** It survived four tasks and two
    reviews. `validate.sh` passed before and after, because nothing here is
    a structural claim. Caught by a human reading a product name.
  - `git log --follow` broke on a 31%-similarity rename — a real, if minor,
    cost of combining rename and rewrite.
  - Found TASK-0046's TODO box unticked despite the task being `done`; left
    it for a pilot-scoped commit rather than bundling an unrelated fix.
- Validation:
  - `bash tests/validate.sh` → `validate.sh: OK`
  - `bash scripts/sync-registry.sh` → `docs/registry.md` unchanged
  - `git diff --cached scripts/install.sh` → comment-only; `CLIENTS` intact
  - Old-tail vs new-tail diff → preserved sections intact but for the one
    permitted client renaming
  - `git diff -M30%` → rename detected at 31%
  - Stale-reference grep → only dated `.ai/` history and deliberate citations
- Result: **done.** Both false findings corrected and recorded; no
  verification invented for Bionic; no behavioural change shipped.
- Commit: 1cba79b
- Push: confirmed — `origin/master` at `1cba79b`, `git status` clean and
  `master...origin/master` in sync. Pushed with a per-command basic-auth
  header per `docs/operations/runbook.md`; `git remote -v` remains
  token-free.
