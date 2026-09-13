# TASK-0006 — Client config snapshots and multi-client skill deployment

## Objective
Make `configs/<client>/README.md` a complete, accurate wiring snapshot for
each supported client (Claude Code, OpenCode, LM Studio), and extend
`scripts/install.sh` to deploy skills to OpenCode as well as Claude Code —
fixing a live correctness bug found while scoping this task, not merely
adding documentation.

## Minimal context
Investigation before writing this brief (2026-09-13) found:

1. **`install.sh` is Claude-Code-only.** `TARGET="${HOME}/.claude/skills"`
   is hard-coded (`scripts/install.sh:6`), despite `AGENTS.md`'s Objective
   requiring portability "across Claude Code, OpenCode, and LM Studio" and
   the runbook naming all three as deployment targets.
2. **Consequence: OpenCode is running a stale skill.**
   `~/.config/opencode/skills/project-workflow/SKILL.md` is a hand-placed
   copy at version `2.1.0`; the repo ships `3.0.0` (TASK-0003 bumped it).
   Nothing in this repo has ever been able to update it. This is the exact
   drift ADR-0004 declared ai-toolbox canonical to prevent, reappearing at
   the deployment layer rather than the source layer.
3. **The registry lists a template as a real component.**
   `sync-registry.sh`'s skills loop has no `_template*` skip, so
   `template-skill` appears in `docs/registry.md`. TASK-0005 fixed exactly
   this bug in the MCP loop and recorded the skills half as out of scope;
   this is where it lands.
4. **LM Studio is installed and is a clean MCP target.**
   `/mnt/c/Users/armando.martires/.lmstudio/mcp.json` exists and contains
   `{"mcpServers": {}}` — confirming the schema TASK-0007's snippet
   documented, and offering a way to close that snippet's "unverified"
   label. Its `hub/skills/` directory is empty and is *not* an Agent
   Skills target, so LM Studio stays config-only for skills.
5. The three `configs/*/README.md` files document only the ansible MCP
   server (from TASK-0007). None documents skills deployment, which is the
   other half of what a client needs wiring for.

Not a defect, checked and dismissed: `~/.claude/skills/*` symlinks point
at `/home/armando.martires/AI_Workspaces/...` (underscore) while the repo
sits at `/mnt/c/.../AI Workspaces/...` (space). `~/AI_Workspaces` is a
symlink to that same directory — verified identical inode — so the links
resolve correctly. No action.

## Scope

### Included
- `scripts/install.sh`: multi-client skill deployment (Claude Code +
  OpenCode), a `--client` selector, and a safe overwrite policy.
- `scripts/sync-registry.sh`: skip `_template*` in the skills loop.
- `configs/claude-code/README.md`, `configs/opencode/README.md`,
  `configs/lm-studio/README.md`: complete snapshots — skills deployment
  *and* MCP wiring per client, stating which parts are verified.
- `tests/validate.sh`: assert `configs/<client>/README.md` exists for
  every client `install.sh` knows about, so a future client cannot be
  added to the script without a wiring snapshot.
- Verify the LM Studio ansible wiring against the real `mcp.json`, closing
  TASK-0007's open "unverified" label if it works.
- Regenerated `docs/registry.md` (loses the `template-skill` row).
- `docs/operations/runbook.md` and `.ai/context/CURRENT_STATE.md` updates.

### Not included
- **LM Studio skill deployment.** Its `hub/skills/` is not an Agent Skills
  directory; inventing a deployment path there would be guessing. Record
  the finding, deploy nothing.
- **Windows-side (non-WSL) client installs.** The Claude Code and
  OpenCode configs targeted here are the WSL ones. LM Studio is reached
  through `/mnt/c` because that is where it is actually installed.
- **Phase 2 roadmap exit criteria** ("one skill and one MCP server working
  in all clients"). This task makes it *reachable*; proving a skill loads
  inside LM Studio is separate and may not be possible.
- **Removing the unrelated `agent-tiers` skill** from OpenCode's skills
  dir. Not this repo's component; must not be touched.

## Preconditions
- Branch `master`, clean. TASK-0005 and TASK-0007 done (`f0e8a95`).
- `~/.config/opencode/skills/` exists and contains a stale
  `project-workflow` plus an unrelated `agent-tiers`.

## Likely files
- `scripts/install.sh`
- `scripts/sync-registry.sh`
- `tests/validate.sh`
- `configs/{claude-code,opencode,lm-studio}/README.md`
- `docs/registry.md` (regenerated)
- `docs/operations/runbook.md`
- `.ai/context/CURRENT_STATE.md`, `.ai/planning/SPRINT-CURRENT.md`,
  `.ai/tasks/TODO.md`

## Overwrite policy (decided 2026-09-13)
`AGENTS.md` forbids overwriting human changes without authorization, and
OpenCode's skills dir contains a directory this repo did not create.
Decided:

- Replace a target **only if the repo owns a skill of that name**. So
  `project-workflow` (stale 2.1.0) is replaced by a link to the repo's
  3.0.0; `agent-tiers` is left untouched because the repo has no such
  skill.
- **Announce every replacement** of a pre-existing non-symlink directory,
  naming the path, so an overwrite is never silent.
- Keep ADR-0002's symlink-first preference (`link` mode default, `copy`
  as fallback for checkouts where symlinks are unavailable).
