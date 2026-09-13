# Reference: declaring a non-default layout root or entry point

Linked from `00.CONVENTIONS.md` — read this when a project needs its
workflow layer somewhere other than `.ai/`, or wants its process to live
directly in `AGENTS.md` instead of a dedicated conventions file.

## The problem this solves

By default this skill scaffolds `.ai/00.CONVENTIONS.md` as the layer root
and entry point. Two real project shapes don't fit that default:

- **The layer needs to nest** (e.g. `.ai/workflow/`, typically because
  `.ai/` is already shared with sibling concerns like `docs/` or
  `scripts/` in that project).
- **The project wants no dedicated conventions file at all** and instead
  keeps the whole plan/develop/test/validate process directly in its own
  `AGENTS.md`. `ai-toolbox` (this skill's own home repo) is exactly this
  case: its `AGENTS.md` states the process; no `.ai/00.CONVENTIONS.md`
  exists or is needed.

Hard-coding `.ai/00.CONVENTIONS.md` everywhere this skill's logic touches
a path breaks both cases. The fix is a declaration, not a prose exception
buried in an agent's global instructions — prose can't be resolved
programmatically and duplicates a fact the project's own files should own
outright.

## The declaration

A project may place a small JSON file at its repo root named
**`.ai-layout.json`**:

```json
{
  "root": ".ai/workflow/",
  "entrypoint": "AGENTS.md"
}
```

- **`root`** — the workflow layer's directory, relative to the repo root,
  trailing slash optional. Default when the file is absent, or when this
  key is absent: `.ai/`.
- **`entrypoint`** — the convention file's name, resolved inside `root`.
  Default: `00.CONVENTIONS.md`. Point this at `AGENTS.md` when the
  project keeps the process there instead of a dedicated file.

**Absent a declaration, behavior is unchanged**: `.ai/` +
`00.CONVENTIONS.md`. A missing `.ai-layout.json` is never itself an
error.

## Resolving it

Every path this skill or its templates mention — `tasks/`, `decisions/`,
`reviews/`, the entry point itself — resolves through the declaration,
not through a literal `.ai/` assumption:

1. Check for `.ai-layout.json` at the project's repo root.
2. If present and valid, resolve `root`/`entrypoint` from it.
3. If absent, use the defaults.
4. If `entrypoint` is not `00.CONVENTIONS.md` (e.g. it is `AGENTS.md`),
   do not copy `templates/00.CONVENTIONS.md` into the project at all —
   the project's own `AGENTS.md` already carries the process.
5. If there is **no** declaration but the project already has a
   `.ai/`-adjacent directory under a different name than the resolved
   `root`, with nothing explaining the mismatch, **ask the user** whether
   to write a declaration matching the existing layout or scaffold fresh
   at the default — never silently pick one.

Malformed declarations fail loudly, not silently: an unrecognized key, a
`root` that is not a relative path (an absolute path or a drive letter
defeats the purpose — the file travels with the repo), a `root` that
doesn't exist on disk, or an `entrypoint` naming a missing file inside it,
are all reported to the user rather than guessed past.

## Worked example: this skill's own home repo

`ai-toolbox` declares:

```json
{ "root": ".ai/", "entrypoint": "AGENTS.md" }
```

No `.ai/00.CONVENTIONS.md` exists there. `AGENTS.md` states the process
directly; `.ai/` holds `context/`, `decisions/`, `planning/`, `tasks/`,
`sessions/`, `reviews/`, `templates/` per that repo's own `ADR-0001`.
