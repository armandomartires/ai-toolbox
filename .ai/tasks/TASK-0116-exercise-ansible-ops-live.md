# TASK-0116 — Exercise skills/ansible-ops against the live estate, once

## Objective

Run `skills/ansible-ops/` and `loops/ansible-change/` against the real Ansible
estate they were written from, and record what happens. The skill has **never
been executed in the estate it describes** — `B-010` was closed on 2026-09-16
*with that limitation stated*, and `CURRENT_STATE.md` carries it as "treat as
unexercised scaffolding". This is item 7 of `SPRINT-CURRENT.md`'s carried
queue. Now, because the estate has grown from 2 playbooks to 17 since the skill
was derived from it, so the gap between what the skill describes and what is
there is widening while the skill sits unexercised.

## Minimal context

**What "closed with the limitation stated" means here.** `B-010`'s backlog row
is explicit: under Option (a) the skill was authored **from** the target estate
and **never executed in it**, "so it carries the same status as
`mcp-servers/_template/` — *treat as unexercised scaffolding*." The row then
draws the distinction this task turns on: "What *was* exercised is the pair of
loops that produced it, which is a different claim". And it closes with the
sentence that makes this a real piece of work rather than a formality: "**The
gap this item named is filled; whether it is filled *well* is not something a
backlog row can assert.**"

**The skill's shape.** `SKILL.md` defines **nine gates**. Gates 1–5 are
read-only. **Gate 7 is the only gate that changes the estate**, and the skill's
own argument is that permission is not monotonic across the nine: gate 8 reads
state, so it is narrower than the apply it follows, and gate 9 only writes a
file. Supporting material: `references/hazards.md`,
`references/check-mode-fidelity.md`, `references/derivation.md`;
`scripts/check-change-record.sh` and `scripts/gather_subset_guard.py`;
`templates/change-record.md`.

**The hazard is real and it is not hypothetical.** The estate's `ansible.cfg`
carries the longest comment in the file about it: `ansible.builtin.setup`'s
default fact-gathering collects `ansible_mounts`, which stats every mount point
including `/etc/pve`; on a node with wedged pmxcfs that is an uninterruptible
FUSE hang, and "`timeout` cannot kill an uninterruptible D-state wait." The
estate's own `tests/test_mounts_hazard.py` enforces protection on every play
targeting a PVE host. The cluster is recorded there as running at **3-of-4
quorum with no verified margin**, and `forks = 2` is set because five
concurrent SSH logins were observed to overwhelm a recovering `pvedaemon`.

**Therefore this task cannot be agent-authorized past gate 5.** `AGENTS.md`:
"Deletions, overwrites, history rewrites, and force-pushes require explicit
human authorization in the task file", and MCP servers "must not expose
destructive capabilities without explicit human authorization in the task
file". A change against a 3-of-4 cluster is squarely that.

**So the task is deliberately split**, and the split is the design, not a
hedge. Gates 1–5 are read-only and can run now. Gates 6–9 need a human to
authorize a specific change against specific hosts, in this file, before they
run. This is `TASK-0016`'s established shape in this repo — the agent writes
the procedure, the human executes or authorizes, the agent records the evidence
(`TASK-0017`) — and it is recorded in `TODO.md` as "the intended shape".

