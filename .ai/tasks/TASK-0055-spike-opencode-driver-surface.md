# TASK-0055 — Spike: can OpenCode host an unattended driver, and can its permissions hold it?

## Objective

Settle three falsifiable claims about the installed OpenCode against the client
itself, so `ADR-0022` is ratified on evidence rather than on a reading of
vendor documentation. **Findings, not components.** No component file changes.

## Minimal context

`PLAN-0006` proposes an external driver script that calls
`opencode run --agent <role> --format json` once per stage. Three properties it
depends on cannot be settled from documentation, and one of them decides this
repo's agent **schema**:

- **F1** decides every role's `mode:` field. If `opencode run --agent` cannot
  select a `subagent`-mode role, every role becomes `primary` — or `all`, which
  `tests/validate.sh`'s `MODES = {"primary", "subagent"}` does not admit, so the
  authoring guide and the gate both change. Authoring nine roles before knowing
  this would mean authoring them twice.
- **F4** decides whether the closer's staging boundary exists at all. The
  harness forbids `git add -A`; `agents/git-ops/agent.md` currently allows bare
  `git *`, so **`git add -A` is permitted today** by the repo's own guarded git
  owner. Whether a narrower glob can express the distinction is a property of
  OpenCode's matcher, not of this repo.
- **F2** decides how a stage's structured return is extracted. The Claude
  Workflow runtime forces a schema; OpenCode has no equivalent, so the driver
  must parse.

`ADR-0018`'s closing warning governs the method here: three of its twelve
mapping rows **changed in four days**, and its instruction to a later reader is
to *re-verify rather than cite*. This spike verifies.

`ADR-0020`'s clause 6 governs the evidence standard: *"Directory-name inference
is not evidence — in either direction."* A claim is settled by a marker from a
run, or it is recorded as unsettled.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `opencode` binary | pre-existing | `1.18.31` at `~/.opencode/bin/opencode` — **re-check the version first**; the surface moved three times in four days during `TASK-0036` |
| `~/.config/opencode/agents/` | `scripts/emit-agents.py`, pre-existing | six emitted roles present, `git-ops.md` among them |
| `scripts/emit-agents.py` | pre-existing | the `VOCAB` table and its glob-ordering comments — the repo's existing knowledge of what a `permission` block means |
| `docs/development/authoring-guide.md` | pre-existing | the ten-term vocabulary and its per-client coverage table |
| `.ai/decisions/0018-*.md` | pre-existing | `Accepted`; clause 8 and its mapping table |
| A scratch project directory | this task | **outside** this repo and outside `asset-management` |

**Verify the expected state; don't assume it.** In particular re-read the
`opencode` version before trusting any row of ADR-0018's table.

## Scope

### Included

- **F1** — can `opencode run --agent <name>` select a role whose `mode:` is
  `subagent`? Test all three of `subagent`, `primary` and `all`. A silent
  fallback to the default agent is a *failure*, not a pass, so the fixture must
  make the acting agent identify itself.
- **F2** — what does `--format json` emit, and is the final assistant message
  extractable without parsing prose? Record the actual event shape.
- **F4** — does an allow-glob of the form `git add -- *` match
  `git add -- <path>` while `git add -A` and `git add .` fall through to
  `"*": deny`? Test the negative cases explicitly.
- Two secondary observations, cheap once the harness is up: whether
  `opencode run` accepts a prompt on stdin or only as an argument/`-f`, and what
  an `ask` permission does in a headless `run` **without** `--auto` (hang, or
  auto-deny). Both change the driver's failure handling.
- **A negative control for every claim.** A fixture proved able to *fail* before
  any passing result from it is trusted — the method `TASK-0036` used on
  `claude plugin validate`.

### Not included

- Writing the driver. Writing any role. Editing any component.
- Anything in `asset-management`.
- Claude Code's surface — that is `TASK-0056`, deliberately parallel.
- Changing `agents/git-ops/agent.md`, even though this spike is expected to
  confirm a real gap in it. Record it; `TASK-0064` fixes it.

## Likely files

Nothing in the component layer. Expect to touch only this task file and a
scratch directory outside the repo. If a component file changes, that is a
finding worth recording and probably a mistake.

## Execution plan

1. Re-read the `opencode` version and record it verbatim.
2. Create a scratch project outside both repos. Confine every fixture to it —
   `TASK-0036`'s fixtures were confined this way and the repo verified
   afterwards that no global agent directory had been polluted.
3. **F1**: three fixture agents differing only in `mode:`, each instructed to
   print its own name. Run each via `opencode run --agent`. Record which ran.
4. **F2**: capture raw `--format json` stdout for one trivial run. Record the
   event envelope verbatim, and identify the field carrying the final text.
5. **F4**: one fixture agent with the candidate `bash` map. Attempt
   `git add -- file`, `git add -A`, `git add .`, and `git add ./sub/file`.
   Record allow/deny for each. **`git add ./sub/file` is the case that decides
   whether a `git add .*` deny glob would swallow a legitimate explicit path.**
6. The two secondary observations.
7. Remove every fixture; verify the scratch directory and the real agent
   directories are as they were.
