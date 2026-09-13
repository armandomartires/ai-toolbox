# TASK-0005 — External MCP server shape: manifest, scripts, validation

## Objective
Implement the repo machinery ADR-0005 accepted but deferred: a
machine-readable manifest for external MCP servers, discovery of it in
`scripts/sync-registry.sh` and `scripts/install.sh`, and validation of it
in `tests/validate.sh` — including turning `AGENTS.md`'s prose
destructive-capability rule into an executable check.

No real server is ported here. This task builds the mechanism only, so
that TASK-0007 (port ansible) is a matter of filling in a manifest rather
than simultaneously inventing the format it uses.

## Minimal context
ADR-0005 established that `mcp-servers/` may hold either an authored
Python package or a reference to an external upstream package, and
explicitly deferred the script work: *"`scripts/sync-registry.sh` needs a
second discovery path ... implemented in the task that actually ports the
first external server (TASK-0005), not this ADR"* — and the same for
`install.sh`.

ADR-0005 and `PROJECT_MAP.md` disagree on where the external metadata
lives (README prose vs. "external MCP server manifests"). PLAN-0001
resolved this in favour of a `server.json` manifest; see PLAN-0001's
"Resolved ambiguities" for the reasoning. This task carries the
clarifying amendment to ADR-0005.

Full decomposition and rationale: `.ai/planning/plans/PLAN-0001-port-ansible-mcp-server.md`
(Phase 1).

## Scope

### Included
- `server.json` schema, defined normatively in the authoring guide.
- `mcp-servers/_template-external/server.json` — copy-from template.
- `scripts/sync-registry.sh` — second discovery path + a **Shape** column.
- `scripts/install.sh` — external-server registration output from the
  manifest, not the Python-only `uv run` line.
- `tests/validate.sh` — MCP-server checks (shape exclusivity, manifest
  parse, required keys, destructive⇒authorization).
- `AGENTS.md` Commands section — declare the `python3` prerequisite that
  the new validation introduces.
- ADR-0005 — a dated "Clarification" note pinning the manifest location.
- Regenerated `docs/registry.md`.

### Not included
- **Any real server.** No `mcp-servers/ansible/` — that is TASK-0007.
  If this task ends up creating a real server manifest to make the
  scripts testable, that is a signal the fixture approach below was
  skipped; use a throwaway fixture and delete it, don't commit a
  half-ported server.
- **`configs/*/README.md` content.** The manifest→client translation is
  written per-server in TASK-0007, and the snapshot structure itself is
  TASK-0006.
- **Superseding ADR-0005.** The decision stands; only an implementation
  detail is being pinned. Amend, don't replace.

## Preconditions
- Branch `master`, clean working tree.
- TASK-0004 done (ADR-0005 accepted, docs amended). Confirmed.
- `python3` available (verified present at plan time).

## Likely files
- `mcp-servers/_template-external/server.json` (new)
- `scripts/sync-registry.sh`
- `scripts/install.sh`
- `tests/validate.sh`
- `docs/development/authoring-guide.md`
- `AGENTS.md`
- `.ai/decisions/ADR-0005-mcp-servers-allow-node-packages.md` (amend)
- `docs/registry.md` (regenerated)
- `.ai/context/CURRENT_STATE.md`

## The `server.json` schema
Draft to implement (settle final field names while writing the authoring
guide entry; keep it minimal — every field must be justifiable for a
second and third server, not just ansible):

```json
{
  "name": "ansible",
  "description": "One-line description of the server's tools",
  "shape": "external",
  "upstream": {
    "registry": "npm",
    "package": "@ansible/ansible-mcp-server",
    "version": "26.6.0",
    "license": "MIT",
    "homepage": "https://..."
  },
  "launch": {
    "command": ["npx", "-y", "@ansible/ansible-mcp-server", "--stdio"],
    "transport": "stdio"
  },
  "runtime": {
    "declared": "node>=24.0",
    "tested": "node v22.23.2"
  },
  "environment": {
    "WORKSPACE_ROOT": {
      "required": true,
      "description": "Repo root the server may read/write"
    }
  },
  "capabilities": {
    "destructive": true,
    "destructive_tools": [
      "ansible_navigator: executes playbooks against real inventory",
      "ade_setup_environment: installs OS packages (dnf/apt/brew)",
      "define_and_build_execution_env: writes files, builds images"
    ]
  },
  "authorization": {
    "granted": true,
    "by": "human",
    "date": "2026-09-13",
    "task": ".ai/tasks/TASK-0007-port-ansible-mcp-server.md"
  }
}
```

Notes on the design:
- `runtime.declared` vs `runtime.tested` exist because ansible declares
  `node>=24.0` while running fine on v22 (npm `engines` is advisory).
  Recording only one of the two numbers would be misleading either way.
- `capabilities.destructive` is a boolean *and* a list, because the
  boolean is what `validate.sh` gates on and the list is what a human
  needs to make an informed decision.