**What counts as a result.** The point is not a green run. `TASK-0027` is the
precedent: its spike inverted its own brief's expectation, and the inversion
changed a downstream decision. The interesting outcomes here are the places the
skill's nine gates do not fit what the estate actually requires.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/ansible-ops/SKILL.md` | TASK-0046 | Nine gates; gate 7 the only estate-changing one; never executed against the estate |
| `skills/ansible-ops/references/hazards.md` | TASK-0046 | Correct as of `TASK-0108`, which checked it and did not touch it |
| `skills/ansible-ops/scripts/check-change-record.sh` | TASK-0046 | Present; validates a filled `change-record.md` |
| `skills/ansible-ops/scripts/gather_subset_guard.py` | TASK-0031 | Present; the one S6 deliverable validated against real playbook content |
| `skills/ansible-ops/templates/change-record.md` | TASK-0046 | Present; nine fields, each mapping to a gate |
| `loops/ansible-change/loop.md` | TASK-0046 | Present |
| `/home/armando.martires/SIGMA-infrastructure/` | pre-existing, separate repository | **17** playbooks, **19** roles; clean at `2a6be9a`; `forks = 2`; `become = False` except the domain controller — all confirmed 2026-09-27 |
| `~/.venvs/sigma-ansible/bin/ansible` | pre-existing | `ansible [core 2.21.4]`, confirmed by running it 2026-09-27. Not on `PATH` |
| Human authorization for gates 6–9 | **not yet given** | Must be written into the Authorization section below before phase 2 starts |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Authorization

**Gates 6–9 are NOT authorized.** Phase 2 does not begin until a human writes
into this section: the specific change, the specific hosts or groups, the
`--limit` that bounds it, and a dated signature. An agent must not fill this in
on its own behalf, and an approval given elsewhere in conversation does not
count — `AGENTS.md` requires it **in the task file**.

Gates 1–5 are read-only and are authorized by this task's existence. They still
connect to hosts at gate 4, so the hazard review at gate 1 governs them.

- Change authorized: *(unfilled)*
- Hosts / `--limit`: *(unfilled)*
- Authorized by: *(unfilled)*
- Date: *(unfilled)*

## Scope

One exercise of the skill, in two phases, with the second gated on a human.

### Included

**Phase 1 — gates 1 to 5, read-only.**
- Run the skill's obligation set against a real, small, chosen change.
- Gate 1: derive the hazard class and the bounded `--limit` from the estate's
  own inventory, following the skill rather than improvising.
- Gates 2–3, then gate 4: `--check --diff` against the bounded target.
- Gate 5: a fidelity verdict **per module**, per `references/check-mode-fidelity.md`.
- Record, for each gate, whether the skill's instruction was followable as
  written, and where it was not.

**Phase 2 — gates 6 to 9, only if authorized above.**
- Snapshot, apply, verify, close the record.
- `scripts/check-change-record.sh` run against the filled record.

**Both phases.**
- A completed `change-record.md`.
- One backlog item per place the skill did not fit reality.

### Not included

- **No change to `skills/ansible-ops/` during the run.** Fixing the skill while
  exercising it destroys the measurement — the same rule `TASK-0113` inherits
  from `TASK-0092`. Findings are recorded; fixes are separate tasks.
- **No phase 2 without the Authorization section filled by a human.**
- **Nothing against a PVE node whose cluster state has not been checked first**,
  given the recorded 3-of-4 quorum with no verified margin.
- **No increase to `forks`.** It is 2 for a documented, reproduced reason.
- **No re-derivation of the skill for the 15 new playbooks.** That is a
  different task; this one exercises what exists.
- **Not `ADR-0014`'s lint figure** — that is `TASK-0115`.
- **No edit to the estate's governance files**, including its stale
  `ansible.cfg` comments.

## Likely files

- `.ai/tasks/TASK-0116-exercise-ansible-ops-live.md` — this file, with the
  completed change record inline or linked
- `.ai/planning/BACKLOG.md` — one item per misfit found
- `.ai/context/CURRENT_STATE.md` — a dated section
- `.ai/planning/SPRINT-CURRENT.md` — item 7 updated
- Possibly `.ai/decisions/` — a new ADR, if the run shows a gate is wrong rather
  than merely awkward

In the estate repository: only whatever the authorized change itself touches,
and nothing else.

## Execution plan

1. Record the estate's `git rev-parse HEAD`, `git status --porcelain`, and the
   `ansible` version from an actual run.
2. Check cluster health before anything connects, by a method independent of
   Ansible — the estate's own `tools/pve_verify_cluster.py` shape. A 3-of-4
   quorum with no margin is the recorded normal, not a reason to stop, but it
   must be observed rather than assumed.
