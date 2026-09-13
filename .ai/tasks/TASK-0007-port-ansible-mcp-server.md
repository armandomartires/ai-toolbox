# TASK-0007 — Port the ansible MCP server (first external server)

## Objective
Port `@ansible/ansible-mcp-server` into this repo as its first real MCP
server, using the external shape ADR-0005 established and TASK-0005
implemented: a `server.json` manifest, a registry entry, per-client
wiring snippets, and a recorded authorization for its non-read-only tool
surface. No upstream source is vendored.

## Minimal context
This is the *"port first MCP server"* item that has been on
`.ai/tasks/TODO.md` since scaffold. It has already spawned two
predecessor tasks: TASK-0004 (the rule permitting a non-Python server)
and TASK-0005 (the machinery to describe one). This task is the payload.

Ansible was chosen because it is the only MCP server with a working
connection in this environment — re-verified at plan time (2026-09-13):
`proxmox` still fails (`numpy` missing for its router), `obsidian` still
fails (desktop app not running). See SESSION-20260913-1200 for the
original evaluation.

Full decomposition: `.ai/planning/plans/PLAN-0001-port-ansible-mcp-server.md`
(Phases 2 and 3).

## Destructive-capability authorization
`AGENTS.md` (Security and secrets): *"MCP servers must not expose
destructive capabilities without explicit human authorization in the task
file."* This section is that authorization.

The server exposes 10 tools. These are **not read-only**:

| Tool | What it can do |
|------|----------------|
| `ansible_navigator` | Executes playbooks against real inventory — can change managed infrastructure |
| `ade_setup_environment` | Installs OS packages via dnf/apt/brew; creates virtualenvs |
| `define_and_build_execution_env` | Writes files; builds container images |
| `ansible_lint` (with `fix: true`) | Rewrites playbook files in place |
| `create_ansible_projects` | Scaffolds directory trees on disk |

**Authorization: GRANTED.**
- Granted by: human (repo owner), 2026-09-13, during the PLAN-0001
  planning session.
- Scope: the server ships **enabled**, not disabled-by-default. This
  differs from the `"enabled": false` treatment given to `gns3` and
  `officemcp` in the live OpenCode config — those are disabled for
  platform incompatibility (Windows-only), not for risk.
- Conditions: the risk is mitigated by **disclosure, not suppression**.
  The manifest must list every destructive tool in
  `capabilities.destructive_tools`, and every `configs/*/README.md`
  wiring snippet must carry a visible warning. `WORKSPACE_ROOT` must be
  documented as the blast-radius control it is.
- If the executing session finds a destructive capability **not** listed
  above (upstream added tools since 26.6.0), that is outside this
  authorization: stop, list it, and ask before proceeding.

## Scope

### Included
- `mcp-servers/ansible/server.json` — the manifest, no vendored source.
- `configs/opencode/README.md` — OpenCode wiring snippet.
- `configs/claude-code/README.md` — `claude mcp add` wiring snippet.
- `configs/lm-studio/README.md` — LM Studio wiring snippet.
- Regenerated `docs/registry.md`.
- `.ai/context/CURRENT_STATE.md` update.
- Phase 3 client verification, or an explicit record of why it did not
  happen.

### Not included
- **Any change to the manifest schema or the scripts.** If the schema
  turns out not to fit ansible, that is a TASK-0005 defect: fix it there
  (or in a follow-up amending it) rather than quietly reshaping the
  format inside this task.
- **The general structure of `configs/*/README.md` snapshots** — that is
  TASK-0006. This task adds only the ansible rows. If it finds itself
  designing the snapshot format, stop and re-scope (see PLAN-0001's
  boundary note).
- **proxmox / obsidian.** Re-checked, not ported. If either has become
  functional, note it as a backlog candidate; do not absorb it here.

## Preconditions
- TASK-0005 done: `server.json` schema documented, scripts extended,
  `validate.sh` enforcing the authorization check.
- Branch `master`, clean working tree.
- Network access (`npx` fetches the package).

## Likely files
- `mcp-servers/ansible/server.json` (new)
- `configs/opencode/README.md`
- `configs/claude-code/README.md`
- `configs/lm-studio/README.md`
- `docs/registry.md` (regenerated)
- `.ai/context/CURRENT_STATE.md`
- `.ai/tasks/TODO.md`, `.ai/planning/SPRINT-CURRENT.md`

## Execution plan
1. **Re-verify before porting.** Call an ansible MCP tool (e.g.
   `ansible_list_available_tools`) and confirm the connection and the
   tool list. Compare the returned list against the destructive-tool
   table above; if it has grown, stop per the authorization conditions.
   Re-check `proxmox` and `obsidian` too — cheap, and prevents porting on
   a stale assumption.
2. **Pin the facts, don't copy them from this brief.** Re-read
   `npm view @ansible/ansible-mcp-server version license engines
   homepage`. At plan time: `26.6.0`, MIT, `node>=24.0`. Use what the
   registry says at execution time.
3. **Decide the version-pinning question** (deferred here by PLAN-0001):
   `npx -y @ansible/ansible-mcp-server` fetches latest at every launch
   and can silently cross a breaking change; pinning
   `@ansible/ansible-mcp-server@26.6.0` is reproducible but goes stale
   and needs manual bumps. Pick one, state the reasoning in the
   execution log, and make the manifest and all three wiring snippets
   agree.
