# Current State

Last updated 2026-09-14, after opening sprint S6 (planning only — no
implementation yet).

## Sprint S6 is open — planning complete, nothing implemented
`PLAN-0003` opened Phase 6: an **instruct layer** for the `ansible` MCP
server (skill + loop), a narrowing of that server's blast radius, and one
real enforcement. Ten artifacts written, zero components changed:
TASK-0026…0032, ADR-0014…0016 (all **proposed**), B-010…B-013.

**The sprint began from a human-supplied analysis rather than a backlog
item** — a first for this repo — and **six of its claims were corrected
before planning finished**. In order of consequence:

1. **There is no staging inventory in the target estate, and there cannot
   be one.** The analysis's central worked example
   (`--check --diff -l staging`, then `-l staging`, then production) is
   unimplementable against one inventory file, one 6-node PVE cluster at
   3-of-4 quorum with no verified margin, and one DC holding all seven FSMO
   roles. The real workflow is **`--check --diff` plus snapshot and
   rollback**. Building from the source text would have produced a runbook
   gating on an inventory that does not exist.
2. **The pinned MCP server exposes 2 of the 7 capabilities the analysis
   recommends** — and they are the two destructive ones. Verified by live
   tool enumeration, not by reading its README.
3. **`ansible_navigator` has no inventory, limit, `--check` or `--diff`
   parameter**, so it cannot perform the safe workflow while it *can*
   execute against production. Human authorized disabling it (2026-09-14).
4. **This repo overstates its own blast radius.** `server.json:22` calls
   `WORKSPACE_ROOT` "the blast radius for the destructive tools below" —
   false for `ansible_navigator` (reaches remote infrastructure) and
   `ade_setup_environment` (installs OS packages system-wide). Restated in
   all three `configs/*/README.md`, so a reader is told the same wrong
   thing four times. **Lesson 6 reappearing inside `mcp-servers/` and
   `configs/`.**
5. **`userMessage` undercuts the determinism argument for MCP.** It is a
   natural-language string the server parses to locate a playbook, so
   invocation is LLM-message-parsed, not schema-pinned.
6. **Value inverts from the analysis's ranking.** Highest value is the
   *guard*, not the skill; MCP is lowest.

**S6's highest-value item is TASK-0031**, and it is not a component. The
target repo's `ansible.cfg:21-48` documents that default fact-gathering
stats `/etc/pve`, which on wedged pmxcfs is an uninterruptible D-state hang
that `timeout` cannot kill; records that **both** global fixes fail
(rejected in `[defaults]`, silently ignored in group_vars — verified
empirically there); and concludes "A code-review or CI check should confirm
this… **Tracked as unenforced until then.**" A written rule, node-hanging
failure mode, statically checkable, enforced by nothing. Being static, it
survives TASK-0028 reporting either way.

**Limitation recorded at plan time, not at checkpoint:** under Option (a)
`ansible-ops` is authored *from* `SIGMA-infrastructure` but never executed
*in* it, so it will end S6 as **unexercised scaffolding — the same status
`mcp-servers/_template/` already carries**. S5's equivalent limitation
surfaced only at REVIEW-0007; this one is stated up front and should be
S6's headline checkpoint finding.

**`SIGMA-infrastructure` is read as evidence and never modified** (human
decision, Option a). Its four stale claims (`.ansible-lint:4`,
`.pre-commit-config.yaml:42`, `ci.yml:13,44`, `requirements.yml:4-6`) and
its 42 unpushed commits are recorded by TASK-0032 and fixed nowhere;
adoption there is that repo's own sprint to open. Its `ansible-lint` gate
has also never had content to lint — `profile: production` is set and
`playbooks/` is not excluded, so it should now be linting two committed
playbooks, but no run has ever been recorded.

Two gate properties discovered while planning, both of which changed the
file layout:
- `tests/validate.sh:456-463` **fails** any file in `.ai/tasks/` not
  matching `TASK-####-*.md`. So the two spikes are **numbered task briefs**,
  not a new `SPIKE-####` artifact type — weakening the gate for a naming
  preference would have been the wrong trade.
- `:402`, `:450-465` require `## Inputs` and `## Outputs / handover`
  non-empty for **every** brief ≥ 0020, including unexecuted ones. So each
  planned brief states an explicitly-labelled *intended* end state; the
  check detects omission, not correctness, and cannot tell the difference.

