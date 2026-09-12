# TASK-0001 — Port and harmonize the project-migration skill

## Objective
Bring the imported `skills/project-migration` skill into full compliance
with `AGENTS.md` and `docs/development/authoring-guide.md`, make it the
canonical owner of `ai-project-scaffold.sh`, and register it in
`docs/registry.md`.

## Minimal context
The skill was imported by hand (untracked) and never went through the
component registration procedure in AGENTS.md ("Documentation rules"):
no task brief, no registry regeneration, no CURRENT_STATE update.

A compliance review (see REVIEW-0001) found the skill's own content
sound — valid frontmatter, lean SKILL.md, detail in `references/`,
idempotent script, no secrets — but identified three functional defects
and four process gaps. This task fixes the defects and closes the gaps.

Frontmatter schema questions raised by this skill (`license`,
`metadata.author`, `metadata.version`) are resolved separately in
TASK-0002 / ADR-0003, because they change the convention for every
future skill rather than just this one.

## Scope

### Included
- Fix the two script-path references in `SKILL.md` that resolve against
  the wrong repository at runtime.
- Fix the masked commit failure in the scaffold script.
- Align the scaffold script's `CLAUDE.md` fallback with ADR-0002.
- Delete the two untracked duplicate/unrelated scripts in `scripts/`
  (human-authorized — see Preconditions).