8. Write findings into this file with a per-claim marker.

## Acceptance criteria

- [ ] The `opencode` version is recorded verbatim, with the date.
- [ ] F1, F2 and F4 each carry a verdict of **confirmed / falsified /
      unsettled**, each with the command run and the observed output.
- [ ] Every claim has a negative control, and the control is shown to fail.
- [ ] Both secondary observations are recorded, or explicitly marked not reached.
- [ ] No component file changed; `git status --porcelain` shows only this task
      file.
- [ ] Fixtures removed and their removal verified, not assumed.
- [ ] Anything that could not be settled is recorded as **unsettled**, never as
      a reasoned conclusion.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `git status --porcelain` — this task file only

## Risks and rollback

- **Fixtures leaking into the real agent directories.** Confine to scratch;
  verify afterwards. This is the specific hazard `TASK-0036` named.
- **A malformed fixture emptying the agent list.** ADR-0018 records that one bad
  file made `opencode agent list` return **nothing at all**. If that happens,
  the fixture is the cause; remove it and re-check.
- **Concluding from silence.** `TASK-0048` records the control that saved it: a
  pre-existing working plugin logged nothing either, so silence was
  uninformative rather than a negative result. Apply the same test here.
- Rollback is deletion of the scratch directory. Nothing else is touched.

## Outputs / handover

*Forecast until verified — this section describes an intention until the
execution log below records otherwise.*

| Artifact | End state |
|----------|-----------|
| This task file | Carries F1, F2 and F4 verdicts with commands and observed output; the `opencode` version; both secondary observations; and anything unsettled, named as such |
| Component layer | **Unchanged**, deliberately |
| `agents/git-ops/agent.md` | **Unchanged**, even if the spike confirms `git add -A` is permitted. Recorded, not fixed |

**Next task starts here**: `TASK-0057` authors `ADR-0022` from this file and
`TASK-0056`, and cannot begin until both carry verdicts. If F1 is falsified,
`TASK-0058` gains a `mode`-row change and `TASK-0059` gains a `MODES` change —
say so here explicitly rather than leaving it to be inferred.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Findings

**`opencode` version, recorded verbatim, 2026-09-23:** `1.18.31`, at
`/home/armando.martires/.opencode/bin/opencode`. This is the version the
brief expected; re-read rather than assumed.

Fixtures lived in a scratch project outside this repo and outside
`asset-management`, under `.opencode/agent/`. Removed and removal verified;
neither `~/.config/opencode/agents/` nor `~/.claude/agents/` was polluted.

### F1 — can `opencode run --agent` select a `subagent`-mode role? **FALSIFIED**

Three fixtures differing **only** in `mode:`, each instructed to print its own
name, run with `-m opencode/nemotron-3.5-lightning-free --format json`:

| `mode:` | Selected? | Evidence |
|---|---|---|
| `subagent` | **NO** | stderr: `! agent "zzmode-subagent" is a subagent, not a primary agent. Falling back to default agent`. The text returned was opencode's **default** identity — *"I'm opencode, the interactive CLI assistant…"* — not `ZZMODE-ACTING-AS: zzmode-subagent`. |
| `primary` | **YES** | `ZZMODE-ACTING-AS: zzmode-primary`, stderr empty |
| `all` | **YES** | `ZZMODE-ACTING-AS: zzmode-all`, stderr empty |

The fixtures are **discriminating**, which is the control: the same shape
produced correct self-identification for two modes and the default agent's
identity for the third.

**The fallback warns on stderr but stdout looks entirely normal** — a driver
reading only stdout, or only the JSON event stream, gets a well-formed
successful answer from the wrong agent. Exit code was **0**.

**`mode: all` is a real, accepted third value.** `opencode agent list` reports
`zzmode-all (all)` alongside `(primary)` and `(subagent)`. This repo's
`tests/validate.sh` has `MODES = {"primary", "subagent"}` and would **reject**
it.

**Consequences, as the brief required them to be stated explicitly:**
- Every role an unattended driver invokes via `opencode run --agent` must be
  `primary` or `all`. A `subagent` role is not merely unselected — it is
  **silently replaced**.
- `TASK-0058` gains a `mode`-row change; `TASK-0059` gains a `MODES` change.
  Both were pre-committed in this brief and both are now owed.

### F2 — what does `--format json` emit? **CONFIRMED**

Newline-delimited JSON, one object per line. Top-level keys: `type`,
`timestamp`, `sessionID`, `part`. Event types observed: `step_start`,
`text`, `tool_use`, `step_finish`.

The final assistant message is extractable **without parsing prose**: take
events where `type == "text"` and read `part.text`. Verbatim:

```json
{
  "type": "text",
  "timestamp": 1790121199385,
  "sessionID": "ses_f347650b6ffey1NZ9xVua2reUe",
  "part": {
    "id": "prt_0cb89c620001TGLwIKmzmUTtGm",
    "messageID": "msg_0cb89b1a7001s0scSGChBEnN3P",
    "sessionID": "ses_f347650b6ffey1NZ9xVua2reUe",
    "type": "text",
    "text": "ZZMODE-ACTING-AS: zzmode-primary",
    "time": { "start": 1790121199136, "end": 1790121199360 }
  }
}
```

