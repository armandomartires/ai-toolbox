# REVIEW-0009 — Sprint S8, Third-party agent extensions

- Task(s) reviewed: TASK-0048 (spike), TASK-0049 (graphify), TASK-0050
  (ponytail), TASK-0051 (placement rule + omniroute). **`ADR-0021` is still
  `Proposed`.**
- Reviewer: Claude Opus 5 (1M context) — agent self-review. Evidence
  **re-run** rather than re-read wherever a command existed; upstream
  versions re-resolved against npm rather than quoted from the task logs.
- Date: 2026-09-23
- **Number:** `REVIEW-0009` was reserved by `SPRINT-CURRENT.md` for this
  sprint and left unused when S6's checkpoint took `REVIEW-0010`. This file
  claims it as intended.

## Diff summary

Eight commits, `feba3e0..98d7cdc`. **16 files, +1495/−176.**

| Group | Commits | What |
|---|---|---|
| Spike | `90db5a4`, `f9686da` | TASK-0048. No component file changed; machine restored and md5-verified |
| graphify | `2c26044`, `17abb08` | `mcp-servers/graphify/server.json`, registry row, **two** authorized `smoke-mcp.sh` fixes, `.gitignore` |
| ponytail | `0bc5e9d`, `4ddfd48` | `Third-party extensions` sections in all three `configs/*/README.md` |
| Rule + omniroute | `1c5cabf`, `98d7cdc` | Authoring-guide placement section, `docs/development/third-party-tools.md`, B-023 raised |

New artifacts: `mcp-servers/graphify/server.json`,
`docs/development/third-party-tools.md`. Changed: `tests/smoke-mcp.sh`,
`docs/development/authoring-guide.md`, three `configs/*/README.md`,
`docs/registry.md`, `.gitignore`.

**Four sprint criteria verified mechanically rather than asserted:**

- **No `plugins/` (or `extensions/`, or `hooks/`) directory exists.**
- **No new-category plumbing.** `git diff feba3e0..HEAD --
  scripts/install.sh scripts/sync-registry.sh tests/validate.sh` is
  **empty** — all three untouched across the entire sprint.
- **Nothing vendored.** The same diff over `skills/ agents/ loops/
  prompts/` is **empty**.
- **`mcp-servers/` gained exactly one file**, 54 lines.

## Findings

### 1. The pre-committed question, answered: the spike changed things — and kept changing them after it ended

The checkpoint's question was fixed in advance: *did the spike change
anything, or did it rubber-stamp the vendor READMEs?* The plan also set the
bar for judging it — *"a spike reporting zero findings is more likely weak
than reassuring"*.

It reported six, and the correction did not stop when the spike did:

| # | Correction | Found by | Against |
|---|---|---|---|
| 1 | graphify's OpenCode integration is a **real plugin**, and also `AGENTS.md`, project config **and** an Agent Skill — four surfaces | TASK-0048 | graphify's README, and `ADR-0021` claim 1 |
| 2 | ponytail's npm entry **does** resolve | TASK-0048 | `ADR-0021` claim 2 |
| 3 | graphify's own install preview **under-reports what it writes** | TASK-0048 | the vendor's tool, against itself |
| 4 | The smoke-test precondition is `.graphify/graph.json`, **not** `.graphify/` | TASK-0049 | the brief, `ADR-0021` **and** B-020's own scoping |
| 5 | The Claude Code plugin installs **three** lifecycle hooks, not two | TASK-0050 | the brief, TASK-0048 **and** upstream's README |
| 6 | The six skills are schema-compatible in their **keys only** — all use a folded `description: >`, which this repo's gate rejects | TASK-0050 | TASK-0048's summary |

Three of those six contradict **this sprint's own artifacts**, not just a
vendor's. A rubber-stamp produces none of them. **The question is answered
with evidence: the spike was load-bearing, and the two tasks after it each
found something the spike had settled too confidently.**

### 2. A *labelled* limitation is not a *contained* one — the sprint's sharpest methodological finding

This is the finding worth carrying forward, and it is self-critical.

`TASK-0048` answered Q4 from the published package rather than from an
install, **and said so**, twice: in its deviations list and in the Q4
section. The label was honest and prominent. It still did not prevent the
error, because the number it produced was read from
`hooks/copilot-hooks.json` — **a different client's file** — and then
carried into `TASK-0050`'s brief as though it described Claude Code.
Upstream's own README repeats the same wrong count, so nothing in the paper
trail contradicted it.

