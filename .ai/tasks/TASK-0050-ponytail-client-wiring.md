# TASK-0050 — ponytail as per-client wiring documentation

## Objective

Document how ponytail is wired into each client this repo targets, in
`configs/*/README.md`, describing **each client's own mechanism** and
saying plainly where a client has none or where the status is unverified.

## Minimal context

ponytail (`@dietrichgebert/ponytail`, MIT) is a prompt ruleset plus six
Agent Skills. It is the sprint's hardest case, because it is a "plugin" in
both target clients through two unrelated mechanisms, and it cannot use the
shape that would have made it portable.

### Why it is documentation and not a component

Upstream ships `ponytail-mcp/`, which would have been the portable answer:
the ruleset as an MCP prompt plus a read-only tool, wireable through
ADR-0005's external shape like graphify. But its `package.json` declares
`"private": true` and `registry.npmjs.org/ponytail-mcp` returns **Not
found** (checked 2026-09-16). ADR-0005's external shape is for packages
published upstream; with nothing published there is no `launch.command` to
record. **Re-check this before writing** — if upstream has published it
since, this task's shape changes and that is a finding, not an
inconvenience.

Vendoring the six skills is refused for a mechanical reason, not taste:
`install.sh:105` deploys skills with `ln -sfn`, so vendored copies would be
symlinks into this repo's working tree, making this repo the
maintainer-of-record for independently-shipping upstream content
(ADR-0004's three-copies problem, and the same mechanism that invalidated
ADR-0015's shape in S6).

### The three clients are genuinely different, and flattening them is the failure mode

Per upstream documentation, to be **confirmed against `TASK-0048`**:

- **Claude Code** — `/plugin marketplace add DietrichGebert/ponytail` then
  `/plugin install ponytail@ponytail`, as two separate prompts. Runs two
  Node lifecycle hooks, so `node` must be on the *non-interactive* shell's
  PATH.
- **OpenCode** — an npm plugin entry: `{"plugin": ["@dietrichgebert/ponytail"]}`.
  Note the package's `main` points at `./.opencode/plugins/ponytail.mjs`;
  whether that resolves is `TASK-0048` Q3.
- **Bionic** — **unverified**, and it must stay labelled that way.
  `ADR-0020` established that Bionic *does* have an Agent Skills target
  (`~/.lmstudio/skills/`, `<project>/.agents/skills/`), and `B-018`
  records that global installs there are approval-gated. Neither fact
  means ponytail has been tried there.

`ADR-0021` clause 5 requires each claim to be labelled *vendor doc* or
*observed on <date>, <version>*. This task is where that rule earns its
keep: three clients, one product, and a strong temptation to write one
instruction that is false for at least one of them.

### State left outside the plugin directory

Upstream's own README lists files ponytail writes that its host's
`/plugin remove` does not clean up: `~/.claude/.ponytail-active`,
`~/.config/ponytail/config.json`, entries in `~/.cursor/hooks.json`, and —
if the setup nudge is accepted — a `statusLine` entry in
`~/.claude/settings.json`. This repo neither creates nor prunes any of it.

Document it, for the same reason `configs/opencode/README.md` documents the
two `git-ops` copies: so a user who finds it has an explanation rather than
an alarm. That note's own wording is the model — *"recorded so that finding
two `git-ops` files is explicable rather than alarming."*

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `TASK-0048` execution log | TASK-0048 | **done**; Q3 answered (does the OpenCode npm entry load?) and Q4 if reached (Claude Code marketplace + what it writes outside its dir) |
| `ADR-0021` | this sprint | ratified (preferred) or `Proposed`; clauses 3, 5 and 6 are the operative ones |
| `configs/claude-code/README.md` | TASK-0006 | present; wiring snapshot to be extended |
| `configs/opencode/README.md` | TASK-0006 | present; 151 lines; note its existing structure — Skills / Agents / MCP servers |
| `configs/lm-studio-bionic/README.md` | TASK-0006, ADR-0020 | present; already carries Bionic's corrected identity |
| `ADR-0020` | TASK-0047 | accepted; source of Bionic's real skills targets and its unverified status |
| `B-018` in `.ai/planning/BACKLOG.md` | TASK-0047 | `ready`; the approval-gating constraint — **reference it, never restate it** |
| `tests/validate.sh:643-652` | TASK-0006 | the per-client wiring-snapshot check; confirms all three files must exist |
| upstream ponytail README | third party | re-fetched at execution time, not cited from this brief |
| `registry.npmjs.org/ponytail-mcp` | third party | expected still 404; **re-check** — publication would change this task |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

- A ponytail section in each of the three `configs/*/README.md`, each
  giving that client's own mechanism, with claims labelled per ADR-0021
  clause 5.
- An explicit statement in each section that **this repo does not install
  ponytail** — the user runs upstream's installer (ADR-0021 clause 4).
- The out-of-plugin-directory state files, listed by absolute path, with a
  note that nothing here prunes them.
- Bionic recorded as **unverified**, referencing B-018 rather than
  restating its content.
- The `node`-on-non-interactive-PATH requirement for the hook-based
  installs, since a silent failure there degrades ponytail to
  instruction-only without saying so.
- A pinned version reference (`4.10.0` at plan time) plus the date, so a
  reader knows how old the instructions are.

### Not included

- Vendoring ponytail's skills, hooks, or ruleset into `skills/` or
  anywhere else. Explicitly forbidden by ADR-0021 clause 3.
- `mcp-servers/ponytail/` — impossible while `ponytail-mcp` is
  unpublished; see Minimal context. If publication has happened, **stop and
  re-scope** rather than improvising a manifest inside this task.
- Any `install.sh` change.
- Adding ponytail to `~/.config/opencode/opencode.jsonc` or
  `~/.claude/plugins/` as part of this task — `TASK-0048` does that
  temporarily and reverts; this task only documents.
- graphify's MCP manifest (`TASK-0049`) and omniroute (`TASK-0051`).

## Likely files

Forecast, written before the work:

- `configs/claude-code/README.md`
- `configs/opencode/README.md`
- `configs/lm-studio-bionic/README.md`
- `.ai/tasks/TASK-0050-*.md`, `.ai/sessions/*`, `.ai/context/CURRENT_STATE.md`

No component directory, no script, no registry change is expected. The
registry has no section for client-native extensions, and adding one would
be the category ADR-0021 declined.

## Execution plan

1. Re-fetch upstream's README and re-check `ponytail-mcp` on npm. If it is
   now published, **stop** and raise the re-scope rather than continuing.
2. Read `TASK-0048`'s log and separate what was *observed* from what is
   only *documented*. Anything unobserved must carry the vendor-doc label.
3. Write the Claude Code section: marketplace + install as two prompts, the
   two lifecycle hooks, the `node` PATH requirement, and what it writes
   outside its plugin directory.
4. Write the OpenCode section: the npm plugin entry and its observed
   behaviour from Q3. **If Q3 found it does not load, say so** — ADR-0021
   clause 6 requires that over printing an entry that does not work.
5. Write the Bionic section: what is known (Agent Skills targets exist per
   ADR-0020), what is not (nothing about ponytail there), and why nothing is
   deployed (B-018's approval gating, by reference).
6. Grep the three files for any claim that ponytail is *installed* or
   *deployed* by this repo, and remove it. The verb matters: this repo
   documents.
7. Run `tests/validate.sh`. Note that it checks these files *exist*, not
   that their content is true — so a green gate here proves almost
   nothing, and that fact belongs in the log.

## Acceptance criteria

- [ ] All three `configs/*/README.md` carry a ponytail section.
- [ ] Each section describes **that client's** mechanism; no single
      instruction is presented as working everywhere.
- [ ] Every capability claim is labelled *vendor doc* or *observed on
      <date>, <version>*, per ADR-0021 clause 5.
- [ ] Each section states that this repo does **not** install ponytail.
- [ ] The out-of-plugin-directory state files are listed, with a note that
      nothing here prunes them.
- [ ] Bionic is labelled **unverified**; B-018 is referenced, not restated.
- [ ] If `TASK-0048` Q3 found the OpenCode entry does not load, that is
      stated plainly rather than omitted.
- [ ] `ponytail-mcp`'s unpublished status was **re-checked**, with the date.
- [ ] Nothing vendored: `git status` shows no new files under `skills/`,
      `agents/`, `loops/` or `mcp-servers/`.
- [ ] The log records that `validate.sh` cannot verify any of this
      content — presence only.
- [ ] `tests/validate.sh` passes.

## Mandatory validations

- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh — **expected not required**; no component
      changes. If it turns out to be needed, that is a scope surprise worth
      recording.

## Risks and rollback

- **Flattening three mechanisms into one instruction.** The likeliest
  defect, and it produces confidently wrong documentation. Mitigation:
  write the three sections separately and resist a shared "install"
  heading.
- **Presenting vendor documentation as observation.** ADR-0020's whole
  lesson. Mitigation: the per-claim label is mandatory, not decorative.
- **A green gate read as content approval.** `validate.sh:643-652` checks
  the file exists. This is the "presence check read as a correctness check"
  risk the ROADMAP already lists; state it in the log where a reader will
  hit it.
- **Bionic quietly inheriting a pass it never took.** ADR-0020 records
  exactly this happening once already, when a classic-LM-Studio
  verification was credited to Bionic. Do not repeat it.
- **The instructions decay.** ponytail is at 4.10.0 and ships often;
  upstream also renames host targets as vendors rebrand (its README already
  tracks a Gemini CLI → Antigravity CLI rename). A dated, pinned reference
  is the mitigation.
- Rollback: revert the three files. Nothing outside the repo changes.

## Outputs / handover

*Intended* end state — this task has not run.

| Artifact | End state |
|----------|-----------|
| `configs/claude-code/README.md` | Ponytail section: marketplace mechanism, two hooks, `node` PATH requirement, out-of-dir state files |
| `configs/opencode/README.md` | Ponytail section: npm plugin entry with its **observed** load result from Q3, stated either way |
| `configs/lm-studio-bionic/README.md` | Ponytail section: explicitly **unverified**, B-018 referenced for the approval gate |
| `skills/`, `agents/`, `loops/`, `mcp-servers/` | **Deliberately unchanged** — nothing vendored, no manifest possible while `ponytail-mcp` is unpublished |
| `.ai/tasks/TASK-0050-*.md` | Log recording the re-checked `ponytail-mcp` status, the observed-vs-documented split, and that the gate cannot check this content |

**Next task starts here**: `TASK-0051` picks up from three written wiring
sections and generalises the placement rule into the authoring guide, plus
documents omniroute as the deliberately-excluded case. Record any deviation
from this plan here.

## Status

- Status: planned
- Owner: agent
- Created: 2026-09-16
- Updated: 2026-09-16

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
