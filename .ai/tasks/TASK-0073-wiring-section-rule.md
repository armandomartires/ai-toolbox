# TASK-0073 — When an MCP server owes a per-client wiring section, and when it does not

## Objective

Close `B-023` by writing the rule it is blocked on — *"does **every**
`mcp-servers/` entry owe three client sections?"* — as a **conditional** rule,
gating the half of it that is mechanically decidable, and recording graphify
as deliberately exempt rather than overlooked.

## Minimal context

`B-023` was raised 2026-09-23 by `TASK-0051`, from **a seam between two
briefs rather than an oversight by either**: `TASK-0049` excluded graphify's
client-native surface as belonging to `TASK-0050`'s category, and
`TASK-0050`'s scope excluded graphify. Neither brief owned it, and the gap is
visible only once both had run.

The symptom: `ansible` has a wiring section in all three
`configs/*/README.md`; graphify has none — so `configs/` and
`docs/registry.md` disagree about how many MCP servers a reader is expected
to wire.

**The item refused to be fixed by writing the three missing sections**, and
its reasoning is the reason this task exists: *"writing three sections before
deciding [the rule] would set the precedent by accident."* It also argued the
substantive difference — graphify declares no required environment variables
and no destructive tools, so `scripts/install.sh`'s generic manifest output
*is* most of what a section would say, where ansible's sections exist largely
to carry a `WORKSPACE_ROOT` warning and a disabled-tool instruction that have
no counterpart here.

**Human decision, 2026-09-23: the conditional rule.** A section is owed only
when a server has required environment variables, destructive tools, or a
launch a client cannot perform from the manifest alone.

**Measured before writing the rule, so it describes reality rather than
hopes:** `ansible` → `required_env=['WORKSPACE_ROOT']`, `destructive=True`,
mentioned 16/14/22 times across the three snapshots. `graphify` →
`required_env=[]`, `destructive=False`, mentioned **0** times in all three.
The rule as decided therefore changes no file's content — it explains the
arrangement that already exists, which is the honest reason to believe it
rather than a reason to doubt it.

**The closest call, recorded rather than smoothed over.** graphify's launch
*is* working-directory sensitive: its own manifest says the graph resolves
from the server's working directory, so a client launching it elsewhere
serves a different graph or fails. That is genuinely non-obvious. It does
**not** trigger the third condition, because the manifest already carries it
as a `precondition` and `install.sh` prints all of them verbatim for every
client — it is not per-client knowledge. Anyone re-reading this should re-run
that judgment rather than inherit it.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `docs/development/authoring-guide.md` | `TASK-0051` | MCP servers section; `server.json` schema; "Placing a third-party extension" with its Gated column of *no* |
| `tests/validate.sh` | `TASK-0005`, `TASK-0018` | Manifest checks at ~line 156; config-pairing check at ~line 643 |
| `mcp-servers/ansible/server.json` | `TASK-0007`, `TASK-0026` | `WORKSPACE_ROOT` required; `destructive: true` |
| `mcp-servers/graphify/server.json` | `TASK-0049` | No required env; `destructive: false`; `smoke_test.requires_paths` |
| `configs/*/README.md` | `TASK-0006`, `TASK-0050` | An `## MCP servers` section with an `### ansible` subsection in each |

**Verify the expected state; don't assume it.** `mcp-servers/_template-external/`
carries a manifest with a *required* variable and must be excluded from any
gate, the same `_template*` carve-out every other loop makes.

## Scope

### Included

- The conditional rule in `docs/development/authoring-guide.md`, with its
  three triggers, what exempt means, and the graphify judgment.
- **A gate for the decidable subset**: a non-template server whose manifest
  declares a required environment variable **or** `capabilities.destructive`
  must be named in **every** `configs/*/README.md`. Observed failing first.
- One pointer line in each `configs/*/README.md` MCP section, so a reader
  seeing no graphify subsection reads a rule rather than an omission. A
  pointer, not a copy — the rule has one owner.
- `B-023` closed with the graphify judgment recorded.

### Not included

- **Writing graphify wiring sections.** That is what the decision rejected.
- **Gating the third trigger.** "A launch a client cannot perform from the
  manifest alone" is a judgment call, and the guide's existing stance is that
  a check which cannot really decide is a check that cannot fail — this
  repo's most-repeated lesson. Stated as a rule for a human, not a check.
- graphify's **OpenCode-native** surface (`graphify opencode install`).
  `B-023` says explicitly it is a separate question and must not be conflated
  with MCP wiring in one section.
- Any change to `docs/registry.md`'s columns — that is `B-026`/`TASK-0060`.

## Likely files

- `docs/development/authoring-guide.md`, `tests/validate.sh`
- `configs/claude-code/README.md`, `configs/opencode/README.md`,
  `configs/lm-studio-bionic/README.md`
- `.ai/planning/BACKLOG.md`, `.ai/tasks/TODO.md`, `.ai/context/CURRENT_STATE.md`
- **Not** any `server.json`, and **not** `docs/registry.md`.