The defect only surfaced because `TASK-0050` re-opened the tarball instead
of trusting a log that was, by its own account, trustworthy.

**The lesson is not "label harder".** It is that a label records *how* a
claim was obtained and says nothing about *what it is a claim about*. Q4's
label was accurate; its **subject** was wrong. `ADR-0021` clause 5 requires
the provenance label. Nothing requires the claim to name which artifact it
was read out of, and that is the gap.

Candidate rule, offered to the checkpoint rather than adopted here: *a
claim about a client cites the file it was read from, not only its date and
provenance.* Cheap, mechanical, and it would have caught this.

### 3. B-022 was found by verifying a fix, not by planning one

`TASK-0049` could have stopped once graphify reported SKIP. Its acceptance
criteria were satisfied at that point. It went one step further — placing a
graph to prove the SKIP was a *precondition gate* rather than a blanket
exemption — and that step found that **`tests/smoke-mcp.sh` had been
testing whether a server exits, not whether it speaks**.

`subprocess.run(..., timeout=)` waits for process termination. A conforming
MCP server keeps serving after `initialize`, so the harness reported
`no reply within 90s (server hung or never spoke)` **while holding the
correct reply it had already received**. `ansible` passed only because its
server happens to exit on stdin EOF — so the suite looked healthy, and the
defect was invisible for the entire life of the script (since TASK-0009).

Two things make this worth a finding rather than a line in a log:

- **It is strictly larger than the defect the task was scoped around.**
  B-020 was one server's precondition. B-022 was every long-lived server,
  forever, in a check whose header is unusually careful about the
  three-outcome contract.
- **The check that was not required is the one that found it.** That is a
  general argument for verifying fixes rather than asserting them, and it
  is the second time this sprint that going one step past the brief paid
  (finding 1, row 4 is the first).

### 4. S8 did not spend the gate budget it was pre-blamed for

`SPRINT-CURRENT.md` flagged this sprint in advance as *"the sprint most
likely to be blamed for a budget it did not spend"*, because it adds an
`mcp-servers/` entry. Measured now, five runs each, same machine:

| Surface | Median | Range |
|---|---|---|
| `/mnt/c` (9p bridge — the real working copy) | **1008 ms** | 993–1069 ms |
| `/tmp` (ext4, fresh clone) | **572 ms** | 537–714 ms |

`REVIEW-0010` recorded **~1085 ms** on the same surface *before* this
sprint. **The gate is not slower; if anything it is marginally faster.**
The accusation is answered with numbers.

Two things fall out:

- **`tests/validate.sh`'s own cost comment is accurate and correctly
  scoped.** It claims ~540 ms native and ~1000 ms on `/mnt/c`, and warns
  *"measure on a native path before concluding a check is expensive"*. Both
  numbers reproduce. `REVIEW-0008`'s ~40 % understatement figure for
  measuring on `/tmp` also holds — the observed gap is 43 %.
- **The stale claim is elsewhere, and in a file this sprint edited twice.**
  `tests/smoke-mcp.sh:10` describes `validate.sh` as *"fast, offline and
  hermetic (~0.4s)"*. That is wrong on both surfaces now — 43 % low on
  native, 60 % low on the working copy. S8 touched this file twice without
  noticing. Small, but it is precisely this repo's most-repeated defect
  class: **a claim one artifact makes about another that the other
  falsifies.** `docs/operations/runbook.md:60` has the same issue in
  milder form (*"offline, sub-second"* — true natively, false on `/mnt/c`).

This partially resolves `REVIEW-0010`'s first follow-up: the budget is not
being overspent, and the `validate.sh` comment is sound. What remains is
two stale second-hand numbers, now located precisely.

### 5. The review's own first measurement was false, and implausibility is what caught it

Recorded because it happened inside this checkpoint's method, not outside
it.

The first `/tmp` timing run returned **1–2 ms**. That is not a fast gate; it
is a gate that never ran. `git clone` had dropped the executable bit, so
`tests/validate.sh` exited 126 with *"Permission denied"* — the
`core.filemode` trap `TASK-0014` added an installer warning about. Timing
captured the failure, not the work.

Nothing in the measurement flagged it. It was caught only because 1 ms was
implausible for a check that does real filesystem work. **A green-looking
number from a command that never executed is the same shape as a check that
cannot fail** — this repo's recurring lesson, appearing in the tooling used
to audit it.

