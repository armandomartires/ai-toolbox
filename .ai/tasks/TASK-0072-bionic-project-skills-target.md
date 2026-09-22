# TASK-0072 — Deploy skills to Bionic's project target, and leave its global target alone

## Objective

Close `B-018`. Teach `scripts/install.sh` to deploy this repo's skills into a
Bionic **project** skills directory (`<project>/.agents/skills/`), on an
explicit `--bionic-project DIR` flag. **Do not** automate the global target:
it is approval-gated by the vendor, and the gate is not something a
non-interactive installer can drive.

## Minimal context

`B-018` has been `ready` since 2026-09-16 and carries a corrected premise.
`ADR-0006` recorded that this client had *no* Agent Skills target; `TASK-0047`
and `ADR-0020` found that false — the repo had been checking
`~/.lmstudio/hub/skills/`, a **hub cache** whose siblings are `hub/models` and
`hub/presets`. The real targets are documented by Bionic's own bundled skill
at `~/.lmstudio/.internal/skills/skill-management/SKILL.md:23-25`:

> *"All global skills are located in the `~/.lmstudio/skills` folder … Project
> skills are located in each project's `.agents/skills` folder."*

**The item's own words say this needs a design decision, not just code:**
*"the real question is whether a per-project target belongs in a global
installer at all, or whether Bionic needs a separate path."*

**Human decision, 2026-09-23: project target only.** The installer gains the
project path; global installs stay a documented manual procedure.

**Why the two halves are not symmetrical**, from the same bundled skill
(`:31`): *"DO NOT edit global skills directly. If you need to install a new
skill…"* — global installs route through a `skill.install` tool call that
**prompts the user**. `scripts/install.sh` is non-interactive and idempotent
by design, so it cannot drive that gate; an installer that wrote
`~/.lmstudio/skills/` directly would be working around a vendor control, not
supporting a client. Project skills under `.agents/skills/` are **ordinary
writable files** and need no such gate.

**Why a flag rather than a row in `CLIENTS`.** Every row in that table is a
*global* target under `$HOME` that the script probes for existence and skips
when absent. A project target has no such location — it is wherever the user's
project is — so a row would have to invent one, most likely this repo's own
directory, which is not a Bionic project. The flag makes the caller name the
directory, which is the only honest source of that fact.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `scripts/install.sh` | pre-existing | `CLIENTS` table of two; the comment block at ~line 54 already explains Bionic's absence and names `B-018` |
| `tests/validate.sh` | `TASK-0040` | Reads client names from `install.sh`'s `CLIENTS` block via `grep -oE '^[a-z0-9_-]+\|'` and requires `configs/<name>/README.md` for each |
| `configs/lm-studio-bionic/README.md` | `TASK-0047`, `TASK-0053` | Table rows 49–50 say skills deployment is *"not automated"*; a "Skills — supported, but not auto-deployed" section |
| `.ai/decisions/0020-*.md` | `TASK-0047` | `Accepted`; clause 6 — *"directory-name inference is not evidence, in either direction"* |

**Verify the expected state; don't assume it.** In particular, re-check how
`validate.sh` parses the `CLIENTS` block **before** editing anything near it:
the parse anchors on the first field of each line, so a stray line inside that
block becomes a client name the gate then demands a `configs/` directory for.

## Scope

### Included

- `--bionic-project DIR` in `scripts/install.sh`: deploys every skill to
  `DIR/.agents/skills/`, honouring `link|copy` and the existing overwrite
  policy (replace only what this repo owns; announce replacing a real
  directory).
- `lm-studio-bionic` accepted by `--client` **for filtering only**, so
  `--client lm-studio-bionic --bionic-project DIR` deploys to Bionic alone.
- A **loud, specific error** when Bionic is selected without a project
  directory, naming the approval gate rather than just the missing flag.
- **No agent emission for Bionic.** `ADR-0020` found no user-authored
  agent-role directory in it, so there is no surface — stated in the script,
  not left for a reader to notice.
- `configs/lm-studio-bionic/README.md`: the two table rows and the skills
  section updated to say what is now automated and what deliberately is not.
- `--help` text.

### Not included

- **Writing `~/.lmstudio/skills/` from any script.** The decision, and the
  vendor's control.
- Adding Bionic to the `CLIENTS` table (see Minimal context).
- Emitting agents or wiring MCP servers for Bionic.
- Verifying that Bionic *loads* a skill deployed this way. This task can prove
  the files land at the documented path; it cannot prove the client reads them
  without running the client, and `ADR-0020` clause 6 forbids inferring it.
  **That is a human verification step**, the same shape as `TASK-0016`/`0017`.

## Likely files

- `scripts/install.sh`
- `configs/lm-studio-bionic/README.md`
- `.ai/planning/BACKLOG.md`, `.ai/tasks/TODO.md`, `.ai/context/CURRENT_STATE.md`
- **Not** `tests/validate.sh` — no new client name enters the `CLIENTS` block,
  so its pairing check should be unaffected. If it fires, that is a finding.

## Execution plan

1. Re-read `validate.sh`'s `CLIENTS` parse and confirm what a new line inside
   that block would do.
2. Add the flag, the filter name, the error path, and the deployment loop.
3. Deploy to a **scratch project directory** and verify: `.agents/skills/`
   created; one entry per non-template skill; symlinks resolve to this repo.
4. Re-run with `copy` and confirm real directories land.
5. Re-run `link` twice and confirm idempotence.
6. Prove the error path: `--client lm-studio-bionic` with no project dir.
7. Confirm a default `install.sh` run touches **no** Bionic path.
8. `tests/validate.sh`; docs; remove the scratch dir; diff; commit; push.

## Acceptance criteria