## Execution plan

1. Re-measure both manifests and the three snapshots. (Done while scoping;
   re-confirm before writing.)
2. Write the rule in the guide.
3. Add the gate; **prove it fails** with a scratch server whose manifest
   declares a required variable and which no snapshot mentions. Confirm the
   `_template*` carve-out by checking the template does not trip it.
4. Confirm the gate **passes** on the real tree, and that it would have
   fired had ansible's sections been missing.
5. Pointer lines in the three snapshots.
6. `tests/validate.sh`, `scripts/sync-registry.sh`, remove the fixture,
   verify removal, diff, commit, push.

## Acceptance criteria

- [ ] The guide states the three triggers, what exempt means, and why
      graphify is exempt despite a working-directory-sensitive launch.
- [ ] The gate fails on a fixture server that owes a section and has none —
      **observed**, with the message recorded here.
- [ ] The gate passes on the real tree, and `_template-external` does not
      trip it despite declaring a required variable.
- [ ] Each `configs/*/README.md` tells a reader why some servers have no
      subsection, by pointing at the rule rather than restating it.
- [ ] No graphify wiring section was written.
- [ ] Fixture removed, removal verified.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `scripts/sync-registry.sh` (expect no diff)
- [ ] `git status --porcelain`

## Risks and rollback

- **Setting the precedent by accident** — the risk `B-023` named. Mitigated
  by writing the rule first and letting it explain the existing arrangement,
  rather than writing sections and calling the result a rule.
- **A gate that cannot fail.** Mitigated by proving the failure with a
  fixture before trusting the pass, and by *not* gating the judgment trigger.
- **Over-gating**: requiring sections for servers that genuinely need none
  would make the gate an obstacle and invite a carve-out. Mitigated by gating
  only required-env-or-destructive, which is exactly what ansible's sections
  carry.
- Rollback is `git revert` of one commit.

## Outputs / handover

*Forecast until verified — this section describes an intention until the
execution log below records otherwise.*

| Artifact | End state |
|----------|-----------|
| `docs/development/authoring-guide.md` | The conditional rule, its triggers and the graphify judgment |
| `tests/validate.sh` | One new check, observed failing before passing |
| `configs/*/README.md` | A pointer each; **no graphify section**, deliberately |
| `mcp-servers/graphify/server.json` | **Unchanged** |

**Next task starts here**: the backlog's unscheduled queue is `B-025` and
`B-027` only. S9's spikes (`TASK-0055`, `TASK-0056`) are the next work.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log
### Attempt 1
- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context)
- Actions:
  1. Measured both manifests and all three snapshots **before** writing the
     rule, so it would describe the tree rather than prescribe to it.
  2. Rule into `docs/development/authoring-guide.md` as a three-trigger
     table with a Gated column, plus the graphify judgment.
  3. Gate into `tests/validate.sh` for the two decidable triggers.
  4. One pointer paragraph into each `configs/*/README.md`, linking the rule
     rather than restating it.
- Observations:
  - **The rule changes no file's content.** `ansible`:
    `required_env=['WORKSPACE_ROOT']`, `destructive=True`, present in all
    three snapshots. `graphify`: neither, present in none. The rule explains
    the existing arrangement — which is why it is believable, and why this
    task wrote no graphify sections.
  - **Gate observed failing** on a fixture server declaring a required
    variable with no section: three `MISSING wiring section` failures, exit
    1. Removed; back to OK.
  - **The `_template*` carve-out is load-bearing, not decorative.**
    `_template-external`'s manifest declares a **required** `EXAMPLE_VAR` and
    is named in **no** snapshot, so without the carve-out the gate would fail
    on a clean checkout — `ADR-0009`'s forbidden shape, in a check written to
    enforce documentation.
  - **A check I wrote and then had to tighten, which is the finding worth
    keeping.** The first version matched the server name **anywhere in the
    file**. In the same task I then added a pointer paragraph naming graphify
    *in order to explain that it has no section* — so under the first
    version, the sentence saying "there is no section" would have satisfied
    "there is a section". Tightened to require a **heading**, and the
    tightening was **proved load-bearing**: a fixture mentioned in prose with
    no heading still failed all three. A check a passing mention can satisfy
    is a check that cannot fail.
  - **Process error, recorded because it cost work.** To undo the fixture
    lines I ran `git checkout -- configs/*/README.md` while my three pointer
    edits were **uncommitted**, and discarded them. Nothing of the user's was
    lost and nothing committed was touched, but the safe move was to strip
    the appended lines rather than reach for a destructive git command with
    unstaged work in the tree. Pointers rewritten and re-verified.
- Validation:
  - `tests/validate.sh` — **OK**, before and after the tightening
  - `scripts/sync-registry.sh` — no diff
  - `git status --porcelain` — fixture directories removed; no leaked
    fixture text in `configs/` (grepped)
- Result: **done.** `B-023` closed by writing the rule, not the sections.
- Commit: *pending — recorded in the follow-up commit*
- Push: *pending*