- `authorization.task` is a path so validation can assert the file
  exists — an authorization pointing at a nonexistent task file is not
  an authorization.

**Sanity-check the schema on paper against the other two candidates
before committing to it**: proxmox (`uvx proxmox-mcp-server`, PyPI, five
env vars, read-heavy but has write endpoints) and obsidian (`npx -y
mcp-obsidian-cli`, one env var, requires an external desktop app to be
running — note this may need a `preconditions` field, or may be better
left to prose; decide and justify). If a field only makes sense for
ansible, drop it from the template.

## Execution plan
1. Draft the schema; check it on paper against proxmox and obsidian;
   trim anything ansible-only.
2. Write the normative schema documentation into
   `docs/development/authoring-guide.md`'s "MCP servers" section.
3. Create `mcp-servers/_template-external/server.json` with placeholder
   values matching the documented schema.
4. Extend `scripts/sync-registry.sh`: iterate both `pyproject.toml` and
   `server.json`; emit a **Shape** column (`python` | `external`); keep
   the output deterministic (stable ordering) so regeneration produces no
   spurious diffs.
5. Extend `scripts/install.sh`: for each external manifest, print the
   launch command and the required env var names. Keep skipping
   `_template*` dirs — note the existing skip is an exact match on
   `mcp-servers/_template`, so a new `_template-external` dir must be
   excluded too, in **both** scripts. This is the most likely thing to
   go silently wrong: a template appearing in the registry as a real
   component.
6. Extend `tests/validate.sh` with the four MCP checks. Use `python3
   -c` (or `python3 -m json.tool`) for JSON parsing; do not grep JSON.
7. Add the `python3` prerequisite to `AGENTS.md`'s Commands section.
8. Amend ADR-0005 with a dated Clarification note: the manifest lives at
   `mcp-servers/<name>/server.json`; `configs/*/README.md` holds only the
   per-client wiring. Cross-reference PLAN-0001.
9. Prove each new check fails on a broken fixture (see Mandatory
   validations), then delete the fixtures.
10. Regenerate the registry; confirm the diff is only the new Shape
    column and no template rows leaked in.
11. Update `CURRENT_STATE.md`; review diff; commit.

## Acceptance criteria
- [ ] `docs/development/authoring-guide.md` documents the `server.json`
      schema normatively, with every field's meaning.
- [ ] `mcp-servers/_template-external/server.json` exists and conforms
      to that documentation.
- [ ] `scripts/sync-registry.sh` discovers both shapes and emits a Shape
      column; `docs/registry.md` regenerated; **no `_template*` row in
      the output**.
- [ ] `scripts/install.sh` prints a usable launch line for external
      servers, sourced from the manifest.
- [ ] `tests/validate.sh` enforces: exactly one of
      `pyproject.toml`/`server.json` per server dir; manifest parses;
      required keys present; `capabilities.destructive: true` requires
      `authorization.granted: true` and an existing
      `authorization.task` file.
- [ ] ADR-0005 carries a dated Clarification note; no doc still implies
      `configs/*/README.md` is the machine-readable source.
- [ ] `AGENTS.md` declares the `python3` prerequisite.
- [ ] No real (non-template) server added by this task.

## Mandatory validations
- [ ] `bash tests/validate.sh` — passes on the repo as committed.
- [ ] `bash scripts/sync-registry.sh` — then `git diff docs/registry.md`
      shows only the intended change.
- [ ] `bash scripts/install.sh link` — runs clean; output lists no
      template as a real component.
- [ ] **Fails-when-broken proof** (per the Definition of Done's
      "new behaviour is proven by a test that fails when the change is
      reverted" — here, the behaviour *is* a test, so the equivalent is
      proving it rejects what it exists to reject). For each of the four
      checks, create a temporary fixture under `mcp-servers/`, confirm
      `validate.sh` exits non-zero **for the expected reason**, then
      remove it:
      1. dir with both `pyproject.toml` and `server.json`;
      2. `server.json` containing invalid JSON;
      3. `server.json` missing a required key;
      4. `server.json` with `capabilities.destructive: true` and
         `authorization.granted: false` — and separately, `granted: true`
         but `authorization.task` pointing at a nonexistent path.
      Record each fixture's observed error message in the execution log.
      A check that was never seen to fail has not been validated.
- [ ] `git status` clean at end — confirm every fixture was removed.

## Risks and rollback
- **Risk: template dirs leak into the registry** as real components. The
  existing skip is a literal `mcp-servers/_template` comparison, which
  `_template-external` does not match. Mitigated by explicitly checking
  the generated registry in the acceptance criteria rather than assuming.
- **Risk: schema fits ansible only**, forcing a breaking change on the
  second server. Mitigated by the paper check against proxmox/obsidian;
  accepted residual risk — a schema change before any external server
  exists is cheap, which is precisely why this task precedes TASK-0007.