## Where the project is
- **Phases 1–4 complete, with no outstanding criteria in any of them.**
  S1–S4 are archived in `.ai/planning/sprints/`; checkpoints
  REVIEW-0003…REVIEW-0006. Phase 2's last partial criterion closed
  retroactively by TASK-0017.
- **Phase 5 / sprint S5 complete** (`PLAN-0002`, ADR-0012,
  TASK-0020…0023, checkpoint REVIEW-0007). The skill now states a session
  boundary, a read order and a handover contract; both task templates
  carry `## Inputs` and `## Outputs / handover`; `validate.sh` enforces
  their presence. Skill at `3.1.0`.
- **S5's headline benefit is untested.** All four tasks ran in one
  session, so no `Inputs` table was ever read by a context that had not
  written it. The contract is proven writable and proven to catch stale
  declarations within a session; making a *cold* start cheap remains a
  hypothesis (REVIEW-0007 finding 8). **The next task started after a real
  session gap should record whether its `Inputs` table sufficed.**
- **All three clients are now fully verified** for the ansible MCP server:
  Claude Code `✔ Connected`, OpenCode in live use, and LM Studio verified
  in its own UI (not merely at handshake level).
- B-001…B-008 are all closed. The supposed `main`/`master` default-branch
  mismatch was **retracted as false** by TASK-0019 — it never existed.
- **`.ai/decisions/` filenames are now uniform** (`NNNN-short-title.md`,
  TASK-0024, closing B-008), matching the `project-workflow` convention
  this repo publishes. The *identifier* remains `ADR-NNNN` in every H1 and
  throughout prose — only filenames changed.
- **B-001…B-009 are all closed; B-010…B-013 are open**, raised by
  PLAN-0003 and scoped in S6. B-009 closed by TASK-0025/ADR-0013 as
  *decided, not implemented*: its premise — that the two skills share a
  convention — was false. Two of the four new items (B-012, B-013) are
  corrections to **this repo's own claims** rather than to a component.
- **The two skills scaffold two different frameworks, deliberately**
  (ADR-0013). `project-migration`: `context/`, `planning/`, `sessions/`,
  `templates/`, `TASK-####`, `ADR-NNNN-*.md`, entry `AGENTS.md` — **this
  repo runs it** (ADR-0001, `.ai-layout.json`). `project-workflow`:
  `00.CONVENTIONS.md` + `20/30/35` + `reference/`, `S###.T###`,
  `NNNN-title.md`. Nine structural differences. Each `SKILL.md` now names
  the other; do not "align" them.
- Three live components: the `project-migration` (`1.1.0`) and
  `project-workflow` (`3.2.0`) skills (deployed to Claude Code and
  OpenCode), and the `ansible` external MCP server. One loop:
  `loops/release-check`.

## What S5 is fixing, and why it is not obvious
The `project-workflow` skill's task template has Goal, Plan, Files
touched, Verification, Status notes. **Nothing names what a task consumes
and nothing names what the next task picks up**, so a task file cannot be
picked up cold in a fresh session. Meanwhile the skill presumes
multi-session work in three places — `00.CONVENTIONS.md:6`,
`reference/size-budgets.md:6`, and the byte budgets themselves, which
exist *because* files are re-read cold — without ever stating a session
boundary or a read order. The presumption is load-bearing and unwritten.

This repo is **ahead of the skill it owns**: `.ai/templates/TASK.md`
already carries `Minimal context`/`Preconditions`/`Dependencies`/
`Expected result`, and `.ai/sessions/` has been a working narrative
bridge for eleven sessions. None of it propagated back, which
`reference/skill-maintenance.md:23-26` requires and ADR-0004 makes this
repo's job. The skill is not behind through neglect of the skill — it is
behind because nobody checked the repo's own practice against it.

## Infrastructure now in place
- **Remote:** `origin` → `armandomartires/ai-toolbox`, **private**, wired by
  TASK-0015 from `GITHUB_URL`/`GITHUB_TOKEN`. Remote URL is token-free and
  must stay that way.
- **CI:** `.github/workflows/validate.yml` is **verified** — run #1 passed
  all 7 steps. It re-runs `validate.sh` and the registry-staleness check.
  A second opinion, not the gate.
- **Commit gate:** `tests/validate.sh` via `.githooks/pre-commit`. Offline,
  hermetic, ~0.37 s, and passes with the entire environment unset. All three
  properties are load-bearing.
