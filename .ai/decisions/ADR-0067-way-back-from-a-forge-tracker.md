# ADR-0067 — A forge tracker can be changed back to files: a read-only export, and a switch that names its ADR

**Status**: proposed
**Date**: 2026-11-15
**Task**: `S019.T001`
**Amends**: ADR-0037 clauses 1 and 5

## Context

ADR-0037 lets a project track its work in files, on GitLab or on GitHub, and `S011.T034` made the move from files to a forge leave a tag (`pre-forge-migration`) on the files it removes. The way back was never written. `tracker.sh init` refuses to change an existing `tracker.conf` and says to edit it by hand. No tool reads a forge's issues back as briefs. On 2026-11-15 the human asked whether the project has a way to change a workflow from GitLab or GitHub back into files. It had none.

## Decision

1. **`tracker.sh export --out DIR [--state open|all]`** reads the declared forge through `glab` or `gh` and writes `.ai/`-shaped files into `DIR`, which must be new or empty:
   - task issues as `tasks/S###.T###_Name.md`;
   - review issues under `reviews/`;
   - a fragment each for the roadmap's sprint table and for `35.AD_HOC_TASKS.md`;
   - `id-map.tsv` rows from issue number to new id;
   - `EXPORT.md`, which lists what changed on the way and every file the artifact schemas reject.

   The mapping is `templates/reference/tracker.md`'s table, run backwards. An issue that names an `S###.T###` id in its sprint keeps it. Any other issue gets the next number after the highest one in use for that sprint, so no id falls into a gap a tagged brief may hold.
2. **The export only reads.** It calls `auth status`, `issue list` and GET requests through `api`. It never writes into an existing `.ai/`; a person merges. Closing the forge's issues stays a human step.
3. **`tracker.sh init --replace --adr ADR-NNNN`** rewrites `tracker.conf` only when that ADR is a file in `.ai/decisions/`, and the conf records the ADR it was changed by. Without `--replace`, `init` still never overwrites. This amends clause 1: the rule "changing the tracker is a decision" is now enforced by the tool, not only written down.
4. **The first tooling over the forge.** It is read-only and for leaving the forge, which the convention could not do by hand without retyping every issue. Clause 5 stands for everything else: agents still use `glab` and `gh` by hand.
5. **The procedure** is *Changing the tracker back to files* in `tracker.md`:
   1. Record the ADR.
   2. Tag `pre-files-migration`.
   3. Restore from `pre-forge-migration`.
   4. Export.
   5. Merge and check.
   6. Switch `tracker.conf`.
   7. Close the issues by hand.

## Alternatives considered

- **Edit `tracker.conf` by hand, as before:** rejected. That is the "quiet edit" ADR-0037 forbids, and nothing tied the edit to its decision.
- **Export straight into `.ai/`:** rejected. A restored `pre-forge-migration` layer and the export overlap, and only a person can merge them safely.
- **Keep forge issue numbers as task ids:** rejected. ADR-0066 makes `S###.T###` the id. The id map keeps `(#123)` commits resolvable.
- **Close the issues from the export:** rejected. That writes to the forge before the push is confirmed, which clause 6 forbids for closing keywords for the same reason.

## Consequences

- `check-tracker.sh` proves the mapping, the refusals and the read-only calls against a fake forge (`fixtures/forge/fake_forge.py`), 89 cases. No real forge has been read yet: `gh` on the authoring host is not logged in, and `glab` is not installed.
- `project-workflow` is 8.1.0 and `project-migration` is 6.0.1.