3. Choose the candidate change. Prefer the smallest real one available.
4. Open `templates/change-record.md` and work the gates **in order**, filling
   each field as its gate is performed. Do not fill a field ahead of its gate.
5. Gate 1: hazard class and bounded `--limit`, derived from the inventory.
   Record the derivation, not just its output.
6. Gates 2–3, then gate 4 (`--check --diff`, bounded). Capture raw output.
7. Gate 5: a per-module fidelity verdict. Where a module does not implement
   check mode faithfully, say so — a clean diff there is silence, not proof.
8. **Stop.** If the Authorization section is unfilled, write up phase 1, raise
   the findings, and leave the task `blocked`. That is a complete outcome.
9. If authorized: gates 6–9, snapshot first, then apply, verify, close.
10. Run `scripts/check-change-record.sh` against the record.
11. Write up every place the skill's text did not survive contact.

## Acceptance criteria

- [ ] Every gate attempted has a recorded outcome and the raw command output
      behind it.
- [ ] The gate-1 derivation of the `--limit` is recorded as a derivation, and
      the bound was actually applied at gate 4.
- [ ] Gate 5 has a **per-module** verdict, not one verdict for the play.
- [ ] Each of gates 1–5 carries an explicit note on whether the skill's
      instruction was followable as written.
- [ ] The cluster-health check at step 2 is recorded, with its method named.
- [ ] If phase 2 ran, the Authorization section is filled, dated and signed by a
      human, and the authorized `--limit` matches the one used.
- [ ] If phase 2 did not run, this task ends `blocked` with phase 1 written up —
      and that is recorded as a complete outcome, not a failure.
- [ ] `check-change-record.sh` exits 0 against the record, or its complaint is
      recorded and explained.
- [ ] `skills/ansible-ops/` is byte-identical to its pre-task state.
- [ ] The estate's `git status --porcelain` shows only the authorized change, or
      is empty if phase 2 did not run.

## Mandatory validations

- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed)
- [ ] `skills/ansible-ops/scripts/check-change-record.sh` against the record
- [ ] `git -C /home/armando.martires/SIGMA-infrastructure status --porcelain`, before and after
- [ ] `git -C ... diff --stat` of `skills/ansible-ops/` is empty

## Risks and rollback

- **An uninterruptible FUSE hang on a PVE node.** The estate's `ansible.cfg`
  documents it at length: default fact-gathering stats `/etc/pve`, and `timeout`
  cannot kill a D-state wait. Mitigated by gate 1's hazard review preceding any
  connection, by the bounded `--limit`, and by `gather_facts: false` or a
  `!mounts` subset on anything touching a PVE host. **This is why gate 1 is a
  gate and not a preamble.**
- **Overwhelming a recovering `pvedaemon`.** Five concurrent SSH logins were
  observed to do it. `forks = 2` stays.
- **Changing a production estate at 3-of-4 quorum.** Bounded by the
  Authorization section, by the snapshot at gate 6, and by step 8's hard stop.
- **Fixing the skill mid-run.** Guarded by the "Not included" section and by the
  byte-identical acceptance criterion.
- **A clean `--check` read as a guarantee.** The specific failure gate 5 exists
  to prevent; some modules do not implement check mode faithfully.
- **Rollback:** phase 1 writes nothing and needs none. For phase 2, the gate-6
  snapshot is the rollback, and an authorized change that cannot state its own
  rollback at gate 6 is not authorized. In this repository, `git revert` of the
  documentation commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          | what it now contains, plus anything deliberately *not* changed |

**Next task starts here**: one line naming the state the next task picks
up from — not a prediction of what that task will be. Record any
deviation from the Plan here too: the next task may have been scoped
against the original.

## Status

- Status: blocked   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: human
- Created: 2026-09-27
- Updated: 2026-09-27

Phase 1 (gates 1–5, read-only) is runnable by an agent now. Phase 2 (gates 6–9)
is blocked until a human fills the Authorization section above. Owner is
`human` because the task cannot complete without that act.

## Execution log

### Attempt 1

- Date:
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
