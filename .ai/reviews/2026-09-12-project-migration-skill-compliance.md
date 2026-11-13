# REVIEW-0001 — Compliance audit of the imported project-migration skill

- Task(s) reviewed: pre-task audit of the untracked import
  `skills/project-migration/` (led to TASK-0001, TASK-0002)
- Reviewer: agent (opencode), 2026-09-12
- Diff summary: nothing committed. Three untracked paths audited —
  `skills/project-migration/` (SKILL.md 56 lines, references/
  governance-spec.md 106 lines, scripts/ai-project-scaffold.sh 572
  lines), plus `scripts/ai-project-scaffold.sh` and
  `scripts/ai-toolbox-scaffold.sh`.

## Findings

### Compliant
Checked against `AGENTS.md` and `docs/development/authoring-guide.md`:

| Guideline | Result |
|---|---|
| SKILL.md present, case-correct, `name` + `description` frontmatter | pass |
| `name` matches directory name | pass |
| No README.md inside the skill folder | pass |
| SKILL.md lean, detail pushed to `references/` | pass (56 lines) |
| Scripts idempotent (`mkfile` never overwrites; `git init` guarded) | pass |
| `bash -n` syntax check | pass |
| No secrets/tokens/`.env` (grep matches are policy prose only) | pass |
| tests/validate.sh | pass |

### Process gaps (blocking)
1. **No task brief.** `.ai/tasks/` held only `TODO.md`. AGENTS.md
   ("Mandatory task process") requires the brief before code.
2. **Registry not regenerated.** `docs/registry.md:5-7` Skills table
   empty, against AGENTS.md "Documentation rules".
3. **CURRENT_STATE stale.** Line 5 claims "no live components yet";
   line 10 still recommends creating TASK-0001.
4. **Duplicate script.** `scripts/ai-project-scaffold.sh` byte-identical
   to the skill's copy (`diff` clean, 572 lines each) — two sources of
   truth. `scripts/ai-toolbox-scaffold.sh` additionally untracked and
   unrelated; committing it alongside would breach "one task = one
   commit".

### Defects in the skill (blocking)
5. **`SKILL.md:12,37` — wrong script path at runtime.** Instructing
   `scripts/ai-project-scaffold.sh . --force` resolves against the
   *target* repo's `scripts/`, not the skill bundle. Compounded by
   tracked scripts being mode `100644` (`core.fileMode=false`), so direct
   execution fails; the repo's own runbook uses `bash <script>`.
6. **`ai-project-scaffold.sh:556-559` — masked failure.**
   `git commit -qm … 2>/dev/null || git add -A` swallows a failed commit,
   contradicting the skill's own hard rule at `SKILL.md:22`. Also
   duplicates `-q` and `--quiet`.
7. **`ai-project-scaffold.sh:211-213` — contradicts ADR-0002.** The
   `CLAUDE.md` fallback writes a `# See AGENTS.md` stub; ADR-0002
   prescribes copying `AGENTS.md`, and `SKILL.md:39` requires an ADR when
   the fallback fires. The script degrades silently and emits no ADR.

### Minor
8. `version: '1.0'` is not semver (authoring guide line 18).
9. `license: MIT` and `metadata` keys absent from
   `skills/_template/SKILL.md`; no repo `LICENSE` backs the MIT claim.

### Explicitly not a finding
`references/governance-spec.md` overlaps this repo's `AGENTS.md`, but it
is a portable deliverable describing the framework the skill installs
into *other* repositories — not documentation of ai-toolbox. No "one
owner per fact" violation; no action.

## Validation results
- `bash tests/validate.sh` → `validate.sh: OK`
- `bash -n skills/project-migration/scripts/ai-project-scaffold.sh` → OK
- `diff` of the two scaffold copies → identical
- Secrets grep → policy prose only, no credentials

## Verdict
request changes — skill content is sound; registration process and three
functional defects must be fixed before commit.

## Follow-up tasks
- TASK-0001 — findings 1, 2, 3, 4, 5, 6, 7
- TASK-0002 — findings 8, 9 (schema half)
- B-004 — repo LICENSE file (finding 9, licensing half)