### 6. B-023 is a planning defect, and should be judged separately from the output

graphify ends the sprint with a manifest and a registry row and **no
`configs/*/README.md` wiring section**, while `ansible` has one in all
three clients. Neither preceding brief was careless: `TASK-0049` explicitly
assigned graphify's client-native surface to `TASK-0050`'s category, and
`TASK-0050`'s scope explicitly excluded graphify. **Each brief assigned it
to the other.**

That is a seam between two task definitions, invisible until both had run,
and it is a defect in `PLAN-0005`'s decomposition rather than in anyone's
execution. It is the first item in `BACKLOG.md` of that provenance.

It was raised rather than filled, on a reason worth endorsing: **no rule
exists** about whether every `mcp-servers/` entry owes three client
sections, and writing them would have answered that question by accident
using the weakest available case — graphify needs no env vars and exposes
no destructive tools, so `install.sh`'s generic output already carries most
of what a section would say.

### 7. The plan-time limitation held exactly as predicted, and its escape hatch was never tested

`SPRINT-CURRENT.md` predicted **two of three deliverables would be prose**,
called it the fourth instance of the class after
`mcp-servers/_template/`, `agents/`/`prompts/` and S7, and pre-committed a
defence: *"If this sprint shrinks, the honest cut is a product, never the
spike."*

Both halves should be recorded plainly:

- **The prediction was correct.** graphify is a real pinned component;
  ponytail and omniroute produced documentation only. Fourth instance,
  as forecast.
- **The defence was never exercised**, because nothing had to be cut. That
  is not evidence the rule works — it is an untested commitment, and it
  should be carried forward as one rather than retired as vindicated.

### 8. External claims *were* re-checked, cheaply, and the discipline found one thing

`REVIEW-0010`'s third follow-up asked whether anything re-checks external
claims at all. S8 is a data point: **every** upstream version was
re-resolved at execution time rather than carried from plan time.

| Package | Plan time (2026-09-16) | Re-checked 2026-09-23 |
|---|---|---|
| `@sentropic/graphify` | 0.18.0 | **0.18.0** |
| `@dietrichgebert/ponytail` | 4.10.0 | **4.10.0** |
| `omniroute` | 3.8.50 | **3.8.50** |
| `@omniroute/opencode-plugin` | 0.2.1 | **0.2.1** |

**No drift in seven days** — which is worth stating rather than hiding,
because the sprint predicted graphify's pre-1.0 status and omniroute's
churn would bite. They did not. The re-check still earned its keep once:
`TASK-0050` checked `ponytail-mcp` under **both** the bare and the scoped
name, and the scoped name was not in the brief. A negative result is only
worth something if the search was wide enough to have failed.

Nothing automates any of this, and nothing should be inferred about the
next sprint from four packages holding still for one week.

## Validation results

Re-run at review time, not quoted:

| Check | Result |
|---|---|
| `tests/validate.sh` | **OK**, 1008 ms median on `/mnt/c`, 572 ms on ext4 |
| `scripts/sync-registry.sh` + staleness | **in sync** — regenerating produces no diff, so CI's check passes |
| `tests/smoke-mcp.sh` (full) | **1 passed, 0 failed, 1 skipped.** ansible PASS; graphify SKIP with its precondition named |
| `tests/smoke-mcp.sh` with a graph present | **2 passed, 0 failed** (observed during TASK-0049) |
| Working tree | clean |
| Branch | `master` in sync with `origin`; `git remote -v` token-free |
| Manifest gate, negative control | Observed failing three ways on a deliberately broken copy; restore md5-verified |

**The shipped smoke state is a SKIP, not a PASS, and that is correct.** The
graph used to observe the PASS was fabricated (`{"nodes":[],"edges":[]}`)
and was deleted. A suite passing on a hand-written fixture would be this
repo's own *"check that cannot fail"*.

## Verdict

**Approve the work. This review cannot close the sprint.**

Every sprint-level acceptance criterion in `PLAN-0005` is met except the
first, and the first is not an agent's to meet. The criterion that carried
the sprint's purpose — *did the spike change anything* — is answered with
six corrections, three of them against this sprint's own artifacts, and
answered on method as the plan required rather than on verdict alone.

