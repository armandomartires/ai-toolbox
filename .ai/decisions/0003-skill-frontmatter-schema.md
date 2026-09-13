# ADR-0003 — Skill frontmatter schema

## Status
Accepted (2026-09-12)

## Context
`skills/_template/SKILL.md` defines only `name` and `description`, the two
keys the Agent Skills spec requires and the two `tests/validate.sh`
checks. The imported `project-migration` skill arrived with additional
keys: `license: MIT` and a `metadata` block carrying `author` and
`version`.

This left three inconsistencies: the template did not sanction the keys;
`docs/development/authoring-guide.md` prescribed versioning via a
"frontmatter comment", which contradicts a structured `metadata.version`;
and nothing recorded which form future skills should follow.

Skills in this repo are deployed to multiple clients (Claude Code,
OpenCode, LM Studio) by `scripts/install.sh`, and indexed by
`scripts/sync-registry.sh`. Without a version field there is no way to
tell which revision of a skill a client has, and AGENTS.md already
requires semver per component.

## Decision
Extend the skill frontmatter schema:

- **Required:** `name`, `description`.
- **Optional:** `license`, and `metadata` with `author` and `version`.
- `metadata.version` is semver (`1.0.0`), superseding the "frontmatter
  comment" rule in the authoring guide for skills. MCP servers keep their
  version in `pyproject.toml`.

Optional keys stay optional: a skill without them remains valid, so
`tests/validate.sh` needs no change and existing skills do not break.
Enforcement of the optional keys is deferred to the Skill Linter
(backlog B-002).

Rejected alternative: strip `license` and `metadata` from the imported
skill to match the current template. This was cheaper but discarded
version and attribution information, and would have recurred with the
next imported skill.

## Consequences
- `skills/_template/SKILL.md` and the authoring guide must both list the
  keys, with one owner: the guide is normative, the template is the
  copyable example.
- `sync-registry.sh` parses the first `^name:`/`^description:` per file;
  `metadata` sub-keys are indented and cannot shadow them. A future
  nested `name:` under `metadata` would break the generator — the parser
  is naive by design and stays that way until B-002.
  **Update (2026-09-13):** B-002 closed as TASK-0012, and `validate.sh`
  now parses frontmatter properly, but this note still stands for
  `sync-registry.sh`, which remains deliberately naive. The gate catches
  the malformed case before the generator has to.
- Skills gain traceable versions, enabling future drift detection between
  repo and deployed client copies.
- ~~`license: MIT` on a skill is unbacked until the repo ships a `LICENSE`
  file (backlog B-004).~~ **Resolved 2026-09-13 by TASK-0013:** the repo
  ships an MIT `LICENSE`, so both skills' claims are now backed. Kept
  struck through rather than deleted — this was a real gap carried
  knowingly for three sprints, and the record of that is worth more than a
  tidy list.
