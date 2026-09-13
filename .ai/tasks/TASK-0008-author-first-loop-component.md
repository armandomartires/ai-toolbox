# TASK-0008 — Author the first loop component (`release-check`)

## Objective
Ship the first real loop component, exercising a component shape that has
existed as scaffolding since the repo was created and has never once been
used: `loops/_template/loop.md`, a registry "Loops" section, and one line
of authoring guidance. Add loop structure validation so the shape is
enforced rather than merely described.

## Minimal context
Sprint S1's objective named migrating "existing skills, MCP servers, and
**loops**". No loop was delivered. When S2 was scoped, a search of both
workspace roots, every sibling repo, `~/.config/opencode/`, `~/.claude/`,
`~/.codex/`, and `/mnt/c/Users/<user>/.agents/` found **no first-party
artifact in `loop.md` shape anywhere**. "Port a loop" was never an
available action — the verb encoded an unchecked assumption.

ADR-0006 decided loops are **authored** here, rejecting the three
near-candidates for three distinct reasons: `.agents/skills/loop` and
`babysit` are vendor-bundled third-party content; `bmad-workflow.md` is
first-party but canonically owned by `opencode-customization` and coupled
to OpenCode-specific agent names; `AGENTS.md`'s own work cycle is already
owned normatively by `AGENTS.md`.

Subject chosen: this repo's own **validate → sync-registry → review-diff
→ commit** cycle. Every S1 task performed it by hand, `AGENTS.md`'s Git
rules and Definition of done already describe its rules, and it is
therefore the one workflow here already proven to work. Writing it down
exercises the loop shape against reality instead of inventing a workflow
to justify a directory.

## Scope

### Included
- `loops/release-check/loop.md` — the component.
- `tests/validate.sh` — loop structure checks (frontmatter `name`/
  `description`, `name` matches directory, required sections present).
- `docs/development/authoring-guide.md` — expand the one-line Loops
  section into the actual required structure, matching the depth the
  skills and MCP sections now have.
- Regenerated `docs/registry.md` (first real Loops row).
- `.ai/context/CURRENT_STATE.md`, `.ai/planning/SPRINT-CURRENT.md`,
  `.ai/tasks/TODO.md`, backlog B-006 closure.

### Not included
- **Restating `AGENTS.md`'s rules inside the loop.** The loop states
  sequence, expected output per step, and exit conditions; it *links* for
  the rules. ADR-0006 names this as the task's main risk.
- **A second loop.** One real component is enough to exercise the shape.
- **`scripts/install.sh` changes.** Loops are not deployed to client
  directories; no client consumes `loop.md` today. If that turns out to
  be wrong, it is a separate task.
- **Automating the loop.** This is a described workflow an agent follows,
  not a shell script. `tests/validate.sh` and `scripts/sync-registry.sh`
  are the automation it invokes; the loop does not wrap them.
- **Porting `bmad-workflow.md` or vendoring third-party loops** — both
  rejected in ADR-0006, neither foreclosed for later.

## Preconditions
- Branch `master`, clean. S1 closed; ADR-0006 accepted.
- `loops/_template/loop.md` exists as the copy-from source.

## Likely files
- `loops/release-check/loop.md` (new)
- `tests/validate.sh`
- `docs/development/authoring-guide.md`
- `docs/registry.md` (regenerated)
- `.ai/context/CURRENT_STATE.md`, `.ai/planning/{SPRINT-CURRENT,BACKLOG}.md`,
  `.ai/tasks/TODO.md`

## Loop structure to enforce
Derived from `loops/_template/loop.md`, which is the existing convention —
do not invent a new one:

| Element | Rule |
|---------|------|
| Frontmatter `name` | Required; must match the directory name. |
| Frontmatter `description` | Required; one line, drives registry + selection. |
| `## Trigger` | Required. What starts the loop. |
| `## Steps` | Required. Numbered, each with its expected output. |
| `## Exit conditions` | Required. Both success *and* failure paths, failure including retry bound or escalation. |

A loop without exit conditions is the failure mode worth catching: it is
an unbounded instruction, which is how an agent ends up retrying forever.

## Execution plan
1. Copy `loops/_template/loop.md` to `loops/release-check/loop.md` and
   write the real content: trigger, steps with expected outputs, exit
   conditions with a retry bound and an escalation path.
2. Keep it lean and link rather than restate — cite `AGENTS.md`'s Git
   rules / Definition of done and `tests/validate.sh` instead of copying
   their content.
3. Extend `tests/validate.sh` with the loop checks above, skipping
   `_template*` for the name-matches-directory rule exactly as the MCP
   check does (the template cannot satisfy it).
4. Expand the authoring guide's Loops section to document the structure
   normatively.
5. Regenerate the registry; confirm `release-check` appears and no
   template does.
6. Prove each new check fails on a deliberately broken fixture, then
   remove the fixtures.
7. Close backlog B-006; update planning docs; validate; review diff;
   commit.

## Acceptance criteria
- [ ] `loops/release-check/loop.md` exists with all five required
      elements, and its `name` matches the directory.
- [ ] The loop links to `AGENTS.md` for rules rather than restating them —
      no rule text duplicated from `AGENTS.md` or the runbook.
- [ ] Exit conditions cover success *and* failure, with a retry bound and
      an escalation path.
- [ ] `tests/validate.sh` rejects: missing `name`, missing `description`,
      `name`≠directory, and each missing required section.