A denied tool call appears as a `tool_use` event with
`part.state.status == "error"` and a `part.state.error` string, so the driver
can distinguish refusal from failure structurally.

### F4 — the `git add` staging boundary. **CONFIRMED, with a constraint**

Fixture `permission.bash`: `{"*": "deny", "git status*": "allow",
"git add -- *": "allow"}`, in a real git repo with two modified files.

| Command | Outcome |
|---|---|
| `git add -- a.txt` | **PERMITTED** |
| `git add -A` | **DENIED** |
| `git add .` | **DENIED** |
| `git add ./sub/b.txt` | **DENIED** |

**The boundary the closer needs is expressible.** `git add -A` and `git add .`
both fall through to `"*": "deny"`, which is what the harness rule requires.

**But the fourth row is the one the brief said would decide something, and it
decides it against the comfortable answer.** `git add ./sub/b.txt` — a
perfectly legitimate explicit path — is **also denied**, because it lacks the
`--` separator. So the allowlist does not merely exclude the dangerous forms;
it **mandates the `--` form for every legitimate staging command**. Any role
carrying this boundary must be told to write `git add -- <path>` always, or it
will be blocked doing the right thing and may conclude staging is broken.

The denial is machine-readable: `part.state.error` carries *"The user has
specified a rule which prevents you from using this specific tool call"*
followed by the resolved rule list.

**Resolved rule order was confirmed independently of any run.**
`opencode agent list` prints each agent's fully resolved permission array, and
the emitter's documented ordering survives into it intact — `"*": deny` first,
then specifics shortest-to-longest, with `git push*: ask` **before**
`git push --force*: deny` so last-match-wins yields `deny`. The user's global
config contributes `{"permission": "*", "action": "allow", "pattern": "*"}`
as the **first** entry, and the agent's own rules come after it and win.

**Recorded, not fixed, per this brief's Not-included:** `agents/git-ops/agent.md`
resolves to `{"permission": "bash", "pattern": "git *", "action": "allow"}`,
so **`git add -A` is permitted for `git-ops` today**. `TASK-0064` fixes it.

### Secondary observations — both reached

1. **`opencode run` accepts a prompt on stdin.** `echo "…" | opencode run
   --agent zzmode-primary -m … --format json` with **no positional message**
   returned `ZZMODE-ACTING-AS: zzmode-primary`, exit 0. So the driver may pipe
   rather than argv-quote, which removes a whole class of escaping bugs.
2. **An `ask` permission in a headless `run` without `--auto` AUTO-DENIES; it
   does not hang.** Fixture with `bash: {"*": "ask"}` asked to run `echo`:
   exit **0**, tool status `error`, message *"The user rejected permission to
   use this specific tool call."*

   **The second half of that is a finding in its own right and matters for
   `PLAN-0006`.** No user was present, yet the refusal is attributed to one.
   A role carrying `push-requires-confirmation` running unattended will have
   its push denied and the log will say a human declined it. **In unattended
   mode every `ask` term is effectively `deny` with a misleading message** —
   `ADR-0022` should say so rather than leave a driver author to discover it.

### Unsettled — and why the first attempt proved nothing

**`opencode run` produced zero bytes on stdout *and* stderr and was killed by
`timeout` at 180s**, three times, before any result above was obtained. The
DEBUG log stalls immediately after `message=init`, having loaded every config
file without error.

**A `primary`-mode control stalled identically**, so the silence was
**uninformative about F1** rather than evidence for it — the exact trap
`TASK-0048` recorded, where a known-working plugin also logged nothing. Had
the control not been run, the honest verdict would have been *unsettled*, and
recording a falsification from that silence would have been wrong.

**Cause: no default `model` is configured** in
`~/.config/opencode/opencode.jsonc`, and `opencode run` has no TTY on which to
prompt for one. Passing `-m <provider/model>` explicitly returned results
immediately. **This is a driver-design finding, not an environment quirk:** an
unattended driver invoking `opencode run` **must** pass `-m` explicitly or
guarantee a configured default, or it hangs indefinitely with no output, no
error and no exit.

## Execution log
### Attempt 1
- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context)
- Actions: version re-read; scratch project created outside both repos;
  three `mode` fixtures, an F4 permission fixture and an `ask` fixture;
  `opencode agent list` used to read resolved permissions without a run;
  runs via `-m opencode/nemotron-3.5-lightning-free` (a free model) once the
  stall was diagnosed; fixtures removed and removal verified.
- Observations: see **Findings** above. F1 **falsified**, F2 **confirmed**,
  F4 **confirmed with a constraint**, both secondary observations reached.
- Validation:
  - `tests/validate.sh` — **OK**
  - `git status --porcelain` — this task file only; no component file changed
  - Global agent directories re-listed: **no `zz*` fixture in either client**
- Result: **done.** All three claims carry verdicts with commands and
  observed output. `TASK-0057` can now author `ADR-0022` on evidence.
- Commit: *pending — recorded in the follow-up commit*
- Push: *pending*
