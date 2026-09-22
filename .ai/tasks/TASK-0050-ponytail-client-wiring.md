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

- [x] All three `configs/*/README.md` carry a ponytail section.
- [x] Each section describes **that client's** mechanism; no single
      instruction is presented as working everywhere.
- [x] Every capability claim is labelled *vendor doc* or *observed on
      <date>, <version>*, per ADR-0021 clause 5.
- [x] Each section states that this repo does **not** install ponytail.
- [x] The out-of-plugin-directory state files are listed, with a note that
      nothing here prunes them. **Plus the uninstall ordering trap.**
- [x] Bionic is labelled **unverified**; B-018 is referenced, not restated.
- [x] If `TASK-0048` Q3 found the OpenCode entry does not load, that is
      stated plainly rather than omitted. It loads; the section states the
      evidence is package-resolution, **not** an in-client load, and says
      why the stronger claim was unobtainable.
- [x] `ponytail-mcp`'s unpublished status was **re-checked**, with the date.
      Both the bare and scoped names → 404, 2026-09-23.
- [x] Nothing vendored: `git status` shows no new files under `skills/`,
      `agents/`, `loops/` or `mcp-servers/`. **Only the three `configs/`
      files changed.**
- [x] The log records that `validate.sh` cannot verify any of this
      content — presence only. **Stated in each of the three sections too**,
      where a reader meets it, not only here.
- [x] `tests/validate.sh` passes.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh — **expected not required**; no component
      changes. Run anyway to confirm: `docs/registry.md` unchanged.

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

| Artifact | End state |
|----------|-----------|
| `configs/claude-code/README.md` | Ponytail section under a new `## Third-party extensions` heading: marketplace as two prompts, **three** hooks (not two), `node` PATH requirement with its silent-degradation note, out-of-dir state files, uninstall ordering |
| `configs/opencode/README.md` | Ponytail section: npm plugin entry, the Q3 result labelled as package-resolution evidence, the checkout alternative, and **two** independent reasons the skills are not vendored |
| `configs/lm-studio-bionic/README.md` | Ponytail section: explicitly **UNVERIFIED**, B-018 referenced not restated, plus the new finding that upstream makes no claim about this client either |
| `skills/`, `agents/`, `loops/`, `mcp-servers/` | **Unchanged** — nothing vendored; `ponytail-mcp` re-checked and still unpublished |
| `docs/registry.md` | **Unchanged**, confirmed by running the generator |

**Next task starts here**: `TASK-0051` picks up from three written wiring
sections. Two things it must carry:

- **`ADR-0021`'s routing rows are non-exclusive in practice, and both
  products prove it** — graphify is an `mcp-servers/` component *and* has a
  client-native OpenCode surface; ponytail is `configs/`-only but spans four
  surfaces within that.
- **A gap this task deliberately did not fill.** graphify now has a
  manifest and a registry row but **no `configs/*/README.md` wiring
  section**, while ansible has one in all three. `TASK-0049` excluded it as
  belonging to this task's category; this task's own scope excludes
  graphify. Neither brief owns it, so it is a genuine seam between two
  briefs rather than an oversight by either — `TASK-0051` should route it or
  raise it.

**Deviations from the Plan — two, both corrections to the brief itself:**

1. **The Claude Code hook count in the brief is wrong.** The brief and
   `TASK-0048` both say *two* lifecycle hooks. The shipped Claude Code
   manifest declares **three**. See the log.
2. **"Schema-compatible with ADR-0003" (TASK-0048 Q4) needed qualifying.**
   The *keys* are compatible; the *values* are not — all six skills use a
   folded `description: >`, which this repo's own gate rejects outright.
   That turns the no-vendoring decision from a one-reason call into a
   two-reason one, the second mechanical and checkable.

## Status

- Status: done
- Owner: agent
- Created: 2026-09-16
- Updated: 2026-09-23

## Execution log

### Attempt 1

- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context)

#### The gating re-check: `ponytail-mcp` is still unpublished

Step 1 of the plan exists to stop the task if upstream has published the MCP
package, which would change its shape entirely. Checked **both** plausible
names, 2026-09-23:

```
registry.npmjs.org/ponytail-mcp                 -> E404 Not Found
registry.npmjs.org/@dietrichgebert/ponytail-mcp -> E404 Not Found
```

The scoped name was not in the brief; checking it too is what makes the
negative result worth anything. `@dietrichgebert/ponytail` itself is
**4.10.0**, MIT — unchanged since plan time. So the task proceeds as
documentation, and `ADR-0005`'s external shape remains unavailable for want
of a published package.

#### Correction 1 — the Claude Code plugin installs THREE hooks

The brief says two. `TASK-0048` Q4 says two. Both are reading
`hooks/copilot-hooks.json`. The Claude Code manifest in the same tarball is
`hooks/claude-codex-hooks.json`, and it declares three:

