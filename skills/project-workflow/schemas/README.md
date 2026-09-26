# The schema format

A schema is the **single owner of one artifact kind's shape** (ADR-0027):
which headings exist, in what order, which are required, and whether each
is written before or after the work.

Two things read a schema, and nothing else may hold a copy of what it says:

- `../scripts/new-artifact.sh` — emits a skeleton from it.
- `../scripts/check-artifact.sh` — proves a finished artifact matches it.

`../../../scripts/sync-templates.sh` regenerates every `templates/` file in
this repo by calling the generator with placeholder identifiers. Those
template files are **derived artifacts**; edit a schema, never a template.

## Why this format and not YAML

The repo hand-rolls its parsers on purpose — *"a checker that needs
`pip install` is a checker that does not run"*
(`skills/unattended-ops/scripts/check-binding.sh`). This format is
line-oriented so the parser is unambiguous in ~60 lines of `python3`
stdlib, with no block-scalar, anchor or tag subset to get wrong.

## Structure

```
---
kind: task                       # artifact kind, one word
framework: project-workflow      # which governance framework owns it
id_placeholder: S###.T###_Name   # what the generated *template* shows
filename_pattern: tasks/{id}.md  # where a real instance is written
title_pattern: {id}              # the H1, minus the leading "# "
---

!preamble
**Status**: not started | in progress | blocked | completed

## Goal
!phase before
!required true
!standard
One or two sentences. What is this task for, and why now?
!literal
Replace this line with 1-3 sentences answering, in order: ...

## Inputs
!phase before
!required true
!standard
Every artifact this task consumes, so it can be started cold.
!body
| Artifact | Produced by | Expected state |
|---|---|---|
| `path/or/doc` | `S###.T###_Name`, or "pre-existing" | the state assumed |
```

**Frontmatter** is `key: value` scalars only. No nesting, no lists.

**`!preamble`** is content emitted directly under the H1, before the first
heading. Optional.

**A section** starts at any `##`…`######` heading line. The heading text,
verbatim and including its `#`s, is the section's identity — it is what
the checker compares and what fixes heading order.

**Directives** are lines beginning with `!`:

| Directive | Meaning |
|---|---|
| `!phase before` / `!phase after` | Written before the work, or after it. Makes the before/after rule machine-readable instead of prose a smaller model may skip. |
| `!required true` / `!required false` | Whether the checker rejects the artifact when this heading is absent. Default `true`. |
| `!terse` `!standard` `!explicit` `!literal` | Start the guidance text for that density level. Text runs to the next directive or heading. |
| `!body` | Start literal content emitted at **every** level — tables, checklists, field lines. |

## The one invariant

**Guidance is emitted only inside `<!-- FILL: … -->` comments; `!body` is
emitted bare.** Therefore stripping every comment from a generated skeleton
yields a byte-identical file at all four guidance levels. That is what
makes "same output, less reasoning" a checkable claim rather than a hope,
and `TASK-0109` verifies it by generating all four and diffing.

A schema that puts real structure in a guidance block, or instructions in a
`!body` block, breaks that invariant. Don't.

## Guidance levels

Only `!standard` is required. A missing level falls back to `!standard`, so
a section whose instruction does not usefully vary carries one block, not
four. That is deliberate: it keeps schemas small and stops three near-copies
of one sentence from drifting apart.

| Level | Suggested for | Shape of the text |
|---|---|---|
| `terse` | frontier, 500b, 300b | A noun phrase. `goal — what and why now` |
| `standard` | 120b | One or two sentences of intent. The default. |
| `explicit` | 60b, 30b | Numbered instruction naming each field to write. |
| `literal` | 12b | Imperative, step-by-step, ending in an explicit instruction to delete the comment. |

**That column is a suggestion, not a resolver.** No tier name appears in any
schema, script or frontmatter, and nothing maps a model to a level —
ADR-0018 clause 7 keeps model references in `agent-tiers`' `models.jsonc`,
and ADR-0027 clause 4 states why the flag is `--guidance` and not `--tier`.

## Substitutions

Available in `title_pattern`, `filename_pattern`, `!preamble` and `!body`:
`{id}`, `{name}`, `{title}`, `{date}`, `{sprint}`, `{task}`. An unset
placeholder is left verbatim, so a template generated with no `--id` shows
`{id}` rather than an empty string that reads as an answer nobody gave.
