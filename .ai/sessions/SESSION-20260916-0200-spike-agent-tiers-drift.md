# SESSION-20260916-0200 — Execute TASK-0034 (agent-tiers drift spike)

- Date: 2026-09-15
- Agent: opencode (claude-opus-5)
- Objective: Establish what ADR-0017 cannot be written without — which side
  of each differing `agent-tiers` file is newer, and why.
- Entry state: clean tree at `1d33a7f`. Phase 2 complete. TASK-0034 was the
  last open Phase-1 spike; ADR-0017 proposed and blocked on it.

## Headline: the spike disproved its own premise

The drift question is fully answered, but the **more consequential output is
a blocking finding about ownership**.

**`agent-tiers` is not unowned.** `opencode-customization` kept it
deliberately by explicit user decision on 2026-09-13, commit `9bae137`:

> *"`agent-tiers` is deliberately kept in this repo (user decision) —
> confirmed OpenCode-specific by design (`docs/07.agent-hierarchy.md`'s own
> scope banner), a separate concern from `project-workflow`'s removal."*

Corroborated by that repo's `.ai/30.ROADMAP.md:45` and by a written,
**unpulled reopen trigger** at `:240` — *"Revisit `agent-tiers` →
`ai-toolbox` if a concrete reason emerges (not scheduled)."*

That is a **deferral with a reason and a reopen trigger** — exactly what
this repo's lesson 9 says an orphan lacks. S7 planned from ADR-0004's
quotation of that repo's **older** roadmap and never re-read the source
after `S027` actually executed four days later.

**Consequences:** ADR-0017 must not be accepted as drafted; TASK-0035's
justification is gone (importing would create the second copy ADR-0004
exists to prevent, *against* another repo's recorded decision). Three
options with a recommendation are in the task log — **option 3**: bring the
four *role definitions* into `agents/` under ADR-0018, leave the PowerShell
installer where it was deliberately kept. **Not decided here**; an agent
cannot invoke another repo's reopen trigger.

## The drift question, answered

- **Two** files differ (`SKILL.md`,
  `templates/bmad/docs/stories/README.md`) — measured, matching the brief.
- **The newer side is CONSISTENT: the repo copy, for both**, so resolution
  is pick-a-side, not merge-per-file. The brief's flagged deviation did not
  fire.
- Three independent signals agree: mtimes (2026-08-24 vs 2026-09-13),
  `git log --follow`, and content. **Both changes come from the same
  commit** and both merely remove `project-workflow` cross-references.
- **The installed copy carries no unique fix** — the question the spike
  existed to answer. It is simply older, predating `S027`.
- **All four distinct model IDs still resolve** against a live 2026-09-15
  `opencode models` listing (506 lines), closing a four-week-stale
  verification. `models.jsonc` declares five tiers but four IDs — `analyst`
  duplicates `coder` deliberately.
- **Five dangling cross-repo citations**, four in `install-tiers.ps1` (one
  inside a runtime `Write-Warning`) and one in `SKILL.md`. **All in the
  installer half**; the four role files contain **zero** — verified, which
  is what makes option 3 viable.
- **`tier3.md`/`bmad.md` are client config, not skill content** — OpenCode
  command files whose body invokes `skill({ name: "agent-tiers" })`.
  Out of scope; importing them would silently give this repo a `commands/`
  category it has never decided to have.

## Two corrections to the brief's own inputs

- The skill has **13 files, not 12**. Both trees agree, so the diff is
  unaffected.
- **TASK-0044's dependency on TASK-0035 is unnecessary.** It needed
  `bmad-workflow.md` for *read access only*, and the file is readable in
  place at 53 lines with every cited section present. Dependency dropped, so
  TASK-0044 is not collateral damage of the ADR-0017 block.

## Where the finding came from

**A step the brief did not ask for.** The plan covered `diff -u`, mtimes and
`git log --follow` on the two differing files — it never asked *why* they
differ. Reading the commit message behind the drift is what surfaced the
ownership decision. A `diff -u` answers "what changed"; the commit message
answers "who decided what, and when".

Also worth recording: **two lessons pointed at the same facts and the wrong
one was applied.** The orphan reading (lesson 9) was the one this repo had a
name for, so it won over the decayed-claim reading (lesson 7) — even though
the claim in question was a quotation of an *external* document, the class
`CURRENT_STATE` already flags as fastest-decaying.

## Propagation

The false premise was stated in seven places, all corrected in place with
the retraction visible rather than silently rewritten:
`CURRENT_STATE.md` (three: finding 1, the component list, lesson 9's worked
example), `ADR-0017` (a status banner), `SPRINT-CURRENT.md`, `TODO.md`,
`ROADMAP.md` (the now-unachievable exit criterion), and `BACKLOG.md`
(B-014's title and its explanation).

## Validation

- `bash tests/validate.sh` → PASS (`validate.sh: OK`, exit 0)
- `scripts/sync-registry.sh` → no diff; no component changed
- **`opencode-customization` byte-identical**: `git status --short` empty
  before and after, HEAD `f9f5e37` both times. Never written to;
  `install-tiers.ps1` never executed, not even `-WhatIf`
- **`~/.config/opencode/` unmodified**: skill still a real directory,
  `SKILL.md` mtime still 2026-08-24 23:47:36, `opencode.jsonc` mtime still
  2026-08-24 23:48:09, **no `agent` key**
- No secret material read, copied or printed

## Exit state

**Phase 1 is closed as far as an agent can close it.** TASK-0034 done;
**ADR-0017 awaits a human decision** and TASK-0035 must not start before it.

Unblocked and independent: **TASK-0043** (design roles — Phase 2 was its
last dependency) and **TASK-0044** (now with no TASK-0035 dependency).
Either can proceed without touching the ADR-0017 question.

- Result: TASK-0034 done, with a blocking finding escalated. Commit and push
  recorded in the task log.