- [ ] Authoring guide documents the loop structure at the same depth as
      the skills and MCP sections.
- [ ] `docs/registry.md` lists `release-check` under Loops; no template
      appears in any table.
- [ ] Backlog B-006 marked done, with its verb corrected from "port" to
      "author" for the record.

## Mandatory validations
- [ ] `bash tests/validate.sh` — passes.
- [ ] **Fails-when-broken proof**, each observed failing for its own
      expected reason, then removed:
      1. loop dir with no frontmatter `name`;
      2. no frontmatter `description`;
      3. `name` not matching the directory;
      4. missing `## Trigger`;
      5. missing `## Steps`;
      6. missing `## Exit conditions`;
      7. a fully valid loop — must **pass**, proving the checks are not
         failing unconditionally.
      Record each observed message.
- [ ] `bash scripts/sync-registry.sh`; `git diff docs/registry.md` shows
      only the new Loops row.
- [ ] `bash scripts/install.sh link` — unchanged behaviour, still clean.
- [ ] **Dogfood check:** follow `release-check` itself to close this task.
      If the loop cannot be followed for its own commit, it is wrong —
      record where it failed and fix it rather than shipping a workflow
      that does not survive first use.
- [ ] `git status` clean at end.

## Risks and rollback
- **Risk: duplicating `AGENTS.md`.** Highest-probability failure, named in
  ADR-0006. A loop that restates the Definition of done creates a second
  owner that will drift. Mitigated by the link-not-restate criterion and
  by keeping the loop to sequence + exit conditions.
- **Risk: the loop is write-only documentation** nobody follows. Mitigated
  by the dogfood check — its first use is this task's own commit.
- **Risk: over-fitting validation to one loop.** Only one real loop exists,
  so the checks could encode `release-check`'s shape rather than the
  template's. Mitigated by deriving the rules from
  `loops/_template/loop.md`, which predates this task.
- **Rollback**: `git revert` this task's commit. `loops/` returns to
  template-only and the loop checks disappear; no other component depends
  on them.

## Dependencies
Depends on ADR-0006 (authored, not ported). Independent of TASK-0009.
Closes backlog B-006.

## Expected result
The `loops/` shape stops being an untested claim: one real component
exists, the registry lists it, validation enforces its structure, and the
workflow it describes was used to ship itself.

## Status
- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-13
- Updated: 2026-09-13
## Execution log
### Attempt 1
- Date: 2026-09-13
- Agent: opencode (anthropic/claude-opus-5)
- Actions: wrote `loops/release-check/loop.md` (8 steps, each with an
  expected output; exit conditions covering success, a 3-attempt bound,
  and four escalate-without-retry cases); added loop structure validation
  to `tests/validate.sh`; expanded the authoring guide's Loops section
  from one line to the full normative structure; regenerated the registry;
  closed backlog B-005/B-006.
- Bug found and fixed: **the loops registry loop leaked its template
  too** — `template-loop` appeared in `docs/registry.md` alongside the new
  real loop. This is the *third* instance of the same defect (MCP loop
  fixed in TASK-0005, skills loop in TASK-0006). Fixed here rather than
  filed, so all three registry loops now skip `_template*` and the
  registry contains no template rows at all — verified by grep.
- Observations:
  1. The loop's subject was chosen so the shape is exercised against
     something already proven: this repo's own validate → review → commit
     cycle, performed by hand in every S1 task. Inventing a workflow to
     justify the directory would have tested nothing.
  2. Step 4 ("verify the effect, not the exit code") and step 2 ("prove
     new checks bite") are direct encodings of S1's two recurring
     defects. The loop is where those lessons become repeatable rather
     than living only in a review document.
  3. Kept the link-not-restate rule: the loop cites `AGENTS.md`, the
     runbook, and the task file for rules and states only sequence and
     exit conditions. It explicitly declares `AGENTS.md` wins on conflict.
- Validation:
  - `bash tests/validate.sh` → OK.
  - **Fails-when-broken proof**, all six checks observed failing for their
    own expected reason, then a valid case passing (so the checks are not
    failing unconditionally), then fixtures removed and a final pass:
    - missing name → `MISSING name: loops/fixture-loop/loop.md`
    - missing description → `MISSING description: ...`
    - name mismatch → `NAME MISMATCH: ... declares 'wrong-name' but directory is 'fixture-loop'`
    - no `## Trigger` → `MISSING SECTION '## Trigger': ...`
    - no `## Steps` → `MISSING SECTION '## Steps': ...`
    - no `## Exit conditions` → `MISSING SECTION '## Exit conditions': ...`
    - valid fixture → `validate.sh: OK`, exit 0
  - `bash scripts/sync-registry.sh` → `release-check` listed under Loops;
    `template-loop` removed; `grep` confirms no template row in any table.
  - `bash scripts/install.sh link` → unchanged, still clean.
  - **Dogfood check: passed.** This task was closed by following
    `release-check` itself — validate (step 1), prove the new checks bite
    (step 2), regenerate the registry and inspect its diff (step 3),
    secret scan (step 5), review the staged diff (step 6), record the log
    (step 7), commit and write back the hash (step 8). Step 3 is what
    surfaced the template-loop leak, and step 6 is what caught it before
    the commit — the loop found a real defect on its first use.
- Result: success.
- Commit: see below.
- Push: no remote configured — nothing to push.
