# ADR-0017 — ai-toolbox owns the agent-tiers skill

## Status
**Proposed — and BLOCKED. Do not accept as drafted.** Opened by `PLAN-0004`
(sprint S7), 2026-09-15.

> **⚠ TASK-0034 disproved this ADR's central premise (2026-09-15).**
>
> This ADR asserts that `agent-tiers` was **orphaned** by ADR-0004 and is
> therefore this repo's to claim. **It was not.** `opencode-customization`
> **deliberately kept it** by explicit user decision on 2026-09-13, in
> commit `9bae137`:
>
> *"`agent-tiers` is deliberately kept in this repo (user decision) —
> confirmed OpenCode-specific by design (`docs/07.agent-hierarchy.md`'s own
> scope banner), a separate concern from `project-workflow`'s removal."*
>
> Corroborated by that repo's `.ai/30.ROADMAP.md:45` (*"`agent-tiers` stays,
> confirmed OpenCode-specific"*) and by a written, **unpulled reopen
> trigger** at `:240` — *"Revisit `agent-tiers` → `ai-toolbox` if a concrete
> reason emerges (not scheduled)."*
>
> That is a **deferral with a reason and a reopen trigger**, which is
> precisely what the Context below claims it lacks. The error was acting on
> ADR-0004's four-day-old *quotation* of that repo's **older** roadmap
> without re-reading the source after `S027` actually executed.
>
> **The "Established" section below is therefore partly false**, and is left
> in place rather than rewritten so the correction is visible (ADR-0019's
> precedent). Read it only alongside TASK-0034's execution log, which
> carries the measured drift facts and three options with a recommendation
> (**option 3**: bring the four *role definitions* into `agents/` under
> ADR-0018 and leave the PowerShell installer where it was deliberately
> kept).
>
> **Accepting, rejecting, or rescoping this ADR is a human decision**, and
> `TASK-0035` must not start until it is made. An agent cannot invoke
> another repo's reopen trigger on its own authority.

**TASK-0034 is done**, so the drift question this ADR waited on is answered:
**two** files differ, the **repo copy is newer for both**, consistently,
from that one commit, and the **installed copy carries no unique fix** — so
no content would be lost whichever side were preferred. All four distinct
model IDs in `models.jsonc` still resolve against a live 2026-09-15
listing. The blocker is not the drift; it is the ownership premise.

## Context

To be completed after TASK-0034. What is already established by reading,
and what is not:

### Established
- **This is ADR-0004's unfinished half.** That ADR's own Context quotes
  `opencode-customization`'s roadmap: *"`S027` hands `project-workflow`
  (and `agent-tiers`) to `ai-toolbox` permanently, retiring
  `opencode-customization`'s copy."* The parenthesis was in the source.
  ADR-0004 executed the handover for `project-workflow` alone and said
  nothing about the second skill, so `agent-tiers` was orphaned — not
  decided against, and with no reopen trigger of the kind ADR-0010 carries.
- **The version-integrity defect has recurred.** `diff -rq` between
  `~/.config/opencode/skills/agent-tiers/` and
  `~/AI_Workspaces/opencode-customization/opencode/skills/agent-tiers/`
  reports two differing files — `SKILL.md` and
  `templates/bmad/docs/stories/README.md` — while **both trees declare
  `metadata.version: "1.0.0"`**. ADR-0004 was written because three copies
  of `project-workflow` all claimed `2.1.0` while differing in content.
  Same defect, second skill.
- **The installed copy is a real directory, not a symlink.**
  `project-migration` and `project-workflow` are symlinks into this repo in
  both `~/.config/opencode/skills/` and `~/.claude/skills/`.
  `agent-tiers` is a real directory. `install.sh:100-103` handles this
  deliberately — it announces a `NOTICE` and `rm -rf`s the directory before
  linking, because `ln -sfn` against a real directory silently creates the
  link *inside* it and reports success. So importing the skill **destroys
  the installed copy by design**, which is only safe once TASK-0034 has
  established that nothing unique lives there.
- **The topology has never been applied.** The live
  `~/.config/opencode/opencode.jsonc` (20 KB, with `mcp`, `provider`,
  `plugin` and `shell` keys) contains **no `agent` key**. Every permission
  boundary the skill exists to install — `qa-test` editing test files only,
  `review` read-only, `git-ops` unable to force-push — has never been in
  effect. The skill is unexercised scaffolding in the sense
  `CURRENT_STATE.md` uses for `mcp-servers/_template/`.