- This is authorization for replacing *repo-owned skill names only*. It is
  not authorization to prune unrelated skills, which stays forbidden.

## Execution plan
1. Extend `install.sh`: a client→skills-target table (`claude` →
   `~/.claude/skills`, `opencode` → `~/.config/opencode/skills`), a
   `--client <name|all>` selector defaulting to `all`, and skipping any
   client whose parent config dir is absent (do not create a config tree
   for a client that is not installed).
2. Implement the overwrite policy above; print `replaced` vs `linked` per
   skill per client.
3. Fix the skills-loop template leak in `sync-registry.sh`; regenerate.
4. Add the `configs/<client>/README.md`-exists check to `validate.sh`,
   deriving the client list from `install.sh` so the two cannot diverge.
5. Rewrite the three client READMEs as full snapshots: skills deployment
   command, skills target path, MCP wiring, verification status.
6. Run `install.sh --client opencode`; confirm project-workflow now
   resolves to 3.0.0 and `agent-tiers` is untouched.
7. Verify LM Studio: add the ansible entry to its real `mcp.json`, confirm
   it parses and the app accepts it, then restore the file. If it cannot
   be verified without launching the GUI, say so rather than claiming it.
8. Update runbook and planning docs; validate; review diff; commit.

## Acceptance criteria
- [ ] `install.sh` deploys skills to Claude Code **and** OpenCode;
      `--client` selects one; absent clients are skipped, not created.
- [ ] `~/.config/opencode/skills/project-workflow` resolves to the repo's
      `3.0.0`, and `agent-tiers` is still present and unmodified.
- [ ] No pre-existing directory is replaced without a printed notice.
- [ ] `docs/registry.md` no longer lists `template-skill`; no template
      appears in any table.
- [ ] `tests/validate.sh` fails if a client known to `install.sh` has no
      `configs/<client>/README.md`.
- [ ] All three client READMEs document skills deployment *and* MCP
      wiring, each marked verified or unverified per client.
- [ ] LM Studio ansible wiring verified, or its inability to be verified
      recorded with the reason.
- [ ] `agent-tiers` untouched; no unrelated skill pruned.

## Mandatory validations
- [ ] `bash tests/validate.sh` — passes.
- [ ] **Fails-when-broken proof** for the new client-README check:
      temporarily rename `configs/opencode/README.md`, confirm
      `validate.sh` exits non-zero naming that client, restore, confirm
      pass. Record both outputs.
- [ ] `bash scripts/install.sh link` then `--client opencode` and
      `--client claude` — each run clean and idempotent (run twice;
      second run must not report spurious replacements).
- [ ] `readlink -f ~/.config/opencode/skills/project-workflow` and
      `grep version` through the link → `3.0.0`.
- [ ] `ls ~/.config/opencode/skills/` → still contains `agent-tiers`.
- [ ] `bash scripts/sync-registry.sh`; `git diff docs/registry.md` shows
      only the `template-skill` row removed.
- [ ] `python3 -m json.tool` on LM Studio's `mcp.json` after editing, and
      confirmation it was restored (checksum or content compare).
- [ ] `git status` clean at end.

## Risks and rollback
- **Risk: clobbering a human's OpenCode skill.** The whole reason for the
  name-scoped overwrite policy. `agent-tiers` is the canary — it must
  survive every run. Residual risk accepted for `project-workflow`, whose
  replacement is the point (ADR-0004 makes this repo canonical for it).
