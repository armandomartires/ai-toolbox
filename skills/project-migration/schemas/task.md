---
kind: task
framework: project-migration
id_placeholder: TASK-XXXX
title_placeholder: Title
filename_pattern: tasks/{id}-{name}.md
title_pattern: {id} — {title}
superseded: Preconditions, Dependencies, Expected result
allow_extra: true
max_lines: 90
---

# v2 (ADR-0033). One task, one module: identification first, the procedure
# next, then the record. The v1 shape is frozen in ai-toolbox's
# tests/legacy-schemas/task-v1.md. allow_extra: a spike may add a section.

## Status
!phase before
!required true
!terse
identification: status, owner, dates, applicability, source
!standard
Status is one of planned, ready, in_progress, blocked, review, done,
cancelled. Keep Updated current. Applies to: components and environment.
Source: the B-###, PLAN, REVIEW or request this discharges.
!literal
Fill every field. Status: one word from planned, ready, in_progress,
blocked, review, done, cancelled. Dates: YYYY-MM-DD.
!body
- Status: planned
- Owner: agent
- Created:
- Updated:
- Applies to:
- Source:

## Objective
!phase before
!required true
!terse
what changes, and why now
!standard
One to three sentences: what this task changes and why now.
!literal
Write one to three sentences: (1) what will change, (2) why now.

## Inputs
!phase before
!required true
!terse
every artifact consumed, with its expected state
!standard
One row per artifact this task reads. Verify each state before starting.
!literal
One row per file, document or tool this task reads. Expected state is
specific: a version, a count, a passing suite. Check it before you start.
!body
| Artifact | Expected state |
|----------|----------------|
|          |                |

## Scope
!phase before
!required true
!terse
in and out, one bullet each
!standard
What is in, and what is deliberately out. Never leave Out empty.
!literal
List what this task does after "In:" and what it will not do after "Out:".
!body
- In:
- Out:

## Likely files
!phase before
!required true
!terse
a forecast, written before the work
!standard
The files you expect to touch, written before the work.
!literal
List the files you expect to create or change. Write it before starting.

## Execution plan
!phase before
!required true
!terse
numbered steps, one action each
!standard
Numbered, imperative, one action per step.
!literal
Number the steps. One action per step, each starting with a verb.
!body
1.

## Acceptance criteria
!phase before
!required true
!terse
observable checks
!standard
Observable checks someone absent could verify.
!literal
One checkbox per condition. Write what is observed, for example
"tests/validate.sh exits 0", never "it works".
!body
- [ ]

## Mandatory validations
!phase before
!required true
!terse
the commands that must pass
!standard
The commands that must pass. Tick only what you ran.
!literal
Tick a box only after running that command and seeing it pass.
!body
- [ ] tests/validate.sh

## Risks and rollback
!phase before
!required true
!terse
at most three risks, then the rollback
!standard
At most three risks, then one Rollback line.
!literal
Up to three bullets naming what could break. Then "Rollback:" and how to
undo the change ("git revert the task commit" is valid).
!body
- Rollback: git revert the task commit

## Outputs / handover
!phase after
!required true
!terse
end state of every changed artifact, and where the next task starts
!standard
Written after the work: what each changed artifact now holds. Next: one line.
!literal
After the work, one row per file created or changed. Then replace the
text after "Next:" with the state the next task starts from.
!body
| Artifact | End state |
|----------|-----------|
|          |           |

Next:

## Execution log
!phase after
!required true
!terse
the record: result, evidence, deviation
!standard
One line per attempt, then the evidence. Git holds the commit (ADR-0033).
!literal
Append one block per attempt; never edit an earlier one. Evidence is the
command and what it printed, not the word "passed".
!body
- YYYY-MM-DD · agent/model · result in one line
  - Evidence: `command` → `output`
  - Deviation: none
