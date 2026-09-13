# PLAN-0001 — Port the first external MCP server (ansible)

## Objective
Turn ADR-0005's accepted-but-unimplemented "external MCP server shape"
into working repo machinery, then use it to port
`@ansible/ansible-mcp-server` as the repo's first real MCP server —
registered, validated, wired for at least one client, and with its
non-read-only tool surface authorized on the record.

This plan exists because the single TODO line "port first MCP server"
hides at least two independent units of work (build the mechanism; use
the mechanism) plus a human-in-the-loop verification step that cannot be
done unattended. Executing it as one task in one session would either
overrun or produce an unverified port.

## Context consulted
- `ADR-0005` — the decision this plan implements; its Consequences
  explicitly defer the `sync-registry.sh` / `install.sh` extensions "to
  the task that actually ports the first external server."
- `AGENTS.md` — Technology stack (two shapes), Commands, Security and
  secrets (destructive-capability authorization rule), Definition of
  done.
- `scripts/sync-registry.sh:24` — MCP discovery hard-coded to
  `mcp-servers/*/pyproject.toml`.
- `scripts/install.sh:23` — same hard-coded glob; prints a
  `uv run`-only registration hint.
- `tests/validate.sh` — validates skills only; no MCP checks at all.
- `.ai/context/PROJECT_MAP.md:14-16` — already claims the registry is
  built from "external MCP server manifests", a file type that does not
  yet exist.
- `docs/development/authoring-guide.md:11-19` — the two shapes as
  currently documented.
- `.ai/context/CURRENT_STATE.md:38-44` — flags the ansible destructive
  tool surface as an open item for this work.
- Live environment (re-checked at plan time, 2026-09-13): `ansible`
  connects and lists 10 tools; `proxmox` still fails (router needs
  `numpy`); `obsidian` still fails (desktop app not running). Ansible
  remains the only viable candidate — unchanged since SESSION-20260913-1200.
- `npm view @ansible/ansible-mcp-server`: version `26.6.0`, MIT,
  `engines.node >= 24.0`, bin `ansible-mcp-server`.
- Live `~/.config/opencode/opencode.jsonc` — an already-working wiring
  for this exact server, and the `"enabled": false` precedent used there
  for platform-restricted servers.

## Resolved ambiguities (decided at plan time, 2026-09-13)

**1. Where external-server metadata lives.** ADR-0005 says "documented
as a `configs/*/README.md` wiring snippet"; `PROJECT_MAP.md` says the
registry is generated "from ... external MCP server manifests". These
cannot both be the source of truth — a generator cannot reliably build a
table row from prose, and repeating the same server across three client
READMEs would duplicate the fact three ways.

Decided: **`mcp-servers/<name>/server.json`** is the single machine-
readable manifest. `configs/*/README.md` holds only the per-client
translation of it. This keeps `mcp-servers/` the complete index of every
server regardless of shape, satisfies ADR-0005 ("no vendored source" —
a manifest is not source), and matches `PROJECT_MAP.md`'s existing
wording, so no doc has to be re-amended. ADR-0005's own wording is the
one thing needing a clarifying amendment.

**2. Destructive-capability authorization.** `AGENTS.md` (Security and
secrets) forbids exposing destructive capabilities "without explicit
human authorization in the task file". Of the ansible server's 10 tools,
at least three are not read-only:
- `ansible_navigator` — executes playbooks against real inventory.
- `ade_setup_environment` — installs OS packages (dnf/apt/brew) and
  creates virtualenvs.
- `define_and_build_execution_env` — writes files and builds container
  images.
(`ansible_lint --fix` and `create_ansible_projects` also write to disk.)

Decided: **authorization granted** by the human in this planning
session, to be recorded verbatim in TASK-0007 and declared in the
manifest's `capabilities` block. The server ships **enabled** (not the
`"enabled": false` treatment given to gns3/officemcp, which are disabled
for platform incompatibility, not risk). The mitigation is disclosure,
not suppression: the manifest names every destructive tool, and the
wiring snippet repeats the warning.

## Phases

Each phase is sized to complete in one session. A session that cannot
finish its phase should stop at a phase boundary, not mid-phase — every
boundary below leaves the repo green (`tests/validate.sh` passing,
registry consistent, no half-written component).

### Phase 1 — Build the external-server mechanism (TASK-0005)
No real server yet; only the shape and the tooling that understands it.

1. Define the `server.json` schema and write it down in
   `docs/development/authoring-guide.md` (normative — the schema is a
   *what is*, so it belongs in `docs/`, not in `.ai/`).
2. Add `mcp-servers/_template-external/server.json` as the copy-from
   template, mirroring how `mcp-servers/_template/` serves the Python
   shape.
3. Extend `scripts/sync-registry.sh`: discover both
   `mcp-servers/*/pyproject.toml` (shape `python`) and
   `mcp-servers/*/server.json` (shape `external`); add a **Shape**
   column to the MCP Servers table so ADR-0005's "registry entry states
   which shape it is" is literally true.
4. Extend `scripts/install.sh`: for external servers, print the actual
   launch command and required environment variables from the manifest
   instead of the Python-only `cd <dir> && uv run <name>` line.
5. Extend `tests/validate.sh` with MCP-server checks:
   - every non-`_template*` dir under `mcp-servers/` has exactly one of
     `pyproject.toml` or `server.json` (never both, never neither);
   - each `server.json` parses and has the required keys;
   - if `capabilities.destructive` is `true`, `authorization.granted`
     must be `true` **and** `authorization.task` must name a task file
     that exists. This turns the `AGENTS.md` security rule from prose
     into an executable check — the main reason to spend a phase on
     mechanism at all.
