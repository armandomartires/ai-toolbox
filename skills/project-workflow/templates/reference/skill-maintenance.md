# Reference: maintaining this skill

Read this only when improving the `project-workflow` skill itself.

- **Where it lives.** The skill is maintained in the `ai-toolbox` repository at `skills/project-workflow/` and deployed by its `scripts/install.sh`.
- **Schemas own the shapes.** The `tasks/`, `decisions/` and `reviews/` templates are generated from `schemas/` by ai-toolbox's `scripts/sync-templates.sh` (ADR-0027). To change one, edit the schema, re-run the script, and commit both.
- **Templates are copied, never symlinked.** A scaffolded project owns its layer, and a later skill update never changes it.
- **Improvements flow back.** Bring improvements found in another project back to this skill. Don't edit an already-scaffolded project unless asked.
- **Versioning.** Every content change bumps `SKILL.md`'s `metadata.version` in the same commit. A change to how artifacts are produced is a major bump.