- **Risk: editing a live client config** (LM Studio's `mcp.json`) during
  verification and failing to restore it. Mitigated by content compare
  before/after and by testing on a copy first where possible.
- **Risk: idempotence regression.** `install.sh` is required to be safe to
  re-run; the replacement notice must not fire on every run once the
  target is already the correct symlink. Explicitly double-run tested.
- **Risk: scope creep into Phase 2 exit criteria.** Verifying a skill
  loads inside LM Studio is explicitly out of scope; stop at config.
- **Rollback**: `git revert` this task's commit, then re-run
  `install.sh`. Client-side effect of a revert is a stale symlink target
  that still resolves, so no breakage — but note the OpenCode skill would
  remain at 3.0.0 rather than reverting to the hand-placed 2.1.0 copy,
  which is not recoverable from git and is not this repo's to restore.

## Dependencies
Depends on TASK-0005 (script conventions, template-skip pattern to mirror)
and TASK-0007 (the ansible wiring these snapshots document). Last open
task in sprint S1; unblocks the Phase 2 roadmap exit criteria.

## Expected result
Every supported client has one honest, complete wiring document, and the
deployment script actually serves the clients `AGENTS.md` claims the repo
is portable across — with the drift that claim was hiding (OpenCode stuck
on project-workflow 2.1.0) closed.

## Status
- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-13
- Updated: 2026-09-13
## Execution log
### Attempt 1
- Date: 2026-09-13
- Agent: opencode (anthropic/claude-opus-5)
- Actions: extended `install.sh` with a client→target table, `--client`
  selector, `--help`, and the name-scoped overwrite policy; fixed the
  skills-loop template leak in `sync-registry.sh`; added the
  `configs/<client>/README.md` pairing check to `validate.sh`; rewrote all
  three client READMEs as full snapshots (skills + MCP, with per-client
  verification status); verified the OpenCode deploy and the LM Studio
  wiring; updated the runbook with a skill-deployment-targets table.
- Bugs found and fixed during execution:
  1. **`ln -sfn` against a real directory silently creates the link
     *inside* it.** The first OpenCode deploy printed its replacement
     NOTICE and reported success while leaving the stale `2.1.0`
     `SKILL.md` live, with a nested `project-workflow/project-workflow`
     symlink underneath. Caught only because the acceptance criteria
     required checking the *deployed version*, not the script's own
     output — a script reporting success is not evidence the effect
     happened. Fixed with an explicit `rm -rf` of the pre-existing real
     directory before linking.
  2. **Client name mismatch.** The new client table initially used
     `claude`, but the config directory is `configs/claude-code/`. The
     pairing check caught it on its first run, before any commit — which
     is precisely the drift the check was added to prevent, so it earned
     its place immediately. Client names now match `configs/<name>/`
     exactly.
- Observations:
  - The stale-skill drift was real and is now closed: OpenCode's
    `project-workflow` went from a hand-placed `2.1.0` copy to a symlink
    resolving to the repo's `3.0.0`, while the unrelated `agent-tiers`
    survived every run untouched.
  - `~/.claude/skills/*` symlinks point at
    `/home/armando.martires/AI_Workspaces/...` (underscore) while the repo
    is at `/mnt/c/.../AI Workspaces/...` (space). Investigated as a
    possible defect: `~/AI_Workspaces` is a symlink to that same
    directory (identical inode confirmed), so the links resolve. No action.
  - `copy` mode was exercised and then reverted to `link`, since leaving
    Claude Code with real copies would contradict ADR-0002's symlink-first
    preference.
  - LM Studio's `~/.lmstudio/hub/skills/` is empty and is not an Agent
    Skills target, so it remains config-only — recorded in its README
    rather than guessed at.
- Validation:
  - `bash tests/validate.sh` → OK.
  - **Fails-when-broken proof** for the new pairing check: with
    `configs/opencode/README.md` moved away → `MISSING wiring snapshot:
    configs/opencode/README.md (client 'opencode' is in
    scripts/install.sh)`, exit 1; same for `claude-code`; restored → OK,
    exit 0. Both directions recorded, so the check is not merely failing
    unconditionally.
  - Idempotence: `install.sh link --client opencode` run three times; the
    replacement NOTICE fires only on the run that actually replaces a real
    directory, never afterwards.
  - `--client bogus` → `no matching client`, exit 2. `--help` prints usage.
  - `readlink -f ~/.config/opencode/skills/project-workflow` → repo path;
    `grep version` through it → `3.0.0` (was `2.1.0`).
  - `ls ~/.config/opencode/skills/` → `agent-tiers` still present and
    unmodified.
  - `bash scripts/sync-registry.sh` → `git diff docs/registry.md` shows
    exactly one line removed, the `template-skill` row.
  - LM Studio: entry written into the live `~/.lmstudio/mcp.json`, parsed
    with `python3 -m json.tool`, then restored — md5 `1a6618c9486afd375c
    df1135b5b2acc4` before and after, byte-identical. The exact command +
    env from that config then completed a real MCP `initialize` handshake,
    returning `serverInfo: {"name": "ansible-mcp-server"}`.
- Not achieved, stated rather than glossed: the server appearing in LM
  Studio's own UI tool list is unverified (needs the GUI launched
  interactively). Its README says so. Phase 2's roadmap exit criterion
  ("one skill and one MCP server working in all clients") is therefore
  reachable but not fully proven for LM Studio, whose skill support does
  not exist at all.
- Result: success.
- Commit: `5762d96` "Deploy skills to OpenCode as well as Claude Code;
  complete client snapshots" on `master`.
- Push: no remote configured — nothing to push.
