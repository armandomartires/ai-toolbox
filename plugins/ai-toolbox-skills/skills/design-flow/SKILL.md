---
name: design-flow
description: "Choose between design approaches and write the design doc, RFC or design brief: generate genuinely distinct alternatives, critique them, converge on a proposal a human accepts. USE FOR: 'which approach should we take', 'write a design doc / RFC / design brief', 'compare these options and their trade-offs', a hard-to-reverse architecture decision, checking whether two options really differ. Wins over general architecture or brainstorming help when alternatives must be generated, critiqued and accepted by a human. DO NOT USE FOR: an ADR or task brief for a choice already made, or planning docs (project-workflow, project-migration); implementation sequencing (loops/project-build/); UI or visual critique."
license: MIT
metadata:
  author: armando.martires
  version: "1.1.0"
---

# design-flow

The **method** for the design stage. `loops/design-brief/loop.md` owns the
*sequence* and its exit conditions; this skill owns *how* to perform the
steps that need a method. Links, never restates — a copied rule creates a
second owner that drifts.

| Loop step | Method lives in |
|-----------|-----------------|
| 1 clarify | `references/clarify-and-converge.md` |
| 2 ideate | `references/distinctness.md` |
| 3 critique | `references/critique-obligations.md` |
| 4 converge | `references/clarify-and-converge.md` + `templates/brief.md` |
| 5–7 | The loop. Sequence, not method — nothing here |

## The three things that make this work

Everything else is detail in `references/`.

1. **Alternatives differ in a load-bearing commitment** — something whose
   change would require *rewriting* rather than *adjusting*. Three variants
   of one approach are one candidate. `references/distinctness.md`.
2. **A critique states what it examined**, against eight named obligations,
   so "found nothing" is a claim with content rather than an absence of
   effort. `references/critique-obligations.md`.
3. **Convergence is not the critique running out of findings.** Step 4
   produces a *proposal*; acceptance is the human's at step 6
   (`ADR-0019` clause 1.1). A method that continues "until the critique is
   satisfied" has replaced that criterion with a model's judgement.

## The brief

`templates/brief.md` → the path agreed in step 1. Carries the three lock
fields (`status`, `accepted_by`, `accepted_on`) empty, so step 7 has
somewhere to write on acceptance. **The commit is the lock**, not the
fields — the loop explains why.

**Copy, never symlink.** A project's brief is its own; lessons learned
writing one propagate back into this template, never retroactively into an
already-written brief.

## What this skill is not

**Not a governance framework.** It produces a design brief — no task IDs, no
sprints, no `.ai/` layout opinion, no status enum beyond the two lock
values. That layer is the one convention owned by `project-workflow`
(`00.CONVENTIONS.md` + `20/30/35`, `S###.T###`), with `project-migration` to
retrofit it (ADR-0066); this skill adds none.

The pull is real: a brief with a status field starts to resemble a task
brief, which invites an ID scheme, which invites a sprint. It stops at the
lock fields.

**Not implementation sequencing.** `loops/project-build/` consumes the
accepted brief and **does not edit it** (`ADR-0019` clause 1.4).

## Running it

With a human present, run the loop through `/run-design-brief`
(`loops/design-brief/`; in the plugin `/ai-toolbox-skills:run-design-brief`),
or follow `loops/design-brief/loop.md` directly. Never write or lock a brief
without steps 6-7: human acceptance, then the commit as lock. Without a human,
use the method only and say the brief is a proposal.

## Maintaining

Content changes bump `metadata.version` above (`ADR-0003`). If a method rule
and the loop ever disagree, the loop wins on sequence and exit conditions;
this skill wins on method.