- Regenerate `docs/registry.md`; update `.ai/context/CURRENT_STATE.md`.
- **Deviation (found during Mandatory validations, not in the original
  review):** the idempotence smoke test caught a real bug — the six
  unconditional `>>` appends to `AGENTS.md` re-duplicated every section
  on a second scaffold run, because `mkfile` guards the initial `cat >`
  but plain `>>` has no such guard. Fixed by gating the whole append
  chain on `[ -e AGENTS.md ]` computed before the guarded `mkfile` call.
  In scope here because it blocks this task's own idempotence acceptance
  criterion; recorded as a deviation per AGENTS.md ("record any deviation
  from the original Plan").

### Not included
- Frontmatter schema change (`version: '1.0'` → semver, `license`,
  `metadata`) — TASK-0002.
- Restructuring `references/governance-spec.md`. It overlaps this repo's
  `AGENTS.md` by design: it is a portable deliverable describing the
  framework this skill installs into *other* repos, not documentation of
  ai-toolbox. Not a "one owner per fact" violation.
- Adding a repo `LICENSE` file to back the skill's `license: MIT`
  claim — backlog B-004.
- Any change to `skills/_template/` or the authoring guide — TASK-0002.

## Preconditions
- Branch `master`, clean except the three known untracked paths:
  `scripts/ai-project-scaffold.sh`, `scripts/ai-toolbox-scaffold.sh`,
  `skills/project-migration/`.
- **Destructive-change authorization (AGENTS.md "Destructive changes"):**
  the human authorized, in session 2026-09-12, deletion of:
  - `scripts/ai-project-scaffold.sh` — byte-identical duplicate of the
    skill's copy (verified with `diff`, 572 lines each); skill copy is
    canonical so the skill stays self-contained and portable.
  - `scripts/ai-toolbox-scaffold.sh` — unrelated to this skill.

  Both files are **untracked**, so deletion is not recoverable via git.
  Confirm `diff` is still clean immediately before removing the first.

## Likely files
- `skills/project-migration/SKILL.md` (lines 7, 12, 37)
- `skills/project-migration/scripts/ai-project-scaffold.sh`
  (lines 211-213, 556-559, final report block)
- `scripts/ai-project-scaffold.sh` (delete)
- `scripts/ai-toolbox-scaffold.sh` (delete)
- `docs/registry.md` (generated)
- `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`

## Execution plan
1. Re-verify preconditions: `git status`, and
   `diff scripts/ai-project-scaffold.sh skills/project-migration/scripts/ai-project-scaffold.sh`
   must report no differences. If it does not, stop and ask — the two
   copies have diverged and the canonical choice needs re-confirming.
2. `SKILL.md:12` and `SKILL.md:37` — replace the bare
   `scripts/ai-project-scaffold.sh` with a skill-relative invocation, so
   it cannot resolve against the target repo's own `scripts/` directory.
   Invoke via `bash <path>` rather than executing directly, because
   tracked scripts in this repo are mode `100644` (`core.fileMode=false`)
   and `docs/operations/runbook.md` already uses the `bash <script>` form.
3. `ai-project-scaffold.sh:556-559` — remove `2>/dev/null || git add -A`
   and the duplicated `--quiet` (redundant with `-qm`), so a failed
   commit surfaces instead of being swallowed. The current form
   contradicts the skill's own hard rule at `SKILL.md:22` ("If a push
   fails, diagnose and report — do not declare the task done").
4. `ai-project-scaffold.sh:211-213` — on `ln -s` failure, copy
   `AGENTS.md` to `CLAUDE.md` (the fallback ADR-0002 prescribes) instead
   of writing a `# See AGENTS.md` stub, and print an instruction to
   record an ADR, which `SKILL.md:39` requires of the fallback path.
5. Delete the two authorized files (step 1 re-verified).
6. `bash scripts/sync-registry.sh` — populates the Skills table, empty at
   `docs/registry.md:5-7`. Confirm the row renders (the description
   contains commas and parentheses but no `|`, so the table is safe).
7. Update `.ai/context/CURRENT_STATE.md`: line 5 ("no live components
   yet"), line 7 (incomplete list), line 10 (next action → TASK-0003).
   Tick TASK-0001 in `.ai/tasks/TODO.md`.
8. Run validations; review `git diff --staged`; commit; push; record
   hash and push result in the Execution log below.

## Acceptance criteria
- [x] `SKILL.md` contains no script path that resolves against the
      target repository's `scripts/` directory.
- [x] Running the documented Phase 2 command from an arbitrary repo root
      invokes the skill's own scaffold copy.
- [x] A failing `git commit` inside the scaffold script causes a visible
      non-zero failure, not a silent `git add -A`.
- [x] `CLAUDE.md` fallback produces a full copy of `AGENTS.md` and tells
      the operator to record an ADR, per ADR-0002 and `SKILL.md:39`.
- [x] `scripts/ai-project-scaffold.sh` and
      `scripts/ai-toolbox-scaffold.sh` no longer exist; exactly one copy
      of the scaffold remains, inside the skill.
- [x] `docs/registry.md` Skills table lists `project-migration` with its
      description and path.
- [x] `CURRENT_STATE.md` reflects one live skill and names the next action.
- [x] Commit contains only this task's changes; no unrelated files.
      (`skills/project-workflow/`, an untracked, unaudited skill that
      appeared mid-session, was excluded from `sync-registry.sh`'s
      output by temporarily moving it out of `skills/` during
      regeneration, then restoring it untouched.)

## Mandatory validations
- [x] tests/validate.sh — `validate.sh: OK`
- [x] scripts/sync-registry.sh (if components changed) — Skills table
      now lists `project-migration`; `project-workflow` deliberately
      excluded (out of scope, see above).
- [x] `bash -n skills/project-migration/scripts/ai-project-scaffold.sh`
      — syntax check after editing. Passed both after the ADR-0002/
      commit fixes and again after the idempotence fix.
- [x] Scaffold smoke test in a throwaway dir (`/tmp`): ran twice with
      `--type generic --no-git`; second run initially duplicated
      `AGENTS.md` content (the deviation above) — fixed, re-ran, `md5sum`
      of `AGENTS.md`/`README.md`/`CHANGELOG.md`/`.gitignore` identical
      across both runs. Also forced the `ln -s` failure path (fake `ln`
      shim on `PATH`) and confirmed the ADR-0002 copy fallback and the
      step-5 report line both fire correctly.
- [x] `bash scripts/install.sh link` — skill deploys; `SKILL.md` resolves
      through `~/.claude/skills/project-migration` (verified with
      `readlink` + direct read through the link).
- [x] Secrets scan over the skill before commit — no matches beyond
      policy prose.

## Risks and rollback
- Deleting two untracked files is irreversible. Mitigated by `diff`
  verification for the duplicate; the unrelated script is deleted on
  explicit authorization and is reproducible from its own history of use.
- Editing the scaffold script risks breaking heredoc quoting (38 `mkfile`
  calls, mixed quoted/unquoted `EOF`). Mitigated by `bash -n` plus the
  `/tmp` smoke test.
- Rollback: `git revert` this task's commit. Restores the skill and the
  registry; does **not** restore the two deleted untracked files.

## Dependencies
None. TASK-0002 (frontmatter schema) may follow independently; it touches
`SKILL.md:5-7` only, so ordering is not constrained.

## Expected result
One tracked, registered, validated skill — `project-migration` — that is
self-contained, deploys through `scripts/install.sh`, and whose scaffold
script fails loudly rather than silently. Repo has a single copy of the
scaffold. Registry and current state match reality.

## Status
- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-12
- Updated: 2026-09-12
## Execution log
### Attempt 1
- Date: 2026-09-12
- Agent: opencode (anthropic/claude-sonnet-5)
- Actions: re-verified diff of duplicate scripts before touching
  anything; edited `SKILL.md` script-path references; fixed masked
  commit failure; fixed CLAUDE.md fallback per ADR-0002 (copy +
  ADR-recording instruction); found and fixed an AGENTS.md idempotence
  bug via the mandated smoke test (deviation, logged above); deleted
  both authorized untracked files; regenerated the registry with
  `project-workflow` temporarily excluded; updated CURRENT_STATE.md and
  TODO.md.
- Observations: the idempotence bug was not in the original REVIEW-0001
  findings — the mandatory validation step caught it, confirming the
  value of the smoke-test requirement. `skills/project-workflow/`
  appeared untracked partway through the prior planning session (before
  this attempt) and is out of scope; excluding it from the registry run
  required a temporary move/restore rather than a script flag, since
  `sync-registry.sh` has no include/exclude option.
- Validation: all Mandatory validations above passed.
- Result: success.
- Commit: "Add project-migration skill and register it" on `master`
  (self-referencing the exact hash is impossible — amending to record a
  hash always produces a new one; run `git log --oneline -1` for the
  authoritative hash. Last observed: 67749b7.)
- Push: no remote configured (`git remote -v` empty) — nothing to push
  to. Not a failure per AGENTS.md's "if a push fails, diagnose and
  report"; there is no push to attempt. Flag for the human: add a remote
  when ready to publish this repo.
