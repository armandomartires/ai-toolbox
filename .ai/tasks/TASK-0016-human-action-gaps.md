# TASK-0016 — Close the human-action gaps: procedures, not candidate bullets

## Objective
Convert the two remaining items that an agent cannot complete into either a
written procedure a human can execute, or a recorded decision — so they
stop recycling through every sprint's candidate list as though they were
pending agent work.

## Minimal context
Two items have now appeared in three consecutive candidate lists
(REVIEW-0003 → S2, REVIEW-0004 → S3, REVIEW-0005 → S4):

1. **LM Studio UI verification of the ansible server.**
   `configs/lm-studio/README.md:74-76` is admirably precise about what was
   and was not verified: the `mcpServers` schema was confirmed against the
   real file, and the exact launch command completed an MCP `initialize`
   handshake returning `serverInfo: {"name": "ansible-mcp-server"}`. Not
   verified: the server appearing in LM Studio's own UI tool list.
   `SPRINT-CURRENT.md` correctly notes this "needs a human with the GUI
   open. Not agent work."

2. **Exercising the authored (Python) MCP server shape.** Only
   `mcp-servers/_template/` uses it; `tests/smoke-mcp.sh` handles external
   manifests only. Half the MCP convention has never run. The constraint
   recorded against it: "Needs a real reason to author a Python server, not
   a synthetic one."

The defect is that both sit in a list titled *candidates for the next
sprint*, implying they are queued work. One needs a human at a GUI; the
other needs a use case that does not exist yet. Neither will ever be picked
up by an agent, so each re-appearance is noise that makes the genuinely
actionable items harder to see. The user's instruction was explicit: guide
how to close the gap, and write the documentation down.

Relevant observed state: `/mnt/c/Users/<user>/.lmstudio/mcp.json` currently
contains `{"mcpServers": {}}` — TASK-0006 restored it byte-for-byte after
testing. So UI verification is not merely "look at the app"; the entry has
to be added first.

## Scope
### Included
- A step-by-step **verification procedure** in `docs/operations/runbook.md`
  for confirming an MCP server in LM Studio's UI: what to add, where, what
  a pass looks like, what a failure looks like, and how to record the
  result. Written so the human does not have to reconstruct the context.
- ADR-0010: the authored (Python) MCP shape stays unexercised **by
  decision**, with the trigger that would change that.
- Remove both from the candidate list, replacing them with pointers to the
  procedure and the ADR.

### Not included
- Performing the LM Studio UI verification. It needs the GUI; an agent
  claiming it did this would be fabricating a result.
- Writing the entry into the live `mcp.json`. That is a change to the
  human's app config outside the repo; the procedure tells them what to
  paste, and `configs/lm-studio/README.md` already holds the exact JSON.
- Authoring a Python MCP server. ADR-0010 records why a synthetic one is
  worse than an honest gap.
- Removing the "Not verified" caveat from `configs/lm-studio/README.md`.
  It is accurate and must stay until someone actually verifies it.

## Preconditions
- TASK-0015 landed (remote exists, so the task can be pushed).

## Likely files
- `docs/operations/runbook.md`
- `.ai/decisions/0010-python-mcp-shape-unexercised.md`
- `.ai/planning/SPRINT-CURRENT.md`, `.ai/planning/ROADMAP.md`
- `configs/lm-studio/README.md` (pointer to the procedure only)

## Execution plan
1. Write the LM Studio procedure from observed facts — the real config
   path, the current empty contents, the exact JSON already in
   `configs/lm-studio/README.md`.
2. Write ADR-0010 with an explicit trigger condition.
3. Rewrite the candidate list so every remaining entry is genuinely
   actionable by whoever reads it next.

## Acceptance criteria
- [x] `docs/operations/runbook.md` contains a 6-step procedure a human can
      follow without re-reading any task file, including an
      interpretation table and how to record the result.
- [x] The procedure states the real config path
      (`/mnt/c/Users/<user>/.lmstudio/mcp.json`) and that it currently
      holds `{"mcpServers": {}}`.
- [x] ADR-0010 states the decision **and** the trigger that reopens it
      (a real need for an authored server, with three concrete follow-ups).
- [x] Neither item appears in the candidate list as pending agent work.
- [x] `configs/lm-studio/README.md`'s "Not verified" caveat is unchanged,
      with a pointer to the procedure appended.
- [x] No fabricated verification claim anywhere — the UI step is explicitly
      not performed.
- [x] `tests/validate.sh` passes.

## Mandatory validations
- [x] tests/validate.sh — OK
- [x] scripts/sync-registry.sh — registry unchanged as expected

## Risks and rollback
- Risk: the procedure drifts from LM Studio's actual UI as the app changes.
  Mitigation: it describes *what to look for* rather than exact pixel
  locations, and names the config file as the stable part.
- Risk: ADR-0010 reads as an excuse for not testing. Mitigation: state the
  concrete trigger, so it is a deferral with a condition rather than a
  permanent exemption.
- Rollback: revert; documentation-only.

## Dependencies
TASK-0015 (ordering only).

## Expected result
Every remaining open item is either actionable-by-agent, actionable-by-
human-with-a-written-procedure, or a recorded decision. Nothing sits in a
candidate list misrepresenting what it is.

## Status
- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
  (documentation complete; the LM Studio UI step is now a *human* action
  with a written procedure, deliberately not performed here)
- Owner: agent (documentation); human (executing the LM Studio procedure)
- Created: 2026-09-13
- Updated: 2026-09-13

## Execution log
### Attempt 1
- Date: 2026-09-13
- Agent: opencode
- Actions:
  - Added "Verifying an MCP server in LM Studio's UI (human procedure)" to
    `docs/operations/runbook.md`: 6 steps, an outcome-interpretation table,
    and explicit instructions to record a failure as a real result.
  - Wrote ADR-0010 with a concrete reopen trigger and three follow-ups the
    trigger implies.
  - Appended a pointer from `configs/lm-studio/README.md` to the procedure
    without touching its accurate "Not verified" caveat.
  - Added the roadmap's closing note, and a human-approval entry for
    changing remote visibility.
- Observations:
  - Checked the live config rather than assuming: `mcp.json` holds
    `{"mcpServers": {}}`. TASK-0006 restored it byte-for-byte, so the
    procedure has to *start* by adding the entry — "just open the app and
    look" would have been wrong guidance and wasted the human's time.
  - The strongest argument against a synthetic Python server came from this
    repo's own history: the `_template` registry leak needed fixing three
    times because tooling could not distinguish scaffolding from a real
    component. A synthetic server would be that problem again, but
    registered, deployed, and smoke-tested.
  - Deliberately did **not** relax Phase 2's "partly met" wording. It is
    accurate, and the runbook now says it should only change once the
    procedure has actually been run.
  - Anti-goal observed throughout: an agent must not report a GUI
    observation it cannot make. The honest outcome of this task is a
    procedure plus an unchanged caveat, not a closed checkbox.
- Validation:
  - `tests/validate.sh` OK; `scripts/sync-registry.sh` produced no diff.
  - Verified the procedure's config path and current contents by reading
    the real file, not from memory.
  - Documentation-only change; no behaviour to test for regression.
- Result: success. Every remaining open item is now one of: actionable by an
  agent, actionable by a human with a written procedure, or a recorded
  decision. Nothing remains in a candidate list misrepresenting itself.
- Commit: see below
- Push: to `origin master` (remote wired by TASK-0015)