Approved with findings 2, 4, 5, 6 and 7 on the record. Findings 2 and 6 are
the ones worth acting on: the first is a gap in how claims are recorded, the
second a gap in how briefs are decomposed. Neither is a defect in what
shipped.

**Closure is blocked on an act this review cannot perform.** `ADR-0021` is
still `Proposed`, and `PLAN-0005`'s first acceptance criterion requires it
to be *"ratified or rejected by a human, on `TASK-0048`'s evidence — not on
agreement with its prose"*. Every ratification in this repo is a recorded
human decision — ADR-0017 rejected, ADR-0019 ratified same-day,
ADR-0014/0015/0016 ratified by `TASK-0054` eight days after their bodies
were written. An agent accepting it would manufacture the one signature the
convention exists to require.

**S8 therefore stays current.** The packet below is what the decision needs;
nothing else is outstanding.

## Ratification packet — what accepting `ADR-0021` commits you to

Its three falsifiable claims were tested by `TASK-0048`: **1 falsified, 2
refuted, 3 confirmed.** Accepting the ADR is therefore *not* accepting its
Context section as written — two of its own predictions were wrong, and the
dated notes in the file record that. What follows is what the **Decision**
clauses commit you to, as executed.

**Clause 1 — no new component category, no plumbing.** *Delivered and
verifiable:* `install.sh`, `sync-registry.sh` and `validate.sh` are byte-identical
across the sprint. Accepting this means a future third-party extension also
gets no directory, and the `plugins/` question stays closed.

**Clause 2 — routing by what a thing *is*.** *Delivered,* and now in
`docs/development/authoring-guide.md` where an author will meet it.
Accepting this means the table governs the next such decision. **Note what
execution added:** the rows are **not mutually exclusive** — graphify
occupies two. The guide states this; the ADR only predicted it.

**Clause 3 — nothing vendored.** *Delivered.* Accepting this means upstream
stays maintainer-of-record. Execution found a **second, mechanical** reason
beyond the `ln -sfn` ownership argument: ponytail's six skills use a folded
`description: >`, which `tests/validate.sh` rejects outright. Vendoring them
would turn the gate red.

**Clause 4 — nothing auto-installed.** *Delivered.* Accepting this holds the
line that `install.sh` never writes into a client's plugin registry or
config — the same line agent emission already holds.

**Clause 5 — every capability claim labelled vendor-doc or version-stamped
observation.** *Delivered* across all three `configs/` sections and
`third-party-tools.md`. **Finding 2 is the amendment worth considering
alongside ratification:** the label records provenance but not *which
artifact* a claim came from, and that gap produced the hook-count error.
Ratifying clause 5 as written is defensible; tightening it to cite the
source file is the cheap fix.

**Clause 6 — documentation for ponytail and omniroute, a pinned manifest for
graphify, and that is the whole deliverable.** *Delivered.* Accepting this
means accepting finding 7: two of three deliverables are prose, the fourth
instance of that pattern, and the sprint's escape hatch went untested.

**Rejection remains legitimate** and has precedent (`ADR-0017`). Rejecting
would leave the placement rule in the guide unsupported, which `TASK-0051`
anticipated by labelling its status rather than implying consensus — so the
guide would need one edit, not a rewrite.

## Follow-up tasks

Raised here so they are findable rather than living only in this file —
B-021's lesson.

1. **Correct two stale second-hand gate claims** (finding 4).
   `tests/smoke-mcp.sh:10` says `validate.sh` runs in *~0.4s*; measured 572
   ms native and 1008 ms on `/mnt/c`. `docs/operations/runbook.md:60` says
   *"sub-second"* without naming the surface. Small, mechanical, and in a
   file this sprint edited twice without noticing.
2. **Decide whether a claim must cite the artifact it was read from**
   (finding 2), and if so amend `ADR-0021` clause 5. This is the sprint's
   one transferable process finding.
3. **B-023** — decide the rule about `configs/` sections per MCP server,
   then write graphify's if the rule says so. Already in `BACKLOG.md`.
4. **Carry finding 7 forward untested.** *"The honest cut is a product,
   never the spike"* has now been stated by two sprints and exercised by
   neither. It should be restated in the next plan that risks shrinking,
   not quietly retired.
5. **Inherited, still open from `REVIEW-0010`:** the `ansible-core` version
   recorded in nine places has moved, and `skills/ansible-ops/` remains
   unexercised against a live estate. Neither is S8's, and neither was
   touched by it.