4. Write `mcp-servers/ansible/server.json` per TASK-0005's documented
   schema. Record both `runtime.declared` (`node>=24.0`) and
   `runtime.tested` — this machine runs Node v22.23.2 and the server
   works anyway, because npm `engines` is advisory. Do not silently
   claim v22 is supported; do not omit that it was tested there.
5. Write the three wiring snippets:
   - **OpenCode**: lift from the known-working block in the live
     `~/.config/opencode/opencode.jsonc` rather than inventing it, but
     reconcile `WORKSPACE_ROOT` — it is `"."` there, which resolves
     relative to wherever the client starts. Document what it should be
     and why it matters (it is the blast radius).
   - **Claude Code**: `claude mcp add --scope user --transport stdio
     ansible -- npx -y @ansible/ansible-mcp-server --stdio`, matching
     the pattern already in `configs/claude-code/README.md`.
   - **LM Studio**: its own MCP config format. If LM Studio is not
     available to verify against, write the snippet and mark it
     explicitly **unverified** — do not present an untested snippet as
     working.
   Each snippet carries the destructive-capability warning and the
   required environment variables.
6. Run `scripts/sync-registry.sh`; confirm ansible appears with shape
   `external` and no template rows leaked.
7. Run `tests/validate.sh`; confirm the authorization check passes
   *because* the manifest and this task file satisfy it — and, once,
   flip `authorization.granted` to `false` locally to confirm it fails,
   then restore. (Definition of Done: the check must be seen to bite on
   this real manifest, not only on TASK-0005's throwaway fixtures.)
8. Run `scripts/install.sh link`; confirm it prints a pasteable launch
   line for ansible.
9. **Phase 3 — verify in a real client.** Follow the snippet from a
   clean starting point in at least one client that was *not* already
   wired for this server. This session's own OpenCode instance is
   already configured, so verifying there proves the server works, not
   that the snippet does. If no clean client is available, say so in the
   execution log; do not claim coverage.
10. Update `CURRENT_STATE.md`, `TODO.md`, `SPRINT-CURRENT.md`. Review
    the diff. Commit.

## Acceptance criteria
- [ ] `mcp-servers/ansible/server.json` exists, conforms to the
      documented schema, and contains **no vendored upstream source**.
- [ ] Manifest lists every destructive tool and points
      `authorization.task` at this file.
- [ ] `docs/registry.md` (generated) lists `ansible` with shape
      `external`.
- [ ] All three `configs/*/README.md` files carry an ansible wiring
      snippet with required env vars and the destructive-capability
      warning; any unverified snippet is labelled as such.
- [ ] The version-pinning decision is made and recorded, and the
      manifest and all snippets agree with it.
- [ ] `runtime.declared` and `runtime.tested` both recorded.
- [ ] Phase 3 client verification done from a clean start, **or** its
      absence explicitly recorded.
- [ ] Nothing in `scripts/` or the schema changed by this task.

## Mandatory validations
- [ ] `bash tests/validate.sh` — passes.
- [ ] Authorization check seen to fail: set
      `authorization.granted: false`, confirm non-zero exit with the
      expected message, restore, re-confirm pass. Record both outputs.
- [ ] `bash scripts/sync-registry.sh` — registry regenerated; diff
      reviewed; no template rows.
- [ ] `bash scripts/install.sh link` — clean run, ansible launch line
      printed.
- [ ] Live server re-verified: tool list captured in the execution log
      and compared against the authorized destructive-tool table.
- [ ] `git status` clean at end.

## Risks and rollback
- **Risk: the wiring snippet is only ever tested where the server was
  already working.** This is the most likely way this task produces a
  false green. Mitigated by the clean-start requirement in step 9 and by
  requiring an explicit record when it cannot be met.
- **Risk: `npx -y` unpinned drift** — a breaking upstream change lands
  silently at next launch. Addressed by the step-3 decision either way;
  whichever is chosen, the trade-off is recorded rather than left
  implicit.
- **Risk: Node engine mismatch becomes enforced.** The package declares
  `node>=24.0`; the tested environment is v22. If npm or Corepack ever
  enforces `engines`, launches break with no repo-side change.
  Mitigated by recording both numbers; not otherwise preventable here.
- **Risk: authorization scope creep** — upstream adds destructive tools
  after this task's authorization was granted. Mitigated by step 1's
  comparison and the stop-condition in the authorization section; a
  future upstream bump should re-run that comparison.
- **Rollback**: `git revert` this task's commit. The manifest, registry
  row, and snippets disappear; TASK-0005's mechanism remains, so a
  re-port is cheap.

## Dependencies
Depends on TASK-0005 (mechanism) and TASK-0004 (rule). Precedes
TASK-0006 (client config snapshots), which generalizes what this task
writes for one server.

## Expected result
The repo's Phase 1 roadmap milestone — "first component installed and
used in a real session" — is met for an MCP server, with the server's
real risk surface written down and mechanically gated rather than
discovered later by whoever runs a playbook they did not expect.

## Status
- Status: planned   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-13
- Updated: 2026-09-13
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