- [ ] `--bionic-project DIR` deploys every non-template skill to
      `DIR/.agents/skills/`, in both `link` and `copy` modes, **observed**.
- [ ] Re-running is idempotent — no duplication, no error.
- [ ] Bionic selected without a project directory fails with a message naming
      the approval gate, **observed**.
- [ ] A default run writes nothing under any Bionic path, **observed**.
- [ ] No script in this repo writes `~/.lmstudio/skills/`.
- [ ] `tests/validate.sh` passes and its client-pairing check is unchanged.
- [ ] `configs/lm-studio-bionic/README.md` no longer says deployment is *"not
      automated"* without qualification, and states the global gate as the
      reason the other half is manual.
- [ ] Scratch directory removed, removal verified.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `scripts/sync-registry.sh` (no component added; expect no diff)
- [ ] `git status --porcelain`

## Risks and rollback

- **Working around a vendor control.** The failure mode that would make this
  task wrong rather than incomplete. Mitigation: no script writes the global
  path, and the error message points at the documented procedure.
- **Writing into a directory that is not a Bionic project.** `.agents/skills/`
  is created under whatever `DIR` names. Mitigated by requiring `DIR` to exist
  already — the script creates the skills subtree, never the project.
- **A `CLIENTS`-block edit silently inventing a client.** `validate.sh` would
  then demand a `configs/` directory for it. Mitigated by keeping Bionic out
  of that block entirely, and by running the gate.
- Rollback is `git revert` of one commit. Deployed files outside the repo are
  the user's to remove; the script never deletes a skill it does not own.

## Outputs / handover

*Forecast until verified — this section describes an intention until the
execution log below records otherwise.*

| Artifact | End state |
|----------|-----------|
| `scripts/install.sh` | `--bionic-project DIR`; Bionic accepted by `--client` for filtering; loud error without a directory; no agent emission |
| `configs/lm-studio-bionic/README.md` | Project deployment documented as automated; global documented as manual, with the vendor quote as the reason |
| `~/.lmstudio/skills/` | **Untouched by every script in this repo**, deliberately |
| `tests/validate.sh` | **Unchanged** |

**Next task starts here**: `B-023` (`TASK-0073`), independent of this one.
The human verification that Bionic actually loads a project-deployed skill is
**not** done by this task and is not claimed.

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
  1. Re-read `validate.sh`'s `CLIENTS` parse first, as the brief required.
     It reads the first field of each line inside the `CLIENTS="` block, so
     keeping Bionic out of that block keeps it out of the pairing check.
  2. `--bionic-project DIR` / `--bionic-project=DIR`; `lm-studio-bionic`
     accepted by `--client` for filtering; the Bionic block placed **before**
     the `deployed_any` check so `--client lm-studio-bionic` cannot fall
     through to *"no matching client"*.
  3. **Extracted `deploy_skills()`** and pointed both the `CLIENTS` loop and
     the Bionic path at it. Not gratuitous: the overwrite policy inside it is
     load-bearing (`ln -sfn` against a real directory links *inside* it and
     reports success), and a second copy is a second thing to keep right —
     `TASK-0011` removed duplicated per-section loops from the registry
     generator for the same reason.
  4. Replaced `--help`'s fixed `sed -n '2,13p'` with an `awk` that prints the
     leading comment block however long it grows. The four header lines this
     task added would otherwise have been silently truncated out of the help
     text — a line-number range is a second-hand claim an edit invalidates
     without failing anything.
  5. Updated the stale comment above `CLIENTS` (it still said Bionic's
     absence was "tracked as backlog B-018, deliberately not improvised") and
     `configs/lm-studio-bionic/README.md`.
- Observations:
  - **Deployment observed**, not inferred: four non-template skills into
    `<scratch>/.agents/skills/`, symlinks resolving to real `SKILL.md` files
    under this repo.
  - **Idempotent** — a second `link` run redeployed four and left four
    entries, no duplication, no error.
  - **`copy` over `link` works**: 4 real directories, 0 symlinks afterwards.
  - **Error path observed**: `--client lm-studio-bionic` with no project
    directory exits **2** and names the approval gate rather than just the
    missing flag.
  - **A default run wrote nothing Bionic** — no matching output, and the
    scratch project's `.agents/skills` mtime was byte-identical before and
    after.
  - **`grep` over `scripts/ tests/ .githooks/` finds three mentions of
    `lmstudio/skills` and all three are a comment or an error string.** No
    script writes the global path.
  - `validate.sh`'s client list still parses to exactly `claude-code` and
    `opencode` — unchanged, as the brief predicted.
  - **Finding, and the one worth carrying: `$HOME` is the wrong home.**
    `~/.lmstudio/skills/` **does not exist** at the WSL `$HOME`
    (`/home/<user>`); it exists and is empty at
    `/mnt/c/Users/<user>/.lmstudio/skills/`, the **Windows** home. Every
    `CLIENTS` row is built from `${HOME}`, so a global Bionic row written the
    obvious way would point somewhere Bionic never looks — **and would
    succeed**, creating an empty directory nothing reads. This is a *second,
    independent* reason not to automate the global half, and it is why
    `--bionic-project` takes an explicit directory rather than deriving one.
    The wiring snapshot's "exists and is empty on this machine" did not say
    which home and reads as false from inside WSL; corrected.
- Validation:
  - `tests/validate.sh` — **OK**; client-pairing parse verified unchanged
  - `scripts/sync-registry.sh` — no diff (no component added)
  - `git status --porcelain` — scratch directory outside the repo, removed
- Result: **done.** `B-018` closed: the project half automated, the global
  half deliberately manual, and the second reason for that documented.
- Commit: *pending — recorded in the follow-up commit*
- Push: *pending*
