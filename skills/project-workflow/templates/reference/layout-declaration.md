# Reference: a non-default layout root or entry point

Read this when the workflow layer lives somewhere other than `.ai/`, or when the process lives in `AGENTS.md` instead of a conventions file.

## The declaration

Put `.ai-layout.json` at the repository root:

```json
{ "root": ".ai/workflow/", "entrypoint": "AGENTS.md" }
```

- **`root`** is the layer's directory, relative to the repository root. The default is `.ai/`.
- **`entrypoint`** is the convention file, resolved inside `root`. The default is `00.CONVENTIONS.md`. Use `AGENTS.md` when the project states its process there.

If the file is absent, the defaults apply; that is never an error.

## Resolving it

1. If `.ai-layout.json` exists and is valid, take `root` and `entrypoint` from it. Otherwise use the defaults.
2. Resolve every path (`tasks/`, `decisions/`, `reviews/`, the entry point) through `root`.
3. If `entrypoint` is not `00.CONVENTIONS.md`, do not copy `templates/00.CONVENTIONS.md`.
4. If there is no declaration but an existing layer sits under another name, **ask the user**: declare the existing layout, or scaffold at the default.

**Report a malformed declaration, never guess past it.** That covers:
- an unknown key
- an absolute `root`
- a `root` that does not exist
- an `entrypoint` naming a missing file

## Example

A project keeping its process in `AGENTS.md` and its layer under `.ai/workflow/` declares `{ "root": ".ai/workflow/", "entrypoint": "AGENTS.md" }`, and has no `00.CONVENTIONS.md`.
