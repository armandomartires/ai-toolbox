# ADR-0020 — The LM Studio client is Bionic; it has skills and is agentic

## Status
**Accepted — 2026-09-15.** Recorded by `TASK-0047`.

Accepted rather than proposed because this decision is **not a judgement
call**. It records two factual errors and their evidence. ADR-0006 wrote its
own reopening condition; that condition is met, quoted below. Nothing here
narrows a requirement or picks between defensible options, so there was
nothing for the human to ratify beyond the one modelling choice noted in
Decision 1.

**Supersedes ADR-0006 in part** — its client findings only. ADR-0006's
second half ("loops are authored here, not ported") is untouched and still
stands.

## Context

A human observed that `configs/lm-studio/` should be `lm-studio-bionic`:
"the Agent Oriented Workspace by LM Studio, not the classic LM Studio
LocalLLM desktop environment." The premise is correct, and checking it
surfaced that the rename is the smallest part of the problem. Two findings
this repo has relied on since 2026-09-13 are false.

### Bionic is a distinct product, and it is LM Studio's

`~/AppData/Local/Programs/Bionic/resources/app/package.json`, observed
2026-09-15:

```json
{ "name": "lm-studio", "productName": "Bionic",
  "desktopName": "ai.elementlabs.bionic", "version": "1.1.1+5",
  "author": { "name": "LM Studio <team@lmstudio.ai>" } }
```