- **The skill has real substance worth preserving**, which is why this is a
  reclamation rather than a rewrite: a deterministic idempotent installer
  (`install-tiers.ps1`), a tier→model mapping whose every ID was verified
  against a live `opencode models` listing with the deviations commented
  (`models.jsonc` — `git-ops` deliberately not on the cheapest tier), four
  role definitions with permission-enforced boundaries, and a documented
  reason why `plan`/`build` must be inline config overrides rather than
  markdown files (a markdown agent body *replaces* an OpenCode built-in's
  tuned system prompt wholesale rather than extending it).
- **`opencode-customization` is a live repo**, currently at `f9f5e37`, whose
  own recent commits show it closing sprints against `ai-toolbox`'s
  bootstrap (`5d313ae` — "Close S028 as moot: ai-toolbox already
  bootstrapped itself"). It is not abandoned, so a handover is a real
  cross-repo event rather than salvage.

### Not established — TASK-0034's job
- **What the two files differ in**, and which side is newer. Until then
  "resolve the drift" has no content.
- Whether `install-tiers.ps1` or `models.jsonc` differ in ways `diff -rq`
  reported as identical but which matter semantically (they were reported
  identical; that is a fact about bytes, and enough).
- Whether the model IDs in `models.jsonc` still resolve. They were verified
  against a live listing on 2026-08-19, which is **four weeks stale**, and
  the file's own header requires every ID to resolve before commit.

## Decision

To be written after TASK-0034 reports. **Expected: this repo takes
ownership**, mirroring ADR-0004 clause for clause.

If that is the outcome, the decision should state:

1. `skills/agent-tiers/` in this repo becomes canonical, and the skill is
   made **self-contained** — every mechanism it describes specified in its
   own files, with no dangling citation to `opencode-customization`'s ADR
   numbers. ADR-0004 had to do exactly this for `project-workflow`, which
   cited that repo's private ADRs 0005/0006/0017; `agent-tiers`' `SKILL.md`
   must be checked for the same class of reference, and
   `.ai/decisions/0001-agent-tier-model-assignment.md` in that repo is a
   known candidate.
2. `metadata.version` is bumped the moment content changes, so `"1.0.0"`
   stops meaning two different things (ADR-0003's semver rule).
3. **`opencode-customization`'s retirement of its own copy is explicitly
   out of scope**, exactly as ADR-0004 scoped it. That repo has its own
   governance layer and needs its own task; this ADR does not reach across
   a repo boundary to edit it. The gap is left real and acknowledged rather
   than silently fixed.
4. The relationship to `project-workflow` is documented in the skill
   itself, since the existing `SKILL.md` already has a "Relationship to
   other skills in this repo" section written from the *other* repo's
   perspective — it will be wrong the moment the skill moves.
5. **Switching the topology on is a separate act from owning the skill**,
   and is out of scope here. Applying an `agent` block to the live global
   `opencode.jsonc` changes machine configuration and needs its own task
   and its own authorization.

If TASK-0034 finds the installed copy carries a fix absent upstream, the
decision must say which change survived and why, rather than resolving to
"repo wins" by default — the copy this repo is about to delete is a real
source of truth for whatever it uniquely contains.

## Consequences

To be written. Expected:

- **This repo gains a third skill and the drift stops**, because the
  installed copy becomes a symlink and there is then one editable location
  rather than two diverging ones.
- **`opencode-customization` is left with a stale copy and no task to
  retire it** — a real, acknowledged gap, identical to the one ADR-0004
  created and for the same reason. It should be flagged to that repo rather
  than assumed to be someone's follow-up.
- **A four-week-old model verification becomes this repo's problem.**
  `models.jsonc` requires every ID to resolve against a live
  `opencode models` listing before commit. Inheriting the file inherits
  that obligation, and the IDs are all behind the `perplexity-agent` proxy,
  which is provider state this repo has never had to track.
- **The unapplied topology becomes visible as a gap rather than invisible
  as an absence.** Once the skill is in `docs/registry.md` as a deployable
  component, the fact that its topology has never been installed is a
  recorded limitation with a name — which is the ADR-0010 treatment, and
  the honest one.
- **This ADR does not make the skill correct**, only owned. Its role
  definitions are reconciled into `agents/` by TASK-0045 under ADR-0018's
  contract, and nothing here asserts that its four roles are the right
  four or that its permission boundaries are sufficient.
