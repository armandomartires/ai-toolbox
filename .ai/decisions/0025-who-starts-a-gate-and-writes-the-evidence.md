# ADR-0025 — The driver starts a gate where it has a shell; the entry point writes the evidence

## Status
Accepted — 2026-09-24. **The decision is the human's**, taken by choosing
among stated options (`TASK-0089`); this ADR records it. It resolves a
disagreement between four artifacts that `TASK-0086` found and `TASK-0087`
resolved the opposite way.

## Context
The unattended-run harness says, in four places, who starts a gate and who
writes the run's evidence file, and the four did not agree:

- `loops/unattended-run/loop.md` step 7 made the `gate-runner` the actor and
  had it *writing every outcome to the run's evidence file*;
- `agents/gate-runner/` agreed it runs the entry point, but said the evidence
  file is written by that command, "not by you typing it back";
- `ADR-0022` ("two things the port makes better") argued the *driver* can run
  the gate from its own map, so no agent ever sees a command string — making
  rule 2 structural;
- `skills/unattended-ops/references/gate-map.md` and `references/evidence.md`
  had the driver invoke and the gate-runner write the evidence.

The two bindings then split on the first question for a reason each could
state: the OpenCode driver has a shell and invokes; a Claude Code Workflow
script has none, so its gate-runner does. Both already had the entry point
write the evidence. Each binding listed the split as its deviation 1 and
named it a finding for the human.

## Decision

1. **Who starts a gate.** The **driver**, through the binding's one entry
   point, **wherever it has a shell**. Where the driver has none, the
   **`gate-runner`** starts it through the same entry point, by gate name and
   handle, and is never handed a command string. The same shape loop step 12
   uses for the journal — *"run-scribe, or the driver where it has filesystem
   access"*.
2. **Who writes the evidence file.** **The entry point**, as each gate
   finishes — the gate's own line, verbatim. The `gate-runner` reads the
   evidence file and reports from it; **it never writes it**, whichever of the
   two started the gate.

## Consequences
- **Both bindings conform as built.** Neither needs code changes; their
  deviation 1 is resolved rather than tolerated.
- **Rule 2's strength now depends on the client, and the rule says so.**
  Structural where the driver invokes (OpenCode: no agent sees a command);
  instructed where the gate-runner must (Claude Code: it has file tools and
  could open the map). `ADR-0022`'s argument holds wherever it can; this ADR
  does not pretend it holds everywhere.
- **Decision 2 closes a path for invention.** An agent that writes the
  evidence file can make it agree with a claim; the evidence rule
  (`references/evidence.md`) needs the line to come from the gate itself.
- **Left open, as a finding rather than a decision:** `agents/gate-runner/`
  still allowlists `*run-gate.sh*`. Under decision 1 an OpenCode gate-runner
  never needs to run it, so its boundary is wider than its job there.
  Narrowing it would change a role's permissions and is the human's call.
  **Resolved 2026-09-24 by the human: kept**, with the reason stated in the
  role file — the pattern names only the gate script, and a driver-less
  binding needs it.
