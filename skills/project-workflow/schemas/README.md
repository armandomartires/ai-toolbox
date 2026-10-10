# The schema format

A schema is the single owner of one artifact kind's shape (ADR-0027). It defines:
- which headings exist
- their order
- which are required
- whether each is written before or after the work

Only two scripts read schemas: `../scripts/new-artifact.sh` emits a skeleton, and `../scripts/check-artifact.sh` checks a finished artifact. ai-toolbox's `scripts/sync-templates.sh` renders `templates/` from the schemas, so edit a schema and never a template. The format is line-oriented so that the parser is stdlib-only.

## Structure

```
---
kind: task                       # artifact kind, one word
framework: project-workflow      # which governance framework owns it
id_placeholder: S###.T###_Name   # what the generated template shows
filename_pattern: tasks/{id}.md  # where a real instance is written
title_pattern: {id}              # the H1, minus the leading "# "
max_lines: 80                    # optional line budget (ADR-0033)
superseded: Preconditions        # optional: headings that now fail the check
allow_extra: true                # optional: allow headings the schema lacks
---

!preamble
!standard
Status is one of: not started, in progress, blocked, completed.
!body
**Status**: not started

## Goal
!phase before
!required true
!standard
One to three sentences: what changes, and why now.
```

**Frontmatter** holds `key: value` scalars only. Lines starting with `#` after the frontmatter are comments.

**`!preamble`** is content emitted under the H1, before the first heading.

**A section** starts at any `##`–`######` heading. The heading text, `#`s included, is the section's identity.

| Directive | Meaning |
|---|---|
| `!phase before` / `!phase after` | The section is written before the work, or after it. An empty `after` section fails on a completed artifact. |
| `!required true` / `false` | Whether a missing heading fails the check. The default is `true`. |
| `!terse` `!standard` `!explicit` `!literal` | Guidance at that density, up to the next directive. Only `!standard` is required; the others fall back to it. |
| `!body` | Literal content emitted at every level: tables, checklists, field lines. |

## The one invariant

Guidance is emitted only inside `<!-- FILL: … -->` comments, which the author deletes when filling the section. `!body` is emitted bare. So a skeleton with its comments stripped is byte-identical at all four guidance levels.

Never put structure in guidance, or instructions in `!body`. Keep rationale out of both: it belongs in an ADR, not in every artifact.

## Guidance levels

| Level | Shape of the text |
|---|---|
| `terse` | a noun phrase |
| `standard` | one or two sentences (the default) |
| `explicit` | a numbered instruction naming each field |
| `literal` | imperative steps, for a small model |

No model or tier name appears anywhere, and nothing maps a model to a level (ADR-0018 clause 7, ADR-0027 clause 4).

## Substitutions

`{id}`, `{name}`, `{title}`, `{date}`, `{sprint}` and `{task}` can be used in `title_pattern`, `filename_pattern`, `!preamble` and `!body`. A placeholder with no value is left verbatim, so a missing answer reads as missing.