| Event | Script | Timeout |
|---|---|---|
| `SessionStart` (matcher `startup\|resume\|clear\|compact`) | `ponytail-activate.js` | 5 |
| `SubagentStart` | `ponytail-subagent.js` | 5 |
| `UserPromptSubmit` | `ponytail-mode-tracker.js` | 5 |

The two files differ in more than count: Claude Code's uses
`${CLAUDE_PLUGIN_ROOT}`, PascalCase event names and `timeout`; Copilot's
uses `${PLUGIN_ROOT}`, camelCase names and `timeoutSec`, with separate
`bash` and `powershell` forms.

**Upstream's README also says two** — *"the Claude Code and Codex plugins …
run two tiny Node.js lifecycle hooks"*. So this is a third
README-versus-source disagreement in one sprint, after graphify's OpenCode
surface and graphify's own install preview under-reporting its writes. The
section records the manifest's count and flags the discrepancy, because a
reader auditing their own hooks will otherwise find one they did not expect.

This is exactly what `TASK-0048`'s own deviation 3 warned about: Q4 was
answered *at package level*, labelled as such, and the label was honest —
but the brief then carried the copilot-derived number forward as though it
described Claude Code.

#### Correction 2 — the six skills would fail this repo's own gate

`TASK-0048` recorded the skills as *"frontmatter `name` + `description`,
schema-compatible with ADR-0003"*. The keys are. The values are not: all six
declare

```yaml
description: >
```

a folded scalar. `tests/validate.sh:86-94` rejects the bare block sigil for
skills outright — it *"reaches the registry as the literal sigil with the
text DROPPED, and the row still has the right column count"*, the defect
`TASK-0039` found. Verified against the script, not recalled.

This matters beyond pedantry: the no-vendoring decision rested on one
argument (the `ln -sfn` ownership problem, `ADR-0004`). It now rests on two,
and the second is mechanical — vendoring them would turn the gate red. The
OpenCode section states both. Upstream is not at fault; its skills simply
are not authored to this repo's registry constraint.

#### The OpenCode claim, kept at the strength the evidence supports

`ADR-0021` clause 6 asks for the honest version over the confident one, and
this is where it costs something. Re-confirmed 2026-09-23 that `main` and
both `exports` point at `./.opencode/plugins/ponytail.mjs` and that the file
ships in the 4.10.0 tarball; `TASK-0048` additionally ran a real
`npm install` plus the dynamic `import()` that OpenCode performs, which
succeeded.

That is **package-resolution evidence**, and the section says so in bold
rather than rounding it up to "works in OpenCode". The reason the stronger
claim is unavailable is recorded with it: `TASK-0048` put the entry in a
live config and started OpenCode twice, and neither ponytail **nor the
pre-existing working `opencode-arcade-hub` plugin** logged anything — so the
silence proved nothing. Relaying that control is what keeps the hedge
informative instead of merely cautious.

#### Bionic, and a finding that strengthens the "unverified" label

The brief asks for **unverified**, with `B-018` referenced rather than
restated. Both done. One thing added beyond the brief: a case-insensitive
search of the whole published tarball for `lm studio`, `lmstudio` and
`bionic` returns **no match** (2026-09-23).

So there is no vendor claim in *either* direction — nothing to relay and
nothing to contradict. That is a stronger position than "we did not test
it", because it forecloses the tempting move of citing upstream support that
does not exist. The section also names the specific inference it refuses:
*"it has a skills directory and these are skills"* is the shape of the error
`ADR-0020` was written about.

#### What the gate can and cannot say about this task

`tests/validate.sh:643-652` checks that each `configs/<client>/README.md`
**exists**. It does not read a word of it. So the green gate below is
evidence that three files are present and nothing more — every factual claim
in them rests on the labels and dates, not on the check.

That sentence is in the log because the brief asks for it, **and in all
three sections** because that is where a reader will actually be standing
when it matters.

- Validation: `tests/validate.sh` → **OK**. `scripts/sync-registry.sh` run
  as a control although no component changed — `docs/registry.md` unchanged,
  confirming the forecast. `git status` shows **only** the three
  `configs/*/README.md` files: nothing under `skills/`, `agents/`, `loops/`
  or `mcp-servers/`.
- Result: **done.** All twelve acceptance criteria met. Two of the brief's
  own factual inputs were corrected in the process, both traceable to
  `TASK-0048` answering Q4 from the package rather than from an install —
  which it disclosed at the time.
- Commit: `0bc5e9d` — "Document ponytail per client; correct two of its
  brief's inputs". Pre-commit hook ran `tests/validate.sh` → OK.
- Push: **confirmed** to `origin` (`17abb08..0bc5e9d`); branch in sync,
  `git remote -v` token-free.