- **Risk: `validate.sh` grows a dependency** (`python3`) not previously
  required for a repo whose validation was pure bash. Accepted:
  `AGENTS.md` already mandates Python 3.10+ for authored servers, so
  this is an existing assumption made explicit, not a new one. The
  alternative (grepping JSON) is worse.
- **Rollback**: `git revert` this task's commit. Scripts return to
  Python-only discovery; TASK-0007 becomes blocked again until re-planned.

## Dependencies
Depends on TASK-0004 (done). Blocks TASK-0007.

## Expected result
The repo can describe, index, install, and validate an external MCP
server before it contains one — so the first real port is a data-entry
exercise against a proven mechanism, and the security rule that governs
it is enforced by a script rather than by hoping a reader remembers it.

## Status
- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-13
- Updated: 2026-09-13
## Execution log
### Attempt 1
- Date: 2026-09-13
- Agent: opencode (anthropic/claude-opus-5)
- Actions: paper-checked the draft schema against proxmox
  (`uvx proxmox-mcp-server`, PyPI 1.4.1, Apache-2.0, python>=3.11, has a
  `router` extra) and obsidian (`npx -y mcp-obsidian-cli`, npm 2.1.0,
  MIT) before fixing it; documented the schema normatively in the
  authoring guide; added `mcp-servers/_template-external/server.json`;
  extended `sync-registry.sh` (both shapes, Shape column, sorted output),
  `install.sh` (manifest-sourced launch line, env vars, preconditions,
  destructive warning), and `tests/validate.sh` (shape exclusivity +
  manifest parse + required keys + name/dir match +
  destructive⇒authorization); amended ADR-0005 with a Clarification;
  added the `python3` prerequisite to AGENTS.md; realigned PROJECT_MAP.
- Observations / deviations from plan:
  1. **Dropped the planned `shape` field from the manifest.** The plan's
     draft had `"shape": "external"`, but a self-declared shape can
     contradict the directory's actual contents. Shape is now *derived*
     from which marker file exists, which cannot drift. ADR-0005's
     Clarification records this.
  2. **Added `preconditions` to the schema.** The paper check justified
     it: proxmox needs the `[router]` extra for `TOOL_ROUTING`, obsidian
     needs its desktop app running. Two of three candidates need it, so
     it is a real field, not an ansible-only one. Conversely nothing
     ansible-specific survived into the template.
  3. **Found and fixed a latent template-leak bug.** Both scripts skipped
     templates via an exact match on `mcp-servers/_template`, which
     `_template-external` would not have matched — the new template would
     have been published as a real component. Both now use a
     `_template*` glob. The old registry was in fact already listing
     `template-mcp-server` as a real MCP server; regenerating removed it.
  4. **Templates are still schema-validated** (only exempted from the
     name-matches-directory rule), so template drift is caught rather
     than ignored.
  5. Pre-existing, out of scope: the Skills table still lists
     `template-skill`, because the skills loop has no template skip. Not
     touched here — it is not this task's file. Candidate for the backlog.
- Validation:
  - `bash tests/validate.sh` → `validate.sh: OK`.
  - `bash scripts/sync-registry.sh` → diff is the new Shape column plus
    removal of the leaked `template-mcp-server` row; no template rows.
  - `bash scripts/install.sh link` → clean; lists no template.
  - Grep for stale Python-only MCP claims across `AGENTS.md`, `docs/`,
    `.ai/context/` → none.
  - **Fails-when-broken proof** — every check observed failing for the
    expected reason, then fixtures removed (`git status` clean):
    - both markers → `AMBIGUOUS SHAPE: ... has both pyproject.toml and server.json`
    - neither marker → `NO SHAPE: ... has neither pyproject.toml nor server.json`
    - truncated JSON → `INVALID JSON: ... Expecting property name enclosed in double quotes: line 1 column 30`
    - missing keys → 9 `INVALID MANIFEST ... missing required key` lines
      (description, runtime, environment, capabilities, upstream.package,
      upstream.version, upstream.license, launch.command, launch.transport)
    - name mismatch → `name 'wrong-name' does not match directory 'fixture-name'`
    - destructive, no `authorization` block → `authorization.granted is not true`
    - destructive, `granted: false` → same
    - destructive, `granted: true`, missing task file →
      `authorization.task points at a nonexistent file: .ai/tasks/TASK-9999-nope.md`
    - destructive, empty `destructive_tools` → `destructive_tools is empty`
    - destructive, missing `by` → `authorization.by is required when destructive`
    - fully valid destructive manifest → **passes** (confirming the gate
      is not simply failing unconditionally, which a negative-only proof
      would not have shown)
- Result: success.
- Commit: `0e43f95` "Add external MCP server manifest shape with
  validated authorization gate" on `master`.
- Push: no remote configured — nothing to push.