Separate binary (`Bionic.exe`), separate Electron profile
(`AppData/Roaming/Bionic/`), separate update feed
(`bionic-updates.lmstudio.ai`, path `.../update/bionic/win32/x86/`),
separate bundle directory (`.webpack-bionic` vs classic's `.webpack`). Its
LM Studio lineage is equally provable: it loads `liblmstudio_bindings.node`,
its updater cache is `lm-studio-updater`, and it shares the `~/.lmstudio`
data root while namespacing its own state under `~/.lmstudio/apps/bionic/`.

**Classic LM Studio 0.4.24 is also still installed**, at
`C:\Program Files\LM Studio\LM Studio.exe`. The two are tracked separately in
`~/.lmstudio/.internal/historical-version-info.json`:
`targetHistories: [{"target": "lmstudio", "lastRecordedAppVersion": "0.4.24"}]`.

### Finding 1 is false: this client does have an Agent Skills target

ADR-0006 concluded the client "has **no Agent Skills target at all**",
resting on `~/.lmstudio/hub/skills/`. It also set its own reopening bar
(`ADR-0006:59-62`):

> "the evidence bar for reopening is its own documentation describing an
> Agent Skills directory, not an inference from a directory name."

That bar is met. Bionic ships the documentation itself, as a bundled skill at
`~/.lmstudio/.internal/skills/skill-management/SKILL.md:23-25`:

> "In Bionic, skills are folders that contain at least one `SKILL.md` file...
> All global skills are located in the `~/.lmstudio/skills` folder and are
> available to all projects. Project skills are located in each project's
> `.agents/skills` folder."

The same file documents the frontmatter schema — `name` (kebab-case, 1-63
chars), `description`, `display-name`, `disable-model-invocation`,
`user-invocable` — and the `skill.install` / `skill.list` /
`skill.uninstall` / `skill.setEnabled` tools. Five more bundled skills sit
beside it.

**The error was checking the wrong directory.** `hub/skills/` is a *hub
cache*; its siblings are `hub/models` and `hub/presets`. The actual target,
`~/.lmstudio/skills/`, exists and is empty.

This is worth stating precisely, because ADR-0006's *reasoning* was sound and
its *conclusion* was wrong. It refused to invent a deployment path into a
directory it could not verify — correct. It then treated one unverifiable
directory as proof of absence across the whole client. Absence of evidence in
`hub/skills/` was recorded as evidence of absence everywhere.

### Finding 2 is false: this client performs agentic work

`configs/lm-studio/README.md:31-32` claimed the client "**supplies models and
performs no agentic work**, so it has nothing an agent role would configure.
There is no directory to guess at." Bionic's main bundle contains subagent
identifiers:

```
lmstudio/exploration-subagent-v1
lmstudio/coder-yolo-subagents
lmstudio/coder-v0-yolo-subagents
```

with projects, per-session transcripts (`ng-sessions.sqlite`), a permissions
store, a `bionic_tool` dispatch mechanism, and a `bionic-skills-onboarding-v2`
UI-state flag. The claim is not stale; it is inverted.

### What is genuinely still absent

No **user-authored agent-role directory** was found, of the kind
`~/.claude/agents/` and `~/.config/opencode/agents/` are. Bionic's subagents
appear built-in and internally named. The distinction matters: the client is
agentic, but this repo has found no surface to emit agent roles *into*.

### Global skills cannot be written directly

`skill-management/SKILL.md:31`:

> "DO NOT edit global skills directly. If you need to install a new skill,
> you must prepare it in the scratchpad and then use the following tools to
> install it."

Global installs go through `skill.install`, which prompts the user for
approval — incompatible with `install.sh`'s non-interactive, idempotent
symlink-or-copy model. Project skills at `<project>/.agents/skills/` are
ordinary files and *are* directly writable.

### MCP config: one shared file, one dormant alternative

Only `~/.lmstudio/mcp.json` exists, holding the `ansible` entry. Bionic has
no `mcp.json` of its own and keeps no MCP state under
`~/.lmstudio/apps/bionic/.internal/`. Both binaries contain one `'mcp.json'`
literal and also a `ng-mcp.json` literal; the credential directories date
which is live — `credentials/ng-mcp-oauth` is empty and untouched since
2026-07-22, while `credentials/mcp-oauth` was written 2026-09-13 21:53:06,
the same second as `mcp.json`.

Bionic reading `mcp.json` is therefore a **strong inference, not a
verification**: no Bionic-side artifact records loading it
(`AppData/Roaming/Bionic/logs/main.log`, 240 lines, zero `mcp` mentions).

### The verification-attribution problem

`configs/lm-studio/README.md:12` and `:101-106` recorded a UI verification
(TASK-0017: server active in chat, tools enumerated by `qwen3.8 27b`,
2026-09-13). Classic LM Studio 0.4.24 is installed on the same machine and
was almost certainly its subject; Bionic 1.1.1 is named nowhere in that work.

Renaming the directory while leaving that row intact would silently
re-attribute a real pass to a client that may never have been tested —
manufacturing evidence by rename. REVIEW-0006:74 credits this repo
specifically for not doing that.

## Decision

**1. The LM Studio client this repo targets is Bionic.**
`configs/lm-studio/` becomes `configs/lm-studio-bionic/`. The two installed
apps are modelled as **one client entry**, named for Bionic — the human's
call (2026-09-15), on the grounds that Bionic is the agentic successor and
the only one of the two this repo has reason to target. The README names both
apps with versions and paths, so the collapse is visible and reopenable
rather than hidden.

**2. ADR-0006's client findings are superseded.** This client has an Agent
Skills target: `~/.lmstudio/skills/` (global) and
`<project>/.agents/skills/` (project). It performs agentic work. ADR-0006's
loops finding is unaffected.

**3. Skills stay undeployed — for a new and narrower reason.** Not "there is
no target" but "the global target is approval-gated and cannot be written
non-interactively" (`SKILL.md:31`). Project skills *are* writable, which
makes this a design question rather than an impossibility. Tracked as a
backlog item; deliberately not improvised inside a rename.

**4. Agent roles stay unemitted — also for a narrower reason.** Not "the
client does nothing agentic" but "no user-authored agent-role directory has
been found." ADR-0018's clause 6 excluded LM Studio "by ADR-0006's logic";
that logic is now falsified, so the exclusion is re-grounded on this
observation instead of inherited. The conclusion is unchanged; its basis is
not.

**5. Bionic's MCP support is documented as inferred, not verified.** The
2026-09-13 verifications are credited to **classic LM Studio 0.4.24**. Bionic
is marked unverified and a GUI check is added to the runbook as an open human
action. No verification is claimed for a client that has not been tested.

**6. Directory-name inference is not evidence — in either direction.**
ADR-0006 established this for concluding a capability exists. It applies
equally to concluding one is absent. A capability claim about a client needs
the vendor's own documentation or an observed artifact; a directory listing
is neither.

## Consequences

- `configs/lm-studio-bionic/README.md` replaces the old snapshot: Bionic
  identity and provenance, corrected skills paths, the subagent evidence,
  the approval-gate explanation, and the attribution split. Its two
  hard-won sections — the 10-vs-9 tool count and the `WORKSPACE_ROOT`
  placeholder defect — are kept unchanged; neither is client-specific.
- ADR-0006 is annotated as superseded in part, not rewritten. It remains a
  dated record of what was known on 2026-09-13.
- ADR-0018 clause 6 gets a pointer here; its conclusion stands on new
  grounds.
- `AGENTS.md`, `docs/operations/runbook.md`, and
  `docs/development/authoring-guide.md` drop the "MCP-only" and
  "non-agentic" assertions.
- `scripts/install.sh` is **unchanged behaviourally** — `CLIENTS` untouched,
  comment corrected. Bionic remains exempt from the config-pairing check in
  `tests/validate.sh:476-482` while absent from that list, and keeps a
  snapshot anyway.
- A backlog item covers deploying project skills to Bionic
  (`.agents/skills/`), including whether approval-gated global installs
  belong in a non-interactive installer at all.
- Open human action: verify the ansible server inside Bionic's UI. Until
  then the client's MCP status stays *inferred*.
- **Risk accepted:** Bionic is on a fast-moving line (1.0.1 → 1.1.1+5
  between 2026-07-22 and 2026-09-15). Every observation here is
  version-stamped, and the paths may move. The mitigation is the stamp, not
  a promise of stability.
- **Cost worth naming:** these errors survived four tasks (0006, 0007, 0016,
  0017) and two reviews, and were caught by a human noticing a product name
  — not by any check. No gate in this repo tests a claim about a third-party
  client's capabilities, and none realistically can. The defence is that
  such claims cite vendor documentation or a version-stamped observation, so
  the next reader can re-check them cheaply.
