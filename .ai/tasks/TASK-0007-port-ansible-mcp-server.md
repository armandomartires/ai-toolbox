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
- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-13
- Updated: 2026-09-13
## Execution log
### Attempt 1
- Date: 2026-09-13
- Agent: opencode (anthropic/claude-opus-5)
- Actions: re-verified the live server before porting (10 tools,
  identical to the authorized table — no scope creep, so the
  authorization in this file still covers the real surface); re-checked
  proxmox (still no `numpy`) and obsidian (app still not running), so
  ansible remains the only viable candidate; re-read upstream facts from
  npm rather than trusting the plan's copies; wrote
  `mcp-servers/ansible/server.json`; wrote wiring snippets for all three
  clients; verified the Claude Code snippet from a clean start.
- Version-pinning decision (deferred to this task by PLAN-0001):
  **pinned** to `@ansible/ansible-mcp-server@26.6.0` in the manifest and
  all three snippets. Reasoning: unpinned `npx -y` refetches on every
  launch, so a breaking upstream release would land silently between one
  agent session and the next, with no repo-side change to point at when
  debugging. The cost is manual bumps going stale, which is visible and
  cheap; the cost of the alternative is an invisible failure. Confirmed
  the pinned specifier resolves and runs.
- Observations:
  1. **`runtime.declared` vs `runtime.tested` earned its place.** Running
     the pinned command printed `npm warn EBADENGINE ... required: {
     node: '>=24.0' }, current: { node: 'v22.23.2' }` and then worked.
     Recording only the declared value would imply node 24 is needed;
     recording only the tested value would hide that upstream disclaims
     node 22. Both are in the manifest, and the reason (npm `engines` is
     advisory unless `engine-strict`) is in `preconditions`.
  2. **Added three `preconditions`** beyond the env var: node/npx on
     PATH with the engine caveat; ansible tooling installed (without it
     the server still connects and read-only tools work — which is
     exactly why last session's `ade_environment_info` failures were a
     setup gap, not a broken server); and Podman/Docker for
     `ansible_navigator`'s default containerized execution.
  3. **The OpenCode snippet's `WORKSPACE_ROOT: "."`** was lifted from the
     known-working live config, but `"."` resolves against whatever
     directory the client started in — so the blast radius follows the
     user's shell. Documented, with absolute paths recommended; LM
     Studio's snippet requires absolute, since a desktop app's working
     directory is not a project the user chose.
  4. Schema needed **no changes** to fit a real server — TASK-0005's
     paper check against proxmox/obsidian did its job.
- Validation:
  - `bash tests/validate.sh` → OK with the real manifest present.
  - **Gate bite-test on the real manifest** (not just TASK-0005's
    fixtures): set `authorization.granted: false` → fails with
    `capabilities.destructive is true but authorization.granted is not
    true`; restored → OK. Restore confirmed byte-identical by `md5sum`
    (`bfb2367ad6dab1aa7c78ffcace1b4700`), since `git diff` proves nothing
    for an untracked file.
  - `bash scripts/sync-registry.sh` → ansible appears with shape
    `external`; no template rows.
  - `bash scripts/install.sh link` → prints the pinned launch command,
    `requires env: WORKSPACE_ROOT`, all three preconditions, and
    `WARNING: exposes destructive tools - see .ai/tasks/TASK-0007-...`.
  - Live re-verification: `ansible_list_available_tools` → the same 10
    tools; `npm view` → 26.6.0, MIT, `engines.node >= 24.0`, homepage
    `https://github.com/ansible/vscode-ansible#readme`.
- Phase 3 — clean-start client verification: **done, and it passed.**
  Claude Code is installed here and `claude mcp list` confirmed it had
  **no** prior ansible entry, making it a genuinely clean target (unlike
  this session's OpenCode instance, where a pass would have proved only
  that the server works, not that the snippet does). In a disposable
  `/tmp` directory: the `.mcp.json` form registered and reported `⏸
  Pending approval` (Claude Code's normal gate for project-scoped
  servers); the `claude mcp add --scope local` form, with `--env`, then
  reported **`✔ Connected`**. Removed afterwards. The claude-code
  snippet's pre-emptive "unverified" label was corrected to record this.
  LM Studio remains **unverified** — not installed in WSL (`lms`/
  `lmstudio` absent, no `~/.lmstudio`), and its snippet says so rather
  than implying coverage.
- Residue: `claude mcp remove` leaves an empty `projects` entry for the
  scratch dir in `~/.claude.json` (`mcpServers: []`). Deliberately not
  cleaned: rewriting the user's entire global config to delete one inert
  empty key is a worse trade than leaving it. Not repo state.
- Result: success.
- Commit: `853aacd` "Port the ansible MCP server as the first
  external-shape component" on `master`.
- Push: no remote configured — nothing to push.