- **Environment:** `.env.example` documents every variable (names and
  meanings only, never values). Copy to `.env` (gitignored). Nothing is
  needed for local development or validation.
- **Licensing:** MIT `LICENSE` at the repo root, backing both skills'
  `license: MIT` frontmatter.

## What `validate.sh` enforces
Skill frontmatter (parsed, not grepped: delimiters, name/directory equality,
single-line description, non-empty license, semver version) · MCP shape and
manifest integrity incl. destructive-capability authorization · loop
structure incl. mandatory exit conditions · every `install.sh` client having
a `configs/*/README.md` · the pre-commit hook's git-recorded mode · no
`_template` row in the registry · registry content integrity (no leaked
YAML quotes, no unescaped `|` in a cell, column count matching each
section's own header) · every manifest-required env var appearing in
`.env.example` · **handover sections** — `.ai/templates/TASK.md` carries
`## Inputs` and `## Outputs / handover`, and every task brief numbered
≥ 0020 (walked recursively, including `completed/`) has both, non-empty.

**What the handover check does not prove:** that declared inputs are the
real inputs, or that a declared end state matches the tree. It detects
omission, not correctness. A green gate means no section is missing or
empty — nothing more (ADR-0012 Decision 3; ADR-0009).

## Known gaps — recorded, not hidden
- **`skills/project-workflow/templates/00.CONVENTIONS.md` is 3087 bytes
  against its own declared ≲3 KB (3072) cap.** Fifteen bytes over, and
  nobody had measured it — the budget was stated in the file's header and
  never checked. Found while reading for PLAN-0002. TASK-0020 pays it by
  moving content to `reference/`, because
  `reference/size-budgets.md:35-38` forbids raising a cap to fit what is
  already there.
- **Hand-maintained tables in `.ai/` are unchecked.** `validate.sh`
  verifies column counts and pipe escaping in the *generated*
  `docs/registry.md` (TASK-0018), while B-004's row in
  `.ai/planning/BACKLOG.md` had sat *outside* its own table since
  TASK-0013 appended instead of inserted. Fixed by S5's planning session.
  The defect class was fixed downstream and live upstream the whole time.
  Not proposed as a new check — noted so the asymmetry is known.
- **The authored (Python) MCP shape has never run.** Only
  `mcp-servers/_template/` uses it and `smoke-mcp.sh` covers external
  manifests only. Deferred **by decision** with a reopen trigger — ADR-0010.
  Treat `mcp-servers/_template/` as unverified scaffolding. Do not re-add
  this to a candidate list.
- ~~**Default branch mismatch.**~~ **Not a gap — retracted as false**
  (TASK-0019, 2026-09-13). `default_branch` is `master` and `main` never
  existed. The claim came from reading a repo-creation response field that,
  with `auto_init: false`, reports the account's default branch *name
  preference* rather than an existing ref. Kept visible because the error
  pattern matters more than the non-gap: **a claim about external state
  restated three times without re-verification, each time more specific.**
- `opencode-customization` (a separate repo) has a stale project-workflow
  copy and an unresolved `S025_WorkflowHarmonization` sprint — that repo's
  follow-up, not this one's, per ADR-0004.
- `skills/*.zip` sit untracked: pre-existing artifacts, deliberately
  untouched.

## Standing decisions not to re-litigate
ADR-0002 symlink-first · ADR-0003 skill frontmatter schema · ADR-0004
ai-toolbox is canonical for project-workflow · ADR-0005 (+Clarification) two
MCP shapes, *derived* from which marker file is present · ADR-0006 LM Studio
is MCP-only, and loops are authored not ported · ADR-0007 local git
mandatory / remote recommended, automation is hook-first · ADR-0008 skill
linting is frontmatter-only, no invented line budget · ADR-0009
configuration is environment-supplied and validation checks documentation
completeness, never runtime presence · ADR-0010 Python MCP shape deferred ·
ADR-0011 registry validation is deterministic and hermetic, never
subagent-driven — a subagent cannot gate a commit · ADR-0012 task handover
is an explicit contract, **resumability** is the mandatory invariant while
one-task-one-session is only the default, and the handover check detects
omission rather than correctness.

Also settled: ansible's destructive tools are human-authorized (2026-09-13)
to ship enabled, disclosed in the manifest and every wiring snippet, and
enforced by `validate.sh`; its launch command is version-pinned so upstream
breaking changes cannot land silently.

## Environment notes (re-verified 2026-09-13)
- ansible MCP connects, 10 tools. proxmox still lacks `numpy` for its
  router; obsidian's desktop app still isn't running.
- Upstream ansible declares `node>=24.0` while this machine runs node
  v22.23.2 — npm warns `EBADENGINE` and it works, because `engines` is
  advisory unless `engine-strict` is set. If that changes, ansible launches
  break with no repo-side change.
- **`core.filemode=false` on this `/mnt/c` checkout**, and the 9p mount
  reports every file `rwxrwxrwx` while ignoring `chmod -x`. So `chmod +x`
  never reaches git's index and `[ -x ]` can never fail. Use
  `git update-index --chmod=+x`; `install.sh` warns and `validate.sh` fails
  on the mode git *records*. Full explanation in the runbook.

## Lessons that keep recurring
1. **A check that cannot fail is worse than no check, because it is still
   trusted.** Prove every new check fails for the right reason. Corollary
   from TASK-0017: **a green connection is not a validated configuration.**
   The ansible server connected and enumerated all 10 tools with
   `WORKSPACE_ROOT` set to a nonexistent placeholder path, because nothing
   in the MCP handshake touches the filesystem.
2. **An item can look blocked when it is merely undocumented.** S4 found two
   (the remote, and B-002's mis-titled scope). Check which before carrying
   anything forward again. Corollary from TASK-0018: **an item's age is not
   an argument for implementing it.** B-001 and B-002 were both scaffold
   boilerplate; one held a real requirement, one did not. Scope each on its
   merits — but *do* scope it, because scoping B-001 found two defects even
   though the item itself was closed as superseded.
   **Now three for nine** (B-001 superseded, B-002 split, B-009 false
   premise): a backlog item's *title* encodes an assumption, and roughly a
   third of them do not survive contact with the files. B-009 is the
   sharpest case — it was written one task earlier, by this agent, from a
   single grep hit, and proposed changing the scaffold that produced the
   very structure the repo runs. **Read the artifacts before estimating
   the work.**
3. **The obvious check is often the wrong one.** "Is the env var set" and
   `grep -q '^name:'` both looked reasonable and both would have been
   useless or harmful.
4. **A criterion written at scaffold time may meet reality and lose.**
   ADR-0005 through ADR-0010 all exist for that reason.
5. **A test that clones for isolation may isolate itself from the change it
   verifies** (TASK-0014's first harness reported clean against the old
   script).
6. **A budget nobody measures is not a budget.** `00.CONVENTIONS.md`
   declared ≲3 KB in its own header and sat 15 bytes over it; Phase 4's
   roadmap header read "in progress" after every criterion was met;
   TASK-0019 was done but never ticked in `TODO.md`; B-004's table row had
   fallen out of its table. Four independent instances, all found by
   *reading* the governance files during S5 planning rather than by any
   check. The pattern: **the governance layer polices components and
   nothing polices the governance layer.** That is the argument for S5, and
   also the caution against over-trusting the check S5 adds.
   **Recurred immediately:** Phase 5's own roadmap header read "in
   progress" after every criterion was met, fixed by REVIEW-0007. The
   lesson needs a mechanism, not more prose.
7. **A claim decays between being written and being acted on.** S5's four
   tasks each found a false claim in their own inputs — a stale symlink
   assertion, a false premise in ADR-0012, a four-way merge that would
   have destroyed narrative, and an escape hatch in the new check. Three
   had been written by the same agent one session earlier. Not
   carelessness: **planning prose is a hypothesis about files, not a
   description of them.** Open the file named in a declaration.
8. **Knowing "a check that cannot fail is worse than no check" does not
   prevent authoring one.** PLAN-0002 specified two deployment checks that
   compare a symlink with its own target; they were written in the sprint
   that cites this very lesson, by an agent that had just restated it.
   The control is not knowing the rule — it is running the check against
   a deliberately broken input before trusting it.

## Validations
`tests/validate.sh` (mandatory, automatic via hook) · `scripts/sync-registry.sh`
· `tests/smoke-mcp.sh` (network-dependent, manual, PASS/FAIL/SKIP as three
distinct outcomes — a SKIP is not a pass) · CI on every push.

Validated in WSL (development). Deployment targets: local agent clients via
`scripts/install.sh`.
