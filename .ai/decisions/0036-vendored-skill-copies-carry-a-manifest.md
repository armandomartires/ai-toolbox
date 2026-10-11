# ADR-0036 — A vendored skill copy carries a manifest and is gated in its project

**Status**: accepted
**Date**: 2026-10-11
**Task**: TASK-0161

## Context

A project that publishes its dashboard runs a copy of `project-workflow` that is tracked in its own repository, because a CI runner clones the repository and nothing else (ADR-0029; `publish_lib.check_skill_dir`). The skill said only "copy it in".

The first copy, asset-management's `build/vendor/project-workflow`, was taken by hand on 2026-10-05, with a home-made manifest. By 2026-10-11 it was two major versions behind, and nothing could say so without a manual diff.

On 2026-10-11 the human asked how to make sure every project has the skill up to date, and chose a vendoring tool with a manifest.

## Decision

1. **A vendored copy is written only by `vendor-skill.sh --write`**, run from the source checkout. It copies the skill as committed at HEAD and refuses uncommitted source changes. It ships `SKILL.md`, `scripts/`, `assets/`, `dashboard/`, `references/` and `schemas/`; fixtures and templates stay behind.
2. **The copy carries `VENDORED.md`:** the source, the version, the commit, the date and a sha256 for each file, hashed over LF line endings. It follows the shape of `dashboard/VENDORED.md`, which sigma-llmwiki keeps for this repo.
3. **The consuming project gates on `vendor-skill.sh --verify`.** It is run from the copy itself and needs no source checkout. It fails on any edited, missing or added file.
4. **Staleness is checked from the source:** `--check --into <repo>`. It is a report run by hand, never part of this repo's gate. A gate that reads another repository cannot pass on a clean clone (ADR-0009).
5. **`--write` never destroys what it did not write.** It refuses a directory with no manifest and a copy with local edits, unless given `--adopt`. It deletes only files its previous manifest listed.

## Alternatives considered

- **A git submodule or subtree:** rejected. It puts the whole repository, or its history, in the consumer, and the runner would need recursive clones and credentials for this repo.
- **Fetch the skill in CI at build time:** rejected. It makes the published page depend on network access to this repo, and on the mirror being public.
- **Keep per-project manual copies with their own manifests:** rejected. It is what asset-management did, and nothing could tell it was behind.

## Consequences

- A project's gate catches an edit to its copy. Whether the copy is current is still a question someone has to ask, with `--check`.
- asset-management's copy predates this. Moving it onto `vendor-skill.sh` is a task in that repository.
- `project-workflow` is 6.3.0.