6. Amend ADR-0005 with a short "Clarification (2026-09-13)" note
   recording resolved ambiguity 1 above. Amend, don't supersede: the
   decision stands, only its implementation detail is being pinned.
7. Regenerate the registry (shape column appears, contents otherwise
   unchanged), validate, commit.

**Exit criteria:** `tests/validate.sh` passes with the new MCP checks
against a repo that still contains zero external servers; the new checks
demonstrably fail when fed a deliberately broken fixture (see TASK-0005's
Mandatory validations — a check that has never failed is not a check).

### Phase 2 — Port ansible using that mechanism (TASK-0007)
1. Re-verify `ansible` still connects, and re-check `proxmox`/`obsidian`
   in case either became viable (cheap; prevents porting a server that
   broke since planning).
2. Pin the upstream version actually in use (`26.6.0` at plan time —
   re-read, do not trust this number).
3. Write `mcp-servers/ansible/server.json` — no vendored source.
4. Write the per-client wiring into `configs/opencode/README.md`,
   `configs/claude-code/README.md`, `configs/lm-studio/README.md`. The
   OpenCode snippet can be lifted from the known-working live
   `~/.config/opencode/opencode.jsonc` block rather than invented.
5. Record the destructive-capability authorization in TASK-0007 (the
   task file is where `AGENTS.md` requires it to live).
6. Regenerate registry, validate, update `CURRENT_STATE.md`, commit.

**Exit criteria:** registry lists `ansible` with shape `external`;
`validate.sh` passes including the authorization check; `install.sh`
prints a launch line a human can paste.

### Phase 3 — Verify in a real client (human-in-the-loop)
Not a separate task file unless it uncovers work. Follow the wiring
snippet from a clean starting point in at least one client other than
this session's own pre-configured OpenCode instance — a snippet that only
works where the server was already wired proves nothing. If a client
cannot be verified (not installed, human unavailable), record that
explicitly in TASK-0007's execution log rather than silently claiming
coverage, and let the residue roll into TASK-0006.

**Exit criteria:** Phase 1's Roadmap milestone ("first component
installed and used in a real session") is genuinely met, or the gap is
named.

## Tasks generated
| Task | Phase | Depends on | Status |
|------|-------|-----------|--------|
| TASK-0005 — External MCP server shape and script support | 1 | TASK-0004 (done) | planned |
| TASK-0007 — Port the ansible MCP server | 2, 3 | TASK-0005 | planned |

TASK-0006 (client config snapshots) is unchanged and still follows.
Boundary with TASK-0007: TASK-0007 writes only the *ansible* rows into
`configs/*/README.md`; TASK-0006 owns the general structure of those
snapshots. If TASK-0007 finds itself designing the snapshot format
rather than filling it in, that is TASK-0006's work leaking — stop and
re-scope rather than absorbing it.

## Acceptance criteria (plan level)
- [ ] `mcp-servers/` contains a real, non-template external server.
- [ ] `docs/registry.md` lists it, generated — not hand-edited — with
      its shape stated.
- [ ] `tests/validate.sh` mechanically enforces the destructive-
      capability authorization rule that is currently prose-only.
- [ ] No upstream source is vendored (ADR-0005 compliance).
- [ ] The wiring snippet is verified from a clean start in ≥1 client, or
      the absence of that verification is recorded.
- [ ] `AGENTS.md`, the authoring guide, `PROJECT_MAP.md`, `GLOSSARY.md`
      and ADR-0005 all agree on where external-server metadata lives.

## Risks
- **Node version mismatch.** The package declares `engines.node >= 24.0`;
  this machine runs Node v22.23.2 and the server nonetheless runs (npm
  `engines` is advisory by default). The manifest must record the
  *declared* requirement, and the wiring snippet must not imply v22 is
  supported. A future npm/Corepack setting that enforces `engines`
  would break this silently. Mitigation: record both the declared
  requirement and the tested-on version in the manifest.
- **`npx -y` fetches from the network at every launch** and, without a
  pinned version, can silently upgrade across a breaking change.
  Mitigation: consider pinning `@ansible/ansible-mcp-server@<version>`
  in the launch command; decide in TASK-0007 and state the reasoning.
- **Schema churn.** Designing `server.json` against a sample of exactly
  one server risks a schema that fits ansible and nothing else. Mitigation:
  sanity-check the draft schema against the *other* two known candidates
  (proxmox → `uvx`, obsidian → `npx` + vault env var) on paper, even
  though neither is being ported. If a field only makes sense for
  ansible, it does not belong in the template.
- **`validate.sh` gains a JSON-parsing dependency.** It is currently pure
  bash + grep. `jq` and `python3` are both present on this machine;
  neither is currently declared as a repo prerequisite. Prefer `python3`
  (the repo already mandates Python 3.10+ for authored servers, so it is
  an existing assumption rather than a new one) and declare it in
  `AGENTS.md`'s Commands section. Do not hand-roll JSON parsing in grep.
- **Scope creep into TASK-0006** — see the boundary note above.
- **No git remote is configured.** "Push to GitHub" in `AGENTS.md`'s Git
  rules is currently unsatisfiable; every task so far has recorded
  "nothing to push". Not this plan's problem to fix, but do not let a
  task hang waiting on it.

## Human decisions required
Both resolved at plan time (see "Resolved ambiguities"); recorded here so
a later session does not re-litigate them:
1. Manifest shape — **decided**: `mcp-servers/<name>/server.json`.
2. Destructive-capability authorization — **decided**: granted, ship
   enabled, disclose in manifest + wiring snippet.

Still open, deferred to TASK-0007 and small enough to decide in-flight:
- Whether to pin the upstream version in the launch command.
- Which client(s) Phase 3 verification actually covers.
