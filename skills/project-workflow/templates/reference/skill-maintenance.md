# Reference: maintaining and reusing this skill across projects

Linked from `00.CONVENTIONS.md` — read this if improving the
`project-workflow` skill itself, not using it in a consuming project.
Almost nobody working *in* a scaffolded project needs this file.

This file, its siblings' templates, and the `tasks/`/`decisions/`/`reviews/`
`0000-TEMPLATE.md` files are maintained as the **`project-workflow`**
skill inside the **`ai-toolbox`** repository
(`skills/project-workflow/`), and deployed to clients (Claude Code,
OpenCode, LM Studio) via `ai-toolbox`'s own `scripts/install.sh`.

To scaffold `.ai/` (or a project's declared equivalent — see
`reference/layout-declaration.md`) in a new project, ask the agent to
scaffold the workflow layer, or invoke this skill by name.

**Templates are copied into each project, never symlinked.** Once
materialized, a project's layer is that project's own; updating this
skill later never retroactively changes a project that already scaffolded
from it. This keeps every project self-contained and avoids a
cross-platform symlink dependency.

If a `00.CONVENTIONS.md` improvement or a template fix is found while
working in some *other* project, propagate the improvement back here
(`ai-toolbox`'s `skills/project-workflow/templates/`) so future scaffolds
benefit — but do **not** retroactively edit an already-scaffolded
project's layer unless explicitly asked to. Any content change to this
skill bumps `SKILL.md`'s `metadata.version` (semver) in the same commit,
so a version string always means exactly one thing.
