# Current State

Last updated 2026-09-23. **S8 is complete as work and open as a sprint.**
All four briefs ran — `TASK-0048` (spike), `TASK-0049` (graphify as a
component, plus two `smoke-mcp.sh` fixes), `TASK-0050` (ponytail per
client), `TASK-0051` (the placement rule and `third-party-tools.md`) — and
`REVIEW-0009` is written. **Closure is blocked on one human act: ratifying
or rejecting `ADR-0021`.** Before the sprint: S6's closure with S8 promoted
to current (`TASK-0054`).

## REVIEW-0009: approve the work, cannot close the sprint

**2026-09-23.** The pre-committed question — *did the spike change
anything, or did it rubber-stamp the vendor READMEs?* — is answered with
**six corrections, three of them against this sprint's own artifacts**. The
precondition path, the Claude Code hook count and the skills' schema
compatibility were all wrong in briefs written *after* the spike, and were
caught by re-opening the evidence rather than trusting the logs.

**The one thing the sprint still needs is a human decision.** `ADR-0021` is
`Proposed`; `PLAN-0005`'s first acceptance criterion requires it ratified or
rejected *on `TASK-0048`'s evidence, not on agreement with its prose*. Every
other sprint criterion is met, four of them verified mechanically —
`install.sh`, `sync-registry.sh` and `validate.sh` are byte-identical across
the whole sprint, and nothing was vendored. The ratification packet is in
the review.

**Two findings to judge as process rather than output:**

- **A *labelled* limitation is not a *contained* one.** `TASK-0048`
  correctly and prominently labelled its Q4 answer as package-level, and the
  wrong hook count propagated anyway — because the label records *how* a
  claim was obtained and not *which artifact it describes*. The number came
  from a different client's hook file. Candidate amendment to `ADR-0021`
  clause 5: cite the source file, not only the date and provenance.
- **B-023 is a seam, not an oversight** — two briefs each assigned
  graphify's `configs/` wiring to the other. A decomposition defect in
  `PLAN-0005`, invisible until both tasks had run.

**The gate budget S8 was pre-blamed for was not spent.** Measured at review
time: **1008 ms** median on `/mnt/c` (993–1069) against `REVIEW-0010`'s
~1085 ms, and **572 ms** on ext4. `validate.sh`'s own cost comment
reproduces exactly. The stale claims are second-hand and now located:
`tests/smoke-mcp.sh:10` still says *~0.4s*, in a file this sprint edited
twice.

**One finding from inside the review's own method.** Its first ext4 timing
read 1–2 ms — not a fast gate but one that never ran, because `git clone`
dropped the executable bit (the `core.filemode` trap `TASK-0014` warned
about). Caught by implausibility alone. A green-looking number from a
command that never executed is the same shape as a check that cannot fail.

## The placement rule is out of the ADR and into the guide

**`TASK-0051`, 2026-09-23.** `docs/development/authoring-guide.md` gains
`## Placing a third-party extension` — the three-row routing table, with
every row marked **Gated: no**, because nothing in `tests/validate.sh`
checks placement and nothing will: routing is a judgment call, and a check
that cannot decide it would be a check that cannot fail.

**Four claims about the gate were grepped against the script, not
recalled** — the brief named a false enforcement claim in the guide that
documents that defect class as the single most embarrassing available
error. The section also states what the gate *does* enforce, so three `no`s
are not misread as "unchecked, therefore optional".

**`ADR-0021` is still `Proposed`**, so the guide carries a dated note saying
the rule is followed here with two worked examples but is not ratified. A
normative guide documenting a pending decision as settled is the thing
`ADR-0019` set the precedent against.

**Non-exclusivity is stated as fact, not hedged.** graphify occupies two
rows — an `mcp-servers/` component *and* a client-native OpenCode surface
writing four things. ponytail is the second-row example, and *why* it cannot
occupy the first (`ponytail-mcp` unpublished) is one linking clause.

**`docs/development/third-party-tools.md` is new**, with omniroute as its
first and only entry: a local gateway service on `:20128`, an OpenCode
*provider* plugin, a Claude Code integration that is **not a plugin at all**
but base-URL redirection, and the `mcpAutoEmit` caveat — an option that
writes an `mcp.*` entry into the client config, a mutation this repo forbids
itself. Every claim vendor-doc and dated; nothing observed, and the file
says so.

**`AGENTS.md` checked and deliberately unchanged** — its structure line
points at `docs/development/` as a directory, so naming the new file would
start a list that must then be maintained.

**B-023 raised: a seam, not an oversight.** graphify has a manifest and a
registry row but no `configs/` wiring section. `TASK-0049` assigned that to
`TASK-0050`'s category; `TASK-0050`'s scope excluded graphify. Neither brief
owned it, and it is only visible now both have run. Raised rather than
filled, because **no rule exists** about whether every `mcp-servers/` entry
owes three client sections — writing them now would set that precedent by
accident, using the weakest possible case.

## ponytail is documented, not installed — and it corrected its own brief twice

## ponytail is documented, not installed — and it corrected its own brief twice

**`TASK-0050`, 2026-09-23.** All three `configs/*/README.md` now carry a
`## Third-party extensions` section with ponytail
(`@dietrichgebert/ponytail` 4.10.0, MIT) described **per client**. Nothing
vendored, nothing installed, registry unchanged — confirmed by running the
generator rather than assuming.

**The gating re-check held.** `ponytail-mcp` is still unpublished under
**both** the bare and the scoped name (404, 2026-09-23), so `ADR-0005`'s
external shape stays unavailable and the task remains documentation. The
scoped name was not in the brief; checking it is what makes the negative
result worth anything.

**Two of the brief's own inputs were wrong, and both trace to the same
root.** `TASK-0048` answered Q4 from the published package and *disclosed*
that — the brief then carried its numbers forward as though they described
Claude Code:

- **The Claude Code plugin installs three lifecycle hooks, not two.**
  `hooks/claude-codex-hooks.json` declares `SessionStart`, `SubagentStart`
  and `UserPromptSubmit`. The two-hook figure describes
  `hooks/copilot-hooks.json`, a different client's file with different event
  names and a different timeout key. **Upstream's README says two as well**
  — the third README-versus-source disagreement this sprint.
- **"Schema-compatible with ADR-0003" was true of the keys only.** All six
  skills declare a folded `description: >`, which `tests/validate.sh:86-94`
  rejects outright. The no-vendoring decision now rests on two independent
  reasons, the second mechanical: vendoring them would turn the gate red.

**The OpenCode claim is deliberately hedged.** The npm plugin entry
resolves — file ships, `import()` succeeds — but that is
**package-resolution evidence, not an observed in-client load**, and the
section says so, carrying `TASK-0048`'s control with it: the pre-existing
working plugin logged nothing either, so the silence proved nothing.

**Bionic stays UNVERIFIED, and is now better defended.** A search of the
whole tarball for `lm studio`, `lmstudio` and `bionic` returns no match, so
there is no vendor claim in *either* direction — which forecloses citing
support that does not exist. `B-018` is referenced, not restated.

**A seam between two briefs, recorded rather than quietly filled.** graphify
now has a manifest and a registry row but **no `configs/*/README.md` wiring
section**, while ansible has one in all three. `TASK-0049` excluded it as
belonging to `TASK-0050`'s category; `TASK-0050`'s scope excludes graphify.
Neither brief owns it. `TASK-0051` routes it or raises it.

## graphify is a component; the smoke harness had been testing the wrong thing

**`TASK-0049`, 2026-09-23.** `mcp-servers/graphify/server.json` is the
repo's **second external manifest**, pinned to `@sentropic/graphify@0.18.0`
(re-resolved, not carried forward — unchanged over the 7 days since
plan time). `docs/registry.md` carries the `external` row.

**`capabilities.destructive` is `false` on a reachability argument, not a
judgement.** `graphify serve --help` declares no options beyond `-h`, and
the bundle only pushes the mutating ontology tools when
`options.ontology.write === true` — which `serve` has no flag to set. The
flag belongs to a *different* subcommand, `graphify ontology serve
--write`. The CLI around `serve` is emphatically not read-only, so the
manifest names its mutating subcommands in `cli_scope`. That is **B-012
applied before it could repeat**.

**The precondition is the graph FILE, not the state directory.** The brief,
`ADR-0021` and `TASK-0048` all say `.graphify/`. Observed: with the
directory present and the file absent, v0.18.0 still exits 1, with a
different message. Declaring the directory would have left the same false
FAIL in a narrower window.

**Two human-authorized changes to `tests/smoke-mcp.sh`, the second one not
in anyone's plan.** B-020's fix is a manifest-driven
`smoke_test.requires_paths` → SKIP, so nothing about graphify is hard-coded
in the harness. Proving that SKIP was a *precondition gate* and not a
blanket exemption meant placing a graph and re-running — and that is what
exposed the real defect: **the harness waited for the server process to
exit**, so a conforming MCP server that keeps serving after `initialize`
was reported `no reply within 90s (server hung or never spoke)` **while
holding the correct reply it had already received**. It was testing whether
a server dies, not whether it speaks; ansible passed only because its
server happens to exit on stdin EOF. Fixed in the same task under a second
explicit authorization: stdin stays open, one reply is read with a
deadline, then the server is terminated. Both servers now PASS.

**The fabricated test graph was deleted**, so the repo ships in the SKIP
state. A PASS resting on a hand-written `{"nodes":[],"edges":[]}` would be
this repo's own *"a check that cannot fail"*.

**Carried forward:** `@modelcontextprotocol/sdk` is an **optional**
dependency of graphify, guarded by a try/catch that throws if absent. It
resolved under `npx -y` here, but a `--no-optional` install would yield a
server that cannot speak MCP at all — the kind of thing a pinned version
does not protect against.

## S8 is under way: the spike overturned two of three expectations

**`TASK-0048`, 2026-09-22.** Spike — findings, not components. **No
component file changed**, as forecast, and the machine was restored and
**verified by md5** against backups taken first.

**Both products are multi-surface, and that is the headline.** graphify's
`opencode install` writes **four** things — `AGENTS.md`, a
`tool.execute.before` plugin, a project `opencode.json` entry, **and an Agent
Skill**. ponytail ships **six** OpenCode commands, two plugins, **six Agent
Skills**, and hook manifests for four clients. `ADR-0021`'s clause 2 says a
third-party extension is placed by *what it is*; the spike's answer is that
each of these is several things at once, so its "rows are not exclusive"
consequence fires for **both** products rather than just graphify.

**`ADR-0021`'s three falsifiable claims: 1 falsified, 2 refuted, 3
confirmed.** Two of three went against the plan — which is what the spike
existed to produce.

- **graphify's OpenCode integration is a real plugin**, not the `AGENTS.md`
  its README claims. The source reading was right and the README wrong.
- **ponytail does load from an npm entry.** The feared blocker — `main`
  pointing into `./.opencode/plugins/` — is not one: the file ships and
  `import()` succeeds. Recorded precisely as **package-resolution evidence,
  not an observed in-client load**.
- **`graphify serve` exits 1 with no graph**, verbatim message recorded. So
  **B-020 stands** and `TASK-0049` does not simplify.

**Two findings nobody asked for.** graphify's own install preview
**under-reports what it writes** — the Agent Skill it installs is absent from
its `writes:` list. And graphify **merges rather than clobbers** an existing
project config, preserving `$schema`, `mcp` and a populated `plugin` array.

**A method note worth keeping.** The brief's plan for Q3 — add the plugin
entry, start OpenCode, read the log — could not answer it: neither
`opencode serve` nor `opencode debug startup` loaded plugins at startup.
**The control is what made that honest**: the pre-existing, working
`opencode-arcade-hub` plugin logged nothing either, so the silence was
uninformative rather than a negative result. The question was answered at
package level instead, and the substitution is recorded rather than papered
over. Earlier the same day, **S6's checkpoint was written
as `REVIEW-0010`** and **the Bionic client snapshot was corrected for two
drifted observations** (`TASK-0053`). All three below.

## S6 is CLOSED; the three ADRs are ratified; S8 is current

**`TASK-0054`, 2026-09-22.** The human answered `REVIEW-0010`'s ratification
packet with **ratify** — **ADR-0014, ADR-0015 and ADR-0016 are all
`Accepted`**, eight days after their bodies were written. That was the one
act the checkpoint named as blocking closure, so S6 closed on the same date
and **S8 moved from re-queued to current**.

**Promotion executed a decision already taken, rather than making one.**
`TASK-0052` recorded *"finish S6 before S8"* — an ordering that always
presupposed S8 followed. **All four S8 briefs are still `planned`,
`ADR-0021` is still `Proposed`, and B-018…B-021 are still `ready`.** Nothing
in S8 has been executed; this is the third sprint-state change to that file
without a content change.

**What ratification actually settled, per ADR:**

- **ADR-0014** — accepted **with an evidence caveat on the record**: its
  "53 rules / 0 real violations" was observed under `ansible-core` 2.20.8 and
  the live toolchain is 2.21.4. The decision does not rest on the count.
- **ADR-0015** — the substantive one. What was ratified is a **reversal** of
  an approved mechanism, not a restatement. **This also retires the Option 2
  waiver** under which `skills/ansible-ops/` and `loops/ansible-change/`
  shipped on 2026-09-15; they now stand on a ratified decision.
- **ADR-0016** — what was ratified is the **ground, not the conclusion**. The
  conclusion (no `hooks/` category) was expected; its basis was refuted and
  replaced — interception *works* in both clients, and the category is
  declined on **portability**, never on capability.

**`ADR-0021` asserted twice that ADR-0016 was `Proposed`** and now carries
dated notes at both. It is itself still `Proposed` and about to be read as
the current sprint's, which is why it was annotated rather than left — the
same false-present-tense class `REVIEW-0008` swept across four files.

**Dated records were not rewritten** — completed task files, session logs,
`REVIEW-0008`, `docs/design/ansible-ops-brief.md`. The trace that these ADRs
were unratified for eight days, and that two components shipped under a
waiver in that window, is part of the record.

## S6's checkpoint: what REVIEW-0010 found

> **Superseded within the day by the section above.** This records the
> checkpoint as written, before the human ratified. Kept because it is what
> the review found; read the section above for the resolved state.

**`REVIEW-0010`, 2026-09-22.** Verdict **approve**, with closure explicitly
**blocked on an act the review could not perform**: ADR-0014, ADR-0015 and
ADR-0016 were **then** still `Proposed`, and ADR-0014 stated it plainly —
*"What remains is a human act, not more evidence."* Every ratification in
this repo is recorded as a human decision, so an agent accepting them would
manufacture the one signature the convention exists to require. **S6 stayed
current until the human answered — which was the same day.** The review carries a **ratification packet** summarising what
accepting each ADR commits the human to, with ADR-0015's reversed clause 1
flagged as the one most needing a human.

**The headline finding was not predicted by anyone: S6's evidence base is no
longer re-checkable at the commit it was read from.** Exit criterion 5
records `SIGMA-infrastructure` at `HEAD` `d4e2dd1`, `[ahead 42]`, with
`ansible.log` mtime 2026-09-12. Today that path is at `95b6966` **dated
2026-09-06**, has no remote, no `ansible.log`, and a reflog ending
2026-09-06 — while `d4e2dd1` exists as an object on no branch. A checkout
cannot have been at a 09-12 commit on 09-16 with a reflog ending 09-06, so
**the working copy S6 read is not the one at that path today**. The cause is
recorded as undeterminable read-only, not guessed at.

**The constraint held** — that tree is clean, and nothing suggests this repo
modified it. What broke is re-verifiability, not the rule.

**Two things absorbed the blow, one of them by accident:**

1. **The guard is insulated.** `tests/gather-subset-guard.sh` uses its own
   fixtures and its own `inventory.yml`; it never reads the target repo.
   Re-run 2026-09-22: **10/10 PASS**, on a toolchain that has itself moved
   (`ansible-core` 2.20.8 → **2.21.4**, recorded in nine files).
2. **`TASK-0032` recorded F1–F4 here rather than as pointers** — and did so
   for an unrelated reason (ADR-0015 forbids estate facts in a
   symlink-deployed component). That choice is what preserved S6's evidence.
   **A decision taken for one reason turned out to be load-bearing for
   another.** The cheap generalisation: a citation into a repo you do not
   control is a pointer that can dangle, so record the fact, not the
   coordinates.

**Three external-evidence drifts inside one week** — Bionic, `ansible-core`,
and the target repo — every one caught because the original observation
carried a version, a hash or a timestamp. **The defence works; its trigger
does not exist.** All three were found by someone happening to re-read the
file. Whether this repo wants a scheduled re-check is now a live follow-up,
and recording "no, by choice" closes it as legitimately as building one.

**Still open and untouched by this checkpoint:** the gate's undecided budget
(`REVIEW-0008` follow-up 1, measured **971/1040/1245 ms** against a
sub-second claim — its second checkpoint unactioned), and B-018…B-021. Before that, on
2026-09-16, **S6 was un-parked and made current again** and **S8 was
re-queued** (`TASK-0052`). Earlier the same day, sprint S7 was closed by
`REVIEW-0008` (approve) and S8 was briefly promoted; before that, S8 was
planned from a human request for three "plugins", and TASK-0047 corrected the
identity and capabilities of the third client.

## The Bionic snapshot drifted, and the stamp is what caught it

**`TASK-0053`, 2026-09-22.** Documentation-only. `configs/lm-studio-bionic/README.md`
had two observations that no longer matched the machine:

1. **Version: stale.** Recorded 1.1.1+5 (observed 2026-09-15); installed is
   **1.1.3+5**. The app updated itself.
2. **`~/.lmstudio/mcp.json`: wrong, in the present tense.** Recorded as
   "holding the `ansible` entry with a real `WORKSPACE_ROOT`". It is
   `{"mcpServers": {}}`, and has been since **2026-09-17 20:00**.

**Nothing in this repo cleared that file.** `mcp.json` and
`credentials/mcp-oauth` were written within the same tenth of a second, and
the app's own `last-synced-mcp-state.json` agrees the config is empty — an
application writing its own state. **The cause is recorded as
unestablished.** The one candidate with a matching date is the 1.1.3 upgrade
("organization-managed MCPs" in its changelog), and it is written down as a
hypothesis, not a finding.

**Also new, and ADR-0020 could not have seen it:**
`~/.lmstudio/credentials/ng-mcp-managed-oauth/` was created **2026-09-16
01:17**, the day after that ADR. `ng-mcp.json` itself is still absent from
disk, so the dormancy claim holds — but a *managed* credential channel
appearing on a machine whose app then emptied its MCP config is exactly what
the runbook tells the next reader to watch for.

**`ADR-0020`, `ADR-0006` and `TASK-0047` were deliberately left byte-identical.**
That was an acceptance criterion, not an oversight. This repo settled the
principle in ADR-0006's own annotation — *"an ADR is a dated record rather
than a live status page"* — and ADR-0020 had already accepted this exact risk
for itself: *"Every observation here is version-stamped, and the paths may
move. The mitigation is the stamp, not a promise of stability."* Correcting
the ADR would have destroyed the evidence that the drift happened. The live
snapshot in `configs/` is the file whose job is to be current, so it is the
one that moved.

**The generalisation worth keeping:** ADR-0020's closing note said no gate in
this repo can test a claim about a third-party client, and that the defence
is version-stamped observations a later reader can re-check cheaply. This is
the first time that defence was exercised. It worked — and it cost one task,
against two false statements that had been live for five and seven days
respectively. **The GUI verification and B-018 are both still open**, and
Bionic's MCP status is **still inferred, not verified**, at any version.

## S6 is CURRENT again; S8 is re-queued

**2026-09-16, `TASK-0052`.** Human decision, in answer to a direct question
about how the parked sprint should re-enter: **finish S6 before S8.** S6 is
restored to `.ai/planning/SPRINT-CURRENT.md`; S8 returns to
`.ai/planning/sprints/SPRINT-S8-third-party-extensions.md`.

**Both directions of the swap cost nothing, and for the same reason parking
cost nothing:** S6 still has **zero implementation of its own**, and S8 had
**zero components changed** (planning-only was its explicit instruction). No
partial execution needed reconciling either way. Had either sprint been
half-built this would have been expensive — the same observation TASK-0033
made about the original park, now confirmed from the other side.

**`Re-queued` is a third sprint state**, deliberately distinct: a *closed*
sprint gets a `REVIEW-####` and resolves its items; a *parked* sprint keeps
its artifacts `planned`/`proposed`; S8 was **promoted and then un-promoted
before doing any work**, so it gets no checkpoint — there is nothing to
check. **B-019/B-020 stay `ready`**, by the same rule that held B-010…B-013
`ready` through S6's park.

**What is actually outstanding in S6:** **`TASK-0032`, ratification of the
three ADRs, and a checkpoint.** `TASK-0026`, both spikes, **`TASK-0031`** and
all three ADR bodies are **done (2026-09-16)**. **All five of Phase 6's exit
criteria are met**; what remains is judgment, not implementation.

## The target-repo evidence trail, and what was deliberately left alone

**`TASK-0032`, 2026-09-16. Every citation below was re-opened and re-read
before being restated**, per this repo's standing lesson that planning prose is
a hypothesis about files. Two claims had drifted and are corrected here rather
than repeated.

**Why this lives here and not with the skill.** One owner per fact.
`skills/ansible-ops/` holds **no estate specifics by design** — `ADR-0015`'s
decision is *derive per change, never declared and never stored*, so putting
one estate's facts into the portable component is the exact mechanism that ADR
rejects. These are observations about **another repository**, so the durable
home is this file. The skill links to the reasoning; it does not restate the
evidence.

### F1 — There is no staging inventory, and there cannot be one
One inventory, wired at `SIGMA-infrastructure/ansible.cfg:8`
(`inventory = inventory/production.yml`); `inventory/` contains
`production.yml` and `group_vars/` only. One 6-node PVE cluster at 3-of-4
quorum with no verified margin; one DC holding all seven FSMO roles.
`.github/workflows/ci.yml` records the deliberate corollary: CI has no route to
the estate and no credentials. **The source analysis's central worked example —
`--check --diff -l staging`, then `-l staging`, then production — is
unimplementable there.** This is the sprint's most consequential correction:
building from the source text would have produced a runbook gating on an
inventory that does not exist. Verified 2026-09-16.

### F2 — A documented, statically checkable hazard that was enforced by nothing
`ansible.cfg:19-49`, verbatim in capitals: `ansible.builtin.setup`'s default
fact gathering collects `ansible_mounts`, which stats every mount including
`/etc/pve`; on a node with wedged pmxcfs that is *"the exact uninterruptible
FUSE hang"* and **`timeout` cannot kill an uninterruptible D-state wait**. Both
attempted global fixes fail, verified empirically *there*: `gather_subset` is
**rejected** as an unknown `[defaults]` key, and **silently ignored** in
`group_vars`. It is a play keyword and a per-module argument only. The file
concludes: *"A code-review or CI check should confirm this before that playbook
is trusted against a live node. **Tracked as unenforced until then.**"*

**No longer unenforced, as of `TASK-0031`** — see the guard section below. The
rule is available to that repo; **it is not installed there** (Option (a)).

### F3 — Four stale claims, all re-verified, TWO OF THEM NOW WORSE THAN RECORDED
Left unfixed by decision (below). Re-read 2026-09-16:

1. **`.ansible-lint:3-4`** — *"This workspace has no playbooks/roles yet"*.
   **False**: two playbooks exist. Since `profile: production` is set and
   `playbooks/` is not excluded, the config has been live and unproven.
2. **`.pre-commit-config.yaml:41-43`** — *"No playbooks/roles exist yet… this
   hook activates itself the day the first one is added; harmless no-op until
   then."* **False by the same fact.** The line number in `PLAN-0003` was `:42`
   and the comment spans `:41-43`; close enough to be the same claim, recorded
   for precision.
3. **`ci.yml:11-13`** — *"There is currently no GitHub remote for this repo
   (origin is a local path)"*. **Now false in a sharper way than recorded.**
   `git remote -v` shows **three** remotes: `github` →
   `github.com/armandomartires/SIGMA-infrastructure.git`, `gitlab` → an
   internal GitLab, and `origin` → still a **local path**
   (`/mnt/c/.../SIGMA-infrastructure`). So the parenthetical about `origin` is
   *still true* while the headline claim is false — a half-decayed claim, which
   is harder to notice than a wholly false one.
4. **`requirements.yml:3-5`** — documents reinstallation in
   **PowerShell/Windows** syntax (`$env:ANSIBLE_COLLECTIONS_PATH`,
   `.venv\Scripts\ansible-galaxy.exe`) after that repo moved administration to
   Linux. Confirmed present and unchanged.

**Also `ci.yml:42-45`** repeats the no-playbooks claim, making it the **third**
file asserting it — consistent with `PLAN-0003`'s note but worth stating as a
count.

### F4 — Its `ansible-lint` gate had never had content to lint. It does now, and it PASSES
Established by `TASK-0027`: **0 failures, 0 warnings, exit 0** across **53
built-in rules** under `profile: production`. **With the fidelity limit stated
where the observation is** — that result came from a `/tmp` copy whose
`ansible.cfg` had `vault_password_file` removed, so it describes a *modified*
configuration and is **not** evidence that the repo's own gate passes with
vault configured. Both `group_vars/*/vault.yml` files are present and
`$ANSIBLE_VAULT`-encrypted; neither was decrypted or copied.

### The unpushed commits — the count depends on which remote, which the brief did not say
`PLAN-0003` and `TASK-0032` both say "42 unpushed commits". Measured
2026-09-16:

| Remote | Commits ahead |
|---|---|
| `origin` (a **local path**) | **42** |
| `github` | **8** |
| `gitlab` | **8** |

So *"42 unpushed"* is true only against a local-path `origin`; against both
real remotes it is **8**. The larger number is the more alarming one and it is
the one that was recorded. **A count is not a fact until you name what it
counts against.**

### All of it was left alone BY DECISION — whose, when, and why
**Human decision, 2026-09-14, Option (a)**, recorded in `PLAN-0003`'s "Human
decisions required" table and restated in the S6 sprint file: `ai-toolbox`
ships portable components; `SIGMA-infrastructure` is **read as evidence and
never modified**. Its four stale claims are recorded here and **fixed nowhere**;
its commits are neither pushed nor rebased.

The reasoning is **ownership, not indifference**. That repo runs the
`project-workflow` framework (`S###_Sprint.T###_Task`), with its own
`AGENTS.md`, its own pre-commit gate, its own CI and its own task conventions.
Editing it from this sprint would put one change under two governance regimes
with no single owner. `AGENTS.md` also requires explicit authorization for
anything destructive, and rebasing another repo's unpushed history is exactly
that.

**Adoption and repair there are that repo's own sprint to open.** No task brief
for it is created here — authoring one would both violate its naming convention
and presume its sprint planning, which is the ownership this sprint declined.

**Recorded because an unrecorded gap is indistinguishable from an unnoticed
one.** That asymmetry is the whole reason this section exists.

### The limitation, in the same register as `mcp-servers/_template/`
**Under Option (a), `skills/ansible-ops/` was authored *from* the target repo
and has never been executed *in* it.** It therefore carries the same status
this file already assigns to `mcp-servers/_template/`: **treat it as
unexercised scaffolding.** Two honest qualifications:

- `TASK-0046` exercised the **loops that produced it**, which is a different
  claim from exercising the skill against a live estate.
- **`TASK-0031`'s guard is the one S6 deliverable validated against real
  content** — the actual playbooks and the actual inventory, read-only. That is
  why it, and not the skill, is the sprint's strongest artifact.

Stated at plan time rather than at checkpoint, which was deliberate: S5's
equivalent limitation surfaced only in its review.

### Target repo verified untouched, output recorded
`git status --short` → **empty**, before and after every S6 task.
`git status -sb` → `## master...origin/master [ahead 42]`. `HEAD` → `d4e2dd1`
*("Record actual commit hashes in task briefs and sprint table")*.
`playbooks/capture_pve_baseline.yml:22` → still `gather_facts: false`.
`ansible.log` mtime → still `2026-09-12 16:15:01`, which matters because
**`ansible-lint` writes that file with no flag** (`TASK-0027` finding 4) — an
in-place lint run would have modified the repo. Every mutation this sprint
performed was in a `/tmp/opencode/` copy.

## S6's highest-value deliverable exists and is proven to fire

**`TASK-0031` closed B-011** (2026-09-16). A rule written down in another
repository's `ansible.cfg` as *"A code-review or CI check should confirm
this… **Tracked as unenforced until then**"* is now mechanically checkable:
`skills/ansible-ops/scripts/gather_subset_guard.py`, a custom `ansible-lint`
rule (`gather-subset-mounts`) that refuses a play gathering facts against a
hazard-class host without excluding `mounts`. It recognises **both** accepted
forms, resolves a **bare hostname** to its class through nested inventory
`children:`, and fails loudly on an unresolvable target with a **distinct**
message.

**Three S6 backlog items are now closed by S6's own execution** — B-012/B-013
(`TASK-0026`) and B-011 (`TASK-0031`). **B-010 alone remains**, and its two
components were already delivered by S7's pilot, so what is left for it is the
checkpoint's judgment on whether that route counts.

**The decisive evidence is outside the fixture set, and that was the whole
point of `TASK-0052`'s D2.** Seven fixtures pass (10 checks including
harness-level ones), but fixture 5's silence proves nothing on its own. So the
guard was run against the **real** estate: silent on both actual playbooks,
then — with `capture_pve_baseline.yml`'s `gather_facts: false` flipped to
`true` **in a `/tmp` copy only** — it produced

```
gather-subset-mounts: MISSING EXCLUSION: this play gathers facts against
hazard-class target 'sigsrvpve1' without excluding `mounts`.
```

resolving the real hostname through the real nested inventory
(`pve_cluster` → `pve_voting` → `sigsrvpve1`). **That is what makes the silence
on the unmodified playbook discriminating rather than inert.**
`SIGMA-infrastructure` was never written to — verified after: `git status`
empty, `HEAD` `d4e2dd1`, `[ahead 42]`, playbook still `gather_facts: false`.

**Three defects were found during execution, two of them mine, and each
changes something beyond this task:**

1. **`TASK-0027`'s recommendation was WRONG on its own tiebreaker.** It called
   `enable_list:`-plus-`rules:` config in `.ansible-lint` the "declarative
   wiring tiebreaker". Per-rule configuration of a **custom** rule is a
   **fatal** error: the config schema's `$defs.rule` sets
   `additionalProperties: false` and permits only `exclude_paths`, so
   `rules: {gather-subset-mounts: {...}}` yields *"Additional properties are
   not allowed"* at **exit 3, nothing linted**. `AnsibleLintRule.get_config()`
   exists, reads `options.rules[<id>]`, and **the schema forbids ever
   populating it** — an API reachable only by an illegal config. Configuration
   is by environment variable, and **the loss is recorded rather than hidden**:
   rule config now lives outside the committed lint config, so it is not
   reviewable alongside it. `enable_list` *is* legal, so enabling stays
   declarative; only configuring cannot be.
2. **Fixture 4 could never reach the rule it was written to exercise.**
   `hosts: "{{ undefined }}"` is failed first by the built-in `syntax-check`,
   which is **unskippable** (*"you cannot use it in 'skip_list' or
   'warn_list'"*). Replaced with a **wildcard pattern**, which is
   syntactically valid and still unresolvable. **The ambiguity branch was
   unreachable by its own test case, and a passing suite would not have
   revealed it** — the branch would simply never have run.
3. **My fires-proof harness had the defect it was built to prevent.** It
   matched the rule **ID**, which appears in `ansible-lint`'s *error* text
   (`$.rules['gather-subset-mounts']`). With defect 1 active, four fixtures
   were reported as *"fired but WRONG MESSAGE"* rather than *"did not fire"* —
   **so a careless read concludes the rule works and merely words things
   badly, when it had not run at all.** Fixed to match the rule's own messages,
   plus a `config_ok` pre-flight that aborts if the config is rejected. This is
   TASK-0042's lesson in a new place: **match on the check's own message, never
   on a string that also appears in unrelated output.**

**The guard ships with four limits stated in the artifact, not only here:** it
proves a keyword is present, not that a node is safe (the hazard is not
reproducible on demand); **nothing in this repo runs it**, deliberately, since
it lints other repositories and the gate must stay hermetic (ADR-0009); it can
be **installed and inert** without `enable_list`; and it cannot see an
undefined-variable target. Classes 2–6 of `references/hazards.md` remain
unenforced — B-011 covered class 1 only.

**A shipped false claim was created and corrected in the same change.**
`references/hazards.md` said *"This repository ships NO enforcement of any
hazard class… no guard, no hook, no wrapper, no linting rule."* True when
written; **false the moment the guard landed.** That is the
self-describing-artifact class `TASK-0046` diagnosed, occurring in the sprint
that delivered the guard. Replaced with what is now true, supersession visible.

**The mandatory gate is unaffected, measured not assumed:** 1111 / 1108 /
1073 ms on `/mnt/c` after the change, against `~1150 ms` recorded by
`REVIEW-0008` before it. The guard and its harness sit **outside** the gate.
Timed on `/mnt/c` deliberately — `/tmp` (ext4) understates by ~40% and would
have compared filesystems rather than changes.

**S6 now has real implementation, which changes one standing fact about it.**
Un-parking was free because the sprint had built nothing; `TASK-0026` ends
that. A second park would now cost reconciliation — worth recording, because
the original parking note predicted exactly this (*"the same decision one
sprint later would have needed reconciliation"*), and the prediction has now
been confirmed from **both** directions.

**`TASK-0026` closed B-012 and B-013 — the first S6 items resolved by S6's
own execution** rather than by another sprint's route. Four findings, three of
which are about this repo's own habits:

- **The false blast-radius claim was in SIX places, not the four the brief
  predicted.** `server.json`, three `configs/*/README.md`, **plus
  `docs/operations/runbook.md:185`** — which told an operator wiring up a live
  client that `WORKSPACE_ROOT` *was* the server's blast radius — **plus a
  *lessons* list** at `configs/lm-studio-bionic/README.md:253`, i.e. the two
  most quotable places to be wrong. The brief listed the runbook only as
  "check, do not assume", so **the brief's own count of the defect was an
  instance of the defect.** Found by grepping the sentence; a final grep now
  returns nothing outside `.ai/`. Nothing in `validate.sh` could see any of
  it.
- **Three of the brief's Inputs rows were stale, and one named a file that no
  longer exists.** `configs/lm-studio/README.md` is now
  `configs/lm-studio-bionic/README.md` (renamed by `TASK-0047`), and **all
  four** line-number claims were wrong — the files had grown by 47, 64 and 125
  lines, and `validate.sh` from 474 to 732. The brief's own instruction to
  re-read before editing is what caught it, which is lesson 7 working as
  designed rather than being rediscovered.
- **One acceptance criterion was deliberately DECLINED, not met.** The brief
  required stating that the third client "supplies models only and performs no
  agentic work". That exact sentence was **already in the file and already
  removed as false** by `TASK-0047`/`ADR-0020` — the client is **Bionic**, and
  it ships subagent identifiers, sessions and a permissions store. **Executing
  the criterion would have restored a known-false claim on a superseded
  decision's authority.** Marked complete-as-declined with the reason, the
  same resolution `TASK-0037` used when a brief contradicted an accepted ADR.
- **The authorization narrowing is recorded so it cannot read as a
  widening.** `authorization` keeps `granted: true` (the gate requires it) and
  gains a `history` array: the original **five-tool** grant of 2026-09-13,
  then the 2026-09-14 narrowing to four, with the entry stating in words that
  it *reduces* the grant. The original is not erased. **The gate's
  authorization check was observed failing** on a deliberately broken manifest
  (exit 1, correct message) and restored **byte-identically by SHA-256** — it
  had never been seen to fail against this manifest before.

**One limit stated plainly in all three snippets: the disablement is
advisory.** This repo cannot switch off a tool in the upstream server. Every
documented command still starts a server exposing all ten tools, and a user
can re-enable `ansible_navigator` at any time. What was reduced is *default*
exposure plus a false description. The OpenCode snippet additionally names the
**real** enforcement route `TASK-0028` found (`tool.execute.before`, tool ID
`ansible_ansible_navigator`) and records that this repo ships no such plugin
and **declined** to (`ADR-0016`) — so a reader wanting enforcement learns the
route and its limits rather than assuming the repo supplied one.

Three things a cold reader needs:

- **TASK-0029/0030 are `done`, delivered by S7's pilot** — and the S6 sprint
  table said `planned` while both task files said `done`. **Found on the
  first read of the file**, which makes it the same four-files-disagree class
  `REVIEW-0008` had to sweep across S7, recurring immediately in the sprint
  that was un-parked. Corrected in the table rather than deferred.
- **All three ADRs now have bodies, and all three remain `Proposed`.** They
  were skeletons — every section reading "to be written" — until 2026-09-16.
  Per the human decision they were written **from the spikes' observed
  evidence**, explicitly **not** from `PLAN-0003`'s prose (which is how they
  reached skeleton state), and ratification is left as the human act it is.
  **Two had to be retitled because the evidence contradicted their planned
  titles**, which is the real output of writing them:
  - **`ADR-0015`** — *"portable core plus per-project templates"* → **derive
    per change, persist nothing**. See the refutation below. `templates/`
    survives for **copy-out** artifacts that hold no estate facts; what dies
    is fill-in-place. Its *filename* still names the rejected shape,
    deliberately, per `ADR-0017`'s precedent — so a reader arriving by
    filename is reading the wrong name, and the ADR says so in its Status.
  - **`ADR-0016`** — still *no category*, but **the reasoning is inverted**.
    The plan expected hooks not to work. **They work in both clients.** What
    declines the category is that the two clients **disagree on the tool's
    name**, so no portable artifact can match the same string.
- **`REVIEW-0009` is already reserved by S8's file.** S6's checkpoint must
  take the next free number rather than reusing it.

### Both spikes inverted their own briefs, and each changed a decision

**`TASK-0027` — the target repo's lint gate PASSES on real content, for the
first time on record.** 0 failures, 0 warnings, exit 0, across **53 built-in
rules** under `profile: production`. That gate had been live and **unproven**
since S004.T007, whose config comments still claim no playbooks exist. Three
findings that outlive the task:

- **The first run failed (exit 2) and both failures were copy-artifacts** —
  `ansible.cfg` names `vault_password_file = tools/vault_pass.sh`, which was
  deliberately not copied. **Zero real rule violations.** The "4 of 6 files"
  line is `ansible.cfg` and `ansible.log` being unknown-kind, not a skipped
  playbook — checked, because a silently skipped playbook would have
  invalidated the entire run.
- **The fidelity limit has a second reason the brief did not have:** the clean
  pass required **editing `ansible.cfg`**, so it describes a *different*
  configuration from the one the repo commits. A clean `/tmp` result is not
  evidence the target's own gate passes.
- **`ansible-lint` writes `ansible.log` with no flag at all.** The brief
  guarded against `--generate-ignore`; the real write needs nothing. Proven by
  mtime — scratch log `2026-09-17 00:26`, SIGMA's own still
  `2026-09-12 16:15`. **This is the copy-not-in-place decision vindicated by
  evidence rather than by caution.**

**`TASK-0028` — hook interception works in BOTH clients, which is the
opposite of the expected answer and still yields "no category".** Claude Code
is **documented-only** (`code.claude.com/docs/en/hooks`, fetched 2026-09-16:
MCP tools appear as regular tools in `PreToolUse`, which *"Can block it"*).
OpenCode was **observed live**, because its own docs show the hook blocking
only the built-in `read` tool and are **silent** on MCP tools — so the
installed bundle was read and then confirmed by a probe that intercepted and
blocked a **read-only** tool. The observed ID was `ansible_zen_of_ansible`,
matching the source reading exactly.

**The deciding fact is that the identifier differs**:
`mcp__ansible__zen_of_ansible` (Claude Code) vs `ansible_zen_of_ansible`
(OpenCode), in two languages, with two blocking conventions and two config
surfaces. A portable guard cannot express that — the incompatibility reaches
**the string the guard must match**, which is deeper than the
two-implementations problem `ADR-0016` anticipated.

**Three independent mechanisms in this sprint can each be installed and
inert, and that is the sprint's most transferable finding:**
1. A custom `ansible-lint` rule outside the active profile and not in
   `enable_list` is **loaded, listed, and never evaluated — at exit 0.**
2. A Claude Code matcher missing its `.*` (`mcp__ansible`) **matches no
   tool** while looking correct; the docs say so explicitly.
3. OpenCode under `experimental.codeMode` does **not register MCP tools
   individually**, so per-tool hooks never fire. Recorded as
   **could-not-determine** for the naming in that mode rather than guessed.

Each is this repo's most-repeated defect available as a one-line mistake.
Hence the condition now attached to `TASK-0031`: **the guard must ship a
proof that it fires**, not merely a proof that lint passes.

**A method note worth keeping.** `TASK-0027`'s probe needed **four runs** to
answer honestly. The first was silent, and silence alone reads as "custom
rules do not work" — which would have forced the guard to `pre-commit` for no
reason. `-L` showed it loaded (53→54) and `-c /dev/null` showed it firing,
isolating the real cause. **The probe was deliberately written to fire on
every play** so that silence could not be mistaken for success; a true no-op
probe would have been unfalsifiable. Two failure modes can look identical in
one run.

The `TASK-0028` probe was **reverted and the revert verified two ways** (the
plugins directory absent again as in its pre-state; the tool re-invoked in a
fresh session and succeeding, with the probe log not growing).
`~/.claude/settings.json` was never modified — SHA-256 identical before and
after. No destructive tool was invoked in either client.

### Four defects were found in S6's own remaining plan before it resumed

All four by opening the files the briefs name — standing lesson 7 — and all
four bearing on **TASK-0031**, the guard, which is the sprint's highest-value
deliverable. They are recorded in `SPRINT-CURRENT.md`, the roadmap, `TODO.md`
**and** corrected inside TASK-0031 itself, because a finding kept only in the
log of the task that fixes it gets rediscovered rather than reused
(`REVIEW-0008` finding 2).

1. **D1 — the guard's target matching was designed against the wrong
   thing.** TASK-0031 identified "PVE-class" hosts by **group name**
   (`pve_cluster`/`pve_voting`, made configurable). But the estate's only
   playbook that targets a PVE node uses `hosts: sigsrvpve1` — a **bare
   hostname** (`capture_pve_baseline.yml:21`). Group-name matching classifies
   it as *not* PVE-class and says nothing. Detection must resolve host→group
   membership transitively through the inventory's nested `children:`.
2. **D2 — a fixture that could not fail was an acceptance criterion, and
   this is lesson 8's third instance.** "The two real playbooks → guard
   **silent**" is satisfied by a correct guard *and* by a D1-afflicted guard
   that recognises nothing at all, since both playbooks are
   `gather_facts: false`. **Five green fixtures would have proven nothing
   about the estate the guard exists for.** A sixth is now required — PVE
   host by bare hostname, `gather_facts: true`, no exclusion → must **fail**
   — and it is the only case that fails when D1 is present. Worth carrying
   forward past Ansible entirely: **a fixture set can look complete and be
   uniformly blind, because every case shares one wrong assumption.**
3. **D3 — the `module_defaults` form was specified in a way that
   over-accepts.** `capture_pve_baseline.yml:23` *has* a `module_defaults:`
   block — scoped to `group/community.proxmox.proxmox` for API parameters,
   with **no `ansible.builtin.setup` entry**. A guard matching the key rather
   than a `setup`-scoped `gather_subset` passes dangerous code while
   appearing to implement the second accepted form. Seventh fixture added.
4. **D4 — `ansible-lint`'s recorded location was wrong.** TASK-0031's
   Inputs row said "pre-existing (SIGMA venv)"; **there is no venv in
   `SIGMA-infrastructure`.** It is at
   `/home/armando.martires/.venvs/sigma-ansible/bin/ansible-lint`, **not on
   `PATH`**. The version claim held — `26.8.0`, `ansible-core 2.20.8`,
   confirmed by running it — while the location claim did not.

**The common cause is the instructive part.** The plan was written from
`ansible.cfg:21-48`, which is accurate, emphatic and detailed about the
hazard, **without opening the playbook the guard must classify.**
`ansible.cfg` describes the rule; the playbook is where the rule is applied.
**The brief verified the hazard and never verified the subject** — a new
shape of lesson 7, where the cited evidence was real and simply not the
evidence the design needed.

Also re-measured while verifying: TASK-0031's Inputs row describes
`validate.sh` as "474 lines, ~0.37 s". It is **732 lines and ~1150 ms**. True
when written, decayed twice over, and now corrected in place with
`REVIEW-0008`'s warning attached — never time the gate on `/tmp` (ext4) and
compare against `/mnt/c` (9p), which understates by ~40%.

`SIGMA-infrastructure`'s `git status` was verified **clean** at the start of
this session and nothing under it was written. That constraint bound while S6
was parked and binds again now.

## S7 is CLOSED; S8 was promoted, then re-queued

**2026-09-16.** `REVIEW-0008` closed Phase 7 with **approve**, and S8 was
promoted in the correct order — the review first, then the promotion. S7 is
archived at `.ai/planning/sprints/SPRINT-S7-design-and-production-loops.md`.
**S8's promotion was then reversed later the same day** by `TASK-0052`
(re-queued, no work done); S7's closure is unaffected — it is closed either
way, and the section below is the record of that closure.

**The pre-committed question — *did anything get exercised?* — is answered
YES, from artifacts rather than task logs.** That distinction was the point:
the gate rejects a deliberately broken real role (`critic` → `crtiic`, exit
1, restored byte-identical); the registry indexes six roles; **nine files are
emitted** across two clients with the three OpenCode-only roles **skipped
rather than degraded**, so ADR-0018 clause 8 is observable in the filesystem;
the brief's lock is a dedicated brief-only commit; and the pilot's checker
exits 0 and 1 correctly on its own two fixtures. S7 is **not** the fourth
instance of the scaffolding pattern it was written to avoid.

**Three findings are on the record, and two of them are about this repo's
own habits rather than about S7's components:**

1. **The commit gate has left its stated budget.** `AGENTS.md` calls
   `validate.sh` "fast, offline, hermetic; keep it that way" and TASK-0038
   measured 606 ms rather than assuming. It is **960 ms at S7's end and
   ~1150 ms today**. The regression is *growth* — linear in component count,
   which is what a component library does — not a broken check. **A
   measurement trap was found and is now recorded in the roadmap Risks:**
   the first attempt timed a `/tmp` (ext4) worktree against the `/mnt/c` (9p
   DrvFs) repo and got a reassuring 358 ms, which compared **filesystems,
   not commits**. Re-run like-for-like, TASK-0038's baseline reproduces at
   622 ms. An encouraging measurement is the one to distrust.
2. **Four tasks left no session record** — TASK-0041, 0042, 0046, 0047,
   including **the pilot**, the sprint's most consequential task. This is
   the S6 defect recurring *inside the sprint that reconstructed it*, four
   times rather than once. **Deliberately not reconstructed**: fabricating
   four records a day later would invent the evidence the convention exists
   to preserve. The generalisable part is that `INDEX.md` has 25 rows and
   `.ai/sessions/` has 25 files, so **every available consistency check
   passes** — a missing session is missing from both. Any future check must
   compare task IDs against the `Tasks` column, never count rows.
3. **`qa-test` cannot run tests, and nothing tracked it.** Re-verified from
   the emitted file: `bash: {"*": deny, "git log*": allow, "git diff*":
   allow, "git status*": allow}`, while `docs/registry.md` advertises it as
   *"Writes and **runs** tests"*. **The role makes a false claim about
   itself** — TASK-0046's own class, in shipped content. The pilot found it
   and wrote it up accurately in three narrative files, and **none of that
   put it where a future sprint would look**. Now **B-021**.

**Closing the sprint found four files disagreeing about its own state**,
which is finding 3's class turned on the governance layer: the sprint file
called TASK-0033 (**the task that opened the sprint**) `planned` while its
own file said `done`; this file said "all six S7 tasks are done" when
**thirteen** were done and one cancelled; the roadmap said "eleven",
true-when-written and decayed by the two tasks that followed; and
**B-015/016/017 still read `ready` three tasks after S7 delivered them**,
B-016 still asserting in the present tense that `agents/` had "no template,
no schema, no `validate.sh` check, no registry section, no `install.sh`
path" when all five had shipped. All fixed in the closing commit rather than
deferred — a known-false status is not a follow-up. **`validate.sh` cannot
catch any of it**: it checks section presence, never whether a status
assertion in one file matches the status in another. Hence the new roadmap
risk: **sweeping the status columns is part of closing a sprint.**

**Two S7 items were deliberately left open rather than tidied:** ADR-0014
and ADR-0015 remain `proposed` while `skills/ansible-ops/` ships under them,
and **ADR-0015's one sketched clause is refuted** — it argues for the
`templates/`-filled-by-the-consumer shape the pilot tested and rejected
(`install.sh:105` symlinks a deployed skill into this working tree, so
filling a shipped template writes one estate's production facts into the
portable component). Both ADRs belong to **parked S6**, so writing them
inside another sprint's closure would muddle ownership. Recorded as
REVIEW-0008 follow-up 4 so the next reader of ADR-0015 is warned before
citing it.

**Reviewing that follow-up on 2026-09-16 found it was wrong twice, and the
corrections are on the record rather than silent.** It said "rewritten" —
but ADR-0015 has **no body to rewrite**: all three of its sections say *"to
be written"*, and its dependency `TASK-0027` is still `planned`. And
"contradicts a shipped component" overstated the scope: what is refuted is
clause 1's *mechanism* (a consumer filling a template with estate facts),
while the shipped `templates/change-record.md` holds no estate facts and says
*"Copy this file to wherever your estate keeps records"* — copy-out, not
fill-in-place. **The follow-up also missed a real defect that reviewing it
found:** three S6 briefs record the ADR as `accepted`, two of them ran `done`
anyway, and the waiver that permitted it was recorded only in this file
(finding 8b, below). **A review's follow-up list is itself a claim about
files, and decays the same way.**

## Sprint S8, planned — briefly current, now re-queued

> **Status corrected 2026-09-16 by `TASK-0052`:** this heading read *"planned
> and now current"*. S8 is **re-queued** at
> `sprints/SPRINT-S8-third-party-extensions.md` with all four briefs
> unmodified and B-019/B-020 still `ready`. Everything below remains the
> accurate record of what S8's planning found — none of which depends on its
> scheduling.

**2026-09-16.** A human asked for three third-party "plugins" — **ponytail,
omniroute, graphify** — added to the toolbox and made cross-agent
compatible if possible. Seven artifacts written, **zero components
changed** (planning was the explicit instruction): `ADR-0021` (proposed),
`PLAN-0005`, `TASK-0048…0051`, `SPRINT-S8`, `B-019`, `B-020`.

**The request's central word was the wrong abstraction, and that is the
finding the sprint is built around.** "Plugin" names three unrelated
mechanisms, verified from npm metadata and upstream *source* on 2026-09-16
against `opencode 1.18.31` and `claude 2.1.246`:

| | OpenCode | Claude Code |
|---|---|---|
| ponytail | npm `plugin` entry (`main` → `./.opencode/plugins/ponytail.mjs`) | plugin **marketplace** + two Node lifecycle hooks |
| omniroute | provider plugin needing a running daemon + API key | **not a plugin** — an OpenAI-compatible base URL |
| graphify | a generated plugin file *or* `AGENTS.md` — **README and source disagree** | `CLAUDE.md` section + `PreToolUse` hook |

So there is no portable "plugin" capability to abstract, and ADR-0006's
per-capability scoping applies unchanged. **No `plugins/` category**:
ADR-0016 declined one for hooks, and its three plumbing claims were
**re-verified rather than cited** (four hardcoded `emit_section` calls, four
hardcoded `validate.sh` iteration roots, a four-column `install.sh`
`CLIENTS` table) — a new top-level directory is *still* silently ignored by
all three and by CI. ADR-0016 had also predicted this sprint's exact trap in
words: naming a category after one vendor's term for a capability another
implements differently.

Placement instead follows what each thing **is**: graphify →
`mcp-servers/graphify/server.json` (ADR-0005 external shape); ponytail →
`configs/*/README.md`; **omniroute → out of the component layer entirely**
(human decision), documented once as an optional tool.

**Two upstream claims were falsified before the sprint started, both by
reading source instead of READMEs.** This is the S7 lesson (*a
doc-confirmed field is not an installed field*) arriving one sprint later
against different vendors:

- **graphify's README contradicts graphify's own `src/cli.ts`.** The README
  lists OpenCode among platforms with no hook point that fall back to
  `AGENTS.md`; the source defines
  `OPENCODE_PLUGIN_ENTRY = ".opencode/plugins/graphify.js"` plus a plugin
  template that hooks bash calls. Neither is evidence of installed
  behaviour, so it is assigned to `TASK-0048` rather than settled by
  picking the more convincing document.
- **`graphify serve` cannot start without an existing graph, and that
  breaks this repo's own test harness.** `src/serve.ts:188-195` —
  `createReloadingGraphStore` calls `validateGraphFilePath`, then
  `console.error` and `process.exit(1)`; `:896-897` defaults the path. So
  `tests/smoke-mcp.sh` would report **FAIL** where the truth is
  *precondition unmet* → **SKIP**. That script's own header insists three
  outcomes exist and that *"a SKIP is not a pass"* — this is **the mirror
  defect, a check lying in the other direction**. Raised as **B-020**
  because it is latent for **any** future server with a state
  precondition, not only graphify.

**ponytail's portable option exists and is unusable, on a checkable fact.**
Upstream ships `ponytail-mcp/`, which would have fit ADR-0005's external
shape exactly — the ruleset as an MCP prompt plus a read-only tool. But its
`package.json` says `"private": true` and `registry.npmjs.org/ponytail-mcp`
returns **404**. With nothing published there is no `launch.command`, so
the shape's premise fails and ponytail is documentation only. The reason is
re-checkable in one command, which is the point.

**Vendoring was refused for a mechanical reason, not taste.**
`install.sh:105` deploys skills with `ln -sfn`, so vendored copies of
ponytail's six skills would be symlinks into this repo's working tree,
making this repo maintainer-of-record for independently-shipping upstream
content. That is ADR-0004's three-copies problem, and the *same* mechanism
that invalidated ADR-0015's "portable core plus per-project templates"
shape in S6.

**omniroute's exclusion is the human's call and also the correct one**, so
`ADR-0021` records why rather than only that. It is a gateway *service* — a
daemon on `:20128`, an API key, a dashboard — that replaces where inference
comes from rather than extending an agent's behaviour. It also has the
widest blast radius of the three: its OpenCode plugin's `mcpAutoEmit`
option **writes an `mcp.*` entry into the client config**, a mutation this
repo forbids itself (emission writes role files only and never touches
`opencode.jsonc`).

**Two structural things worth carrying forward:**

1. ~~**S7 is not closed, and S8 was deliberately not promoted.**~~
   **RESOLVED 2026-09-16 in the correct order:** `REVIEW-0008` was written
   first, then S8 promoted. The escalation worked as intended — the
   deviation was recorded in the S8 header rather than absorbed, and the
   human's answer was to close S7 properly rather than skip the checkpoint.
   **This item also carried a false count**: it said "all six S7 tasks are
   `done`" when thirteen were done and one cancelled, which is why the
   closure swept every status claim rather than trusting the narrative.
2. **Two of three deliverables will be prose — the fourth instance of a
   class this repo has already diagnosed three times**
   (`mcp-servers/_template/` per ADR-0010; `agents/` and `prompts/` per
   ADR-0016; S7 about itself). Ordering is the only defence: `TASK-0048`
   runs **first** so the prose describes observed behaviour. Stated in the
   plan, the sprint file and the roadmap, with `REVIEW-0009`'s question
   pre-committed: *did the spike change anything, or did it rubber-stamp
   the vendor READMEs?* Since two README/source discrepancies were found
   **before** the spike began, a spike reporting zero findings should be
   read as weak rather than reassuring.

**B-019 is the first backlog item raised from a direct human request**
rather than from a plan, inspection or review — and its title carried the
defect, since "plugin" was the assumption that did not survive. That is
B-009's lesson (an item's title encodes an assumption) arriving through a
new door.

## S7's pilot ran, and both loops were exercised

**TASK-0046 ran S7's pilot** (2026-09-15): both loops were executed end to
end, producing `skills/ansible-ops/`
and `loops/ansible-change/` plus an accepted, locked design brief. S7's five
phases are complete and **exercised**; S6 was parked at the time of writing
(**un-parked 2026-09-16**), and its TASK-0029 and TASK-0030 are delivered.

## The third client is Bionic, and two findings about it were false

**TASK-0047 / ADR-0020, 2026-09-15.** A human noticed that
`configs/lm-studio` should name **Bionic** — LM Studio's agent-oriented
workspace — not the classic local-LLM desktop app. The premise held, and
checking it falsified two claims this repo had relied on since 2026-09-13:

- **Bionic *does* have an Agent Skills target**: `~/.lmstudio/skills/`
  (global) and `<project>/.agents/skills/` (project), documented in Bionic's
  own bundled `skill-management/SKILL.md:23-25`. ADR-0006 concluded there
  was none, resting on `~/.lmstudio/hub/skills/` — a *hub cache*, sibling to
  `hub/models` and `hub/presets`. Absence of evidence in one directory was
  recorded as absence across the client.
- **Bionic *does* perform agentic work.** `configs/`' claim that it "supplies
  models and performs no agentic work" was inverted: its bundle carries
  `lmstudio/exploration-subagent-v1` plus two `coder-*-subagents` entries,
  with projects, session transcripts, a permissions store and `bionic_tool`
  dispatch.

Skills still are not deployed there, but for a **narrower, real reason**:
global installs are approval-gated (`SKILL.md:31`, "DO NOT edit global
skills directly"), which `install.sh` cannot drive non-interactively.
Project skills *are* writable — raised as **B-018**. No agent roles are
emitted either, now because **no user-authored agent-role directory has been
found**, not because the client is inert (ADR-0018 clause 6 re-grounded).

Two things worth carrying forward:

1. **Classic LM Studio 0.4.24 is still installed** at
   `C:\Program Files\LM Studio\`, alongside Bionic 1.1.1+5 (**1.1.3+5 as of
   2026-09-22, `TASK-0053`**). They are modelled
   as one `configs/` entry by human decision, and the 2026-09-13 UI
   verification is credited to **classic**, where it was earned. Bionic is
   marked unverified rather than inheriting a pass it never took.
2. **No check in this repo could have caught this, and none realistically
   can.** It survived four tasks (0006, 0007, 0016, 0017) and two reviews,
   and was caught by a human reading a product name. The standing defence is
   that capability claims about third-party clients must cite vendor
   documentation or a version-stamped observation, so the next reader can
   re-check them cheaply — and that directory-name inference is not evidence
   **in either direction**, which is the generalisation ADR-0006 was one
   step short of making.

## Sprint S7, as executed — closed 2026-09-16; S6 was parked at the time (un-parked since)

*(Everything below is S7's narrative as it was written during the sprint,
kept as the record of how it went. The heading read "Sprint S7 is open"
until `REVIEW-0008` closed it.)*

`PLAN-0004` opened Phase 7: a **two-stage agent system** — an interactive
design stage that converges an idea into an accepted, locked brief, and a
largely autonomous production stage that carries it through plan,
implement, test, review and document — plus making `agents/` a real
component category. Seventeen artifacts written, zero components changed:
TASK-0033…0046, ADR-0017…0019, B-014…B-017.

**All three S7 decisions are settled (2026-09-15): ADR-0018 and ADR-0019
accepted, ADR-0017 REJECTED.** Accepting 0019 needed
ratification rather than evidence — it *narrows a stated requirement*,
which is the human's call. Ratification also caught a defect in the ADR's
own text: it said "two clauses" while containing three, corrected in place
rather than silently. **0018 was the opposite case**: it needed evidence,
got it from TASK-0036, and its mechanism survived while its reasoning did
not (detail below). **0017 is a third case: it needed evidence, got it, and
the evidence killed it** — `agent-tiers` stays with
`opencode-customization`, so this repo's first `Rejected` ADR withdraws a
claim rather than declining a proposal.

**TASK-0041 is done — S7's first implementation.** `loops/design-brief/` is
a gated component: **seven** steps rather than the four planned, cap **3**
with its unit stated as one pass through steps 2–6, and the lock mechanism
ADR-0019 left open now decided as **frontmatter plus a dedicated commit** —
the commit being the lock, because a frontmatter field alone can be flipped
by the next agent to open the file. Three gate checks were **observed
failing** on broken copies before the loop was trusted.

Three findings from it that change downstream scope:
- **The executor read-back earned its place.** The draft had the design
  manager committing at step 7, which would have widened that manager's
  blast radius and created a second owner of a concern `git-ops` already
  owns under a guarded boundary. Delegating fixes it, and `TASK-0044`
  inherits the same split rather than inventing one.
- **`design-doc-writer` has nothing to do.** The manager owns the brief
  because it is the only role that has spoken to the human. TASK-0043's open
  question is answered from the sequence side, and the sprint's role count
  is **six, not seven**.
- **`git-ops` is a Phase 3 dependency, not only a Phase 4 one.** It is
  reconciled into `agents/` by TASK-0045, which sits after TASK-0043, so the
  design loop cannot be *executed* end to end until that lands — TASK-0046's
  ordering problem, recorded rather than discovered there.

**TASK-0042 is done — the design stage now has both halves.**
`skills/design-flow/` is the *method* the loop references: a 3.3 KB core
routing to 12.6 KB in `references/` (no budget invented, ADR-0008), plus a
brief template carrying the three lock fields. Three skills now ship.

Its two substantive contributions are the ones that stop the method being
decorative:

- **Distinctness is defined as differing in a load-bearing commitment** —
  one whose change would force *rewriting* rather than *adjusting*. With five
  worked examples of load-bearing (where a fact lives; derived vs declared;
  the unit of deployment; where a boundary sits; enforced vs documented) and
  five of not. Without a test this concrete, step 2 produces variants and the
  critique compares near-identical candidates.
- **A critique carries eight named obligations**, so "found nothing" is a
  claim with content rather than an absence of effort. This is lesson 1's
  shape in content form: an empty critique recorded as a pass is a check that
  cannot fail.

Two findings from it:
- **The read-back found nothing to move**, and no cap number is restated
  anywhere in the skill (verified by grep — every `3` is a step number or
  list index). The sequence-vs-method boundary held under authoring, which is
  the evidence that splitting them across two artifacts was right rather
  than bureaucratic.
- **A gate proof nearly produced a false negative.** The name-mismatch test
  appeared to output nothing — which would have been recorded as "the check
  does not fire," exactly the claim class lesson 1 covers. The check fired
  correctly; the grep matched `NAME MISMATCH`, which is the *loops* check's
  wording, while skills emit `INVALID SKILL: … does not match directory`.
  **When proving a check bites, match on that check's own message or on exit
  status — never on a message remembered from a sibling check.**

**TASK-0036 is done — ADR-0018 is unblocked, its mechanism confirmed and
its reasoning replaced.** All three vendor pages re-fetched 2026-09-15
against installed `opencode 1.18.31` and `claude 2.1.246`. Emission stands,
but on different evidence than the ADR predicted, and four of its stated
facts were wrong.

The finding that changes the design:

- **A superset file is not merely inelegant — it silently drops the safety
  contract.** A fixture declaring read-only using *only* OpenCode's
  `permission:` syntax **loaded in Claude Code with `Write`, `Edit` and
  `Bash` in its tool pool**, while the native-syntax control reported
  `WRITE=no EDIT=no BASH=no`. The block was discarded with no warning. That
  is ADR-0018's predicted emitter bug — *"a `review` agent that can
  edit"* — except a superset file produces it **on every role, with no bug
  required**. Honest limit: the subagent then *refused* to write, on prompt
  grounds, so the breach is the **tool pool**, not a completed write.
- **Five of eight capability terms map to OpenCode only**, and they are the
  five carrying the safety value. Everything needing *intra-tool*
  granularity — which paths, which commands, or an `ask` state — has no
  per-agent Claude Code expression. **`git-ops` and `shell-runner` cannot
  be expressed as Claude Code subagents at all** without a session-wide
  rule or a hook, both outside a single agent file. TASK-0045 inherits a
  scoping problem, not a mapping detail.
- **The lossy direction is OpenCode → Claude Code.** So the abstract
  profile must sit at Claude Code's ceiling for anything it claims to
  enforce in both, and the emitter must **refuse** a term it cannot
  enforce rather than degrade it. That is ADR-0018's one needed new clause.
- **Four of ADR-0018's "established" rows were wrong in four days**:
  OpenCode identity (a `name:` field overrides the filename, undocumented),
  the three-field overlap (`description` is the *only* portable field —
  `model` and `color` overlap in name but their values are mutually
  invalid), unknown-key behaviour (OpenCode **documents** forwarding
  unknown keys *to the provider*, so they are not inert), and
  `.opencode/agent/` singular **also loads**.
- **The installed client is older than the docs describing it.** 6 of the
  35 patch versions the subagent page cites are newer than 2.1.246. A
  doc-confirmed field is not an installed field.

**This task's own log had to be corrected five times**, which is the
recurring lesson arriving inside the task written to guard against it:
a `validate.sh` output invented from memory (`All checks passed, 24 files,
0.39s` — the gate prints `validate.sh: OK`); a permission-key count of
"16/6" that is **15/5** when counted; "11" newer patch versions that is
**6**; one changed `~/.claude/` file when **three** were rewritten; and
worst, **an absence asserted from too small a search** — `subagent_depth`'s
default was recorded *unverified* because it is missing from the agents
page, then found stated verbatim on the *config* page. **The brief named
three pages; the fact was on a fourth.** A negative claim about
documentation is a claim about where you looked.

**ADR-0018 is accepted (2026-09-15), and Phase 2 is unblocked.** Ratified
on TASK-0036's evidence rather than on agreement: the mechanism it proposed
survived, its *reasoning* did not. Four corrections were made in place
(ADR-0019's precedent — a decision whose factual basis changed must show
it), and **one new clause** was added, which is the substantive output:

> **Clause 8 — the emitter refuses; it never degrades.** A capability term
> declares which clients can enforce it. When a role declares a term a
> target cannot enforce, emission for that target **fails loudly** rather
> than dropping or weakening it. Silent degradation would reproduce the
> observed breach *through* the emitter.

Clause 8 also **settles `git-ops` and `shell-runner` as OpenCode-only
roles**, rather than leaving TASK-0045 to meet the problem at
implementation time and reach for a workaround. Both workarounds are
rejected with reasons: a session-wide `permissions.deny` rule leaks one
role's boundary into every agent in the session, and a `PreToolUse` hook
puts enforcement in a second artifact the role file does not own. Either
may return via a later ADR **with a worked example** — never inside an
implementation task.

**Two roadmap staleness items were found and fixed while propagating**, both
instances of lesson 6 rather than new problems: the Phase 7 section still
said ADR-0017…0019 were "all proposed" (two are now accepted), and still
said "seven roles" after TASK-0041 declined `design-doc-writer` and
established six. The phase now carries a decision-status line kept current
in place. **That is the fourth and fifth instance of this class in a file
whose own text records the first three** — still no mechanism, only a
habit of checking.

**TASK-0037 is done — `agents/` is now a *defined* category.** The
`authoring-guide.md` Agents section is its fourth component section: a
9-row frontmatter rule table with a reason per row, a **9**-term capability
vocabulary mapped to both clients, the forbidden-client-native-syntax rule,
a no-budget statement, and Claude Code's 15,000-token description warning
documented as a **vendor threshold, explicitly not gated** (this repo
cannot measure it — it spans roles this repo never emitted). `validate.sh`,
`sync-registry.sh` and `install.sh` are **untouched**, so ADR-0008's
definition-before-enforcement order held.

Four findings, the first of which nearly inverted the task:

- **The brief contradicted ADR-0018, and the ADR won.** The brief (written
  pre-spike) says twice that a term mapping to only one client *"cannot be
  offered"* and *"must be excluded"*. ADR-0018 clause 8.3, written on the
  evidence, says such a term **is** legal — the role narrows `clients` and
  the emitter refuses rather than degrades. **Following the brief would
  have produced a three-term vocabulary and silently discarded the safety
  boundary of every existing role**, since `bash-allowlist` alone is
  load-bearing in all four. Resolved for the ADR: a decision ratified on
  observed evidence outranks a brief written on a prediction. Not
  escalated, because the ADR is accepted and unambiguous.
- **A ninth vocabulary term was missing, found only by testing the
  abstraction against real files.** TASK-0036's table has eight;
  `qa-test`'s `webfetch: ask` is neither `no-webfetch` nor absent. Added
  `webfetch-requires-confirmation`. All four roles now map with **no
  leftover boundary** — verified by script, not by eye.
- **`worktree-only` is *partial*, not OpenCode-only.** The spike said "no
  per-agent equivalent"; Claude Code does have `isolation: worktree`. But
  it is a different guarantee — OpenCode **refuses** calls outside the
  worktree, Claude Code **redirects** into an isolated *copy*. Recorded as
  a semantic gap with the decision assigned to TASK-0040, because **all
  four roles declare this term**, so choosing silently would affect every
  one of them.
- **`color` is dropped from the schema.** ADR-0018 called it "overlap in
  name only"; counted, the value sets share **zero** members
  (`red…cyan` vs hex-or-`primary…info`). A key with no portable value has
  no place in a client-agnostic source.

**A green gate here proves nothing about `agents/` — and that was
*observed*, not asserted.** The template was replaced with unparseable
YAML, no delimiters, an invalid `mode` and a forbidden `permission:` block;
`validate.sh` returned **exit 0**. Restored and confirmed byte-identical by
SHA-256. The inverse of lesson 1: the usual risk is a check that cannot
fail, and here the point was proving a check is genuinely *absent*, so
TASK-0038 is known-necessary rather than presumed so.

**Phase 2 is complete. `agents/` is defined, enforced, indexed and
deployable** (TASK-0037…0040, run in that order after checking they were
safe to sequence rather than parallelise — see below).

- **TASK-0039 (registry)** — two lines plus a comment, which is what B-007's
  centralization was for. Three things proven rather than assumed: the
  template's exclusion comes from **the central skip** (shown by disabling
  it and watching all five templates appear), the section genuinely
  **populates** (a temporary fixture, since an empty header looks correct
  either way), and the registry-integrity checks **extend automatically**
  (observed failing in both directions with correct section attribution).
- **TASK-0038 (the gate)** — a ninth check group, **17 rules each observed
  failing** on a single-rule fixture plus a valid control. `agents/` is no
  longer the only unpoliced category. Runtime 654→606 ms, still sub-second,
  with linear scaling in role count recorded as a known property.
- **TASK-0040 (emission)** — `scripts/emit-agents.py` plus a fourth
  `CLIENTS` column. **All nine capability terms proven per client: four map,
  five refuse for Claude Code** with the remedy named. ADR-0018 clause 8 is
  now executable rather than aspirational.

**Three findings from the sequence that matter beyond it:**

1. **A finding travelled between tasks and was closed by the next one.**
   TASK-0039 discovered that a folded `description: >-` reaches the registry
   as the literal `>-` with the text dropped — and **`validate.sh` passes
   it**, because the column count is still right. It could not fix that
   (wrong task's file), so it handed it to TASK-0038, which now rejects
   folded descriptions two ways. Worth noting the shape: the defect was
   invisible to the check that "covers" the registry.
2. **A fixture harness was unsound on its first run, and its output looked
   like success.** TASK-0038's 17 fixtures each violated the name↔directory
   rule *as well as* their target rule, so every case failed — for the wrong
   reason. A careless reading records "17 for 17 proven". Fixed and re-run
   so each case emits exactly one message. **A fixture meant to isolate one
   rule can violate several, and then the failure proves nothing about the
   rule under test.**
3. **The three tasks were dependency-independent but not safely
   concurrent**, which is why they were sequenced after checking rather than
   run in parallel as first proposed. Two would have edited
   `tests/validate.sh`; and TASK-0038's `agents/_fixture-*` directories are
   **not** covered by the `_template*` skip, so a concurrent TASK-0039
   regeneration would have committed fixture rows into `docs/registry.md`.
   Verified directly — the fixture *did* appear in the registry while it
   existed. In the event TASK-0040 needed **no** `validate.sh` change at
   all, so the file collision never materialised, but that was not knowable
   in advance.

**Two decisions the plan assigned to TASK-0040, both recorded with
reasoning rather than improvised:**
- **`worktree-only` emits Claude Code's `isolation: worktree`.** Not
  equivalent to OpenCode's `external_directory: deny` — refusal versus
  redirection into an isolated *copy*. Emitted anyway because all four
  existing roles declare the term, so refusing would have made every one of
  them OpenCode-only and left the Claude Code emitter dead on arrival. **The
  weakest mapping in the vocabulary; re-examine it first** if roles ever
  behave differently across clients.
- **ADR-0018 clause 7: the emitter emits `{tier:<name>}` and never resolves
  it**, so `models.jsonc` remains the single owner of tier→model. **That
  owner is now permanently in another repo** (ADR-0017 rejected), so the
  placeholder resolves nowhere. Harmless today — `model` is optional and no
  role uses it — and documented in three places. **Do not add a second
  mapping here to close it**; that is the defect clause 7 forbids.

**Emission's two accepted weaknesses, both documented in the client
READMEs rather than patched:** no freshness check is possible (ADR-0009
forbids checking runtime presence, so re-running `install.sh` *is* the
control), and **nothing prunes a stale emitted file** — demonstrated by
emitting a fixture role, deleting it, re-running, and finding the emitted
file still live. An installer that deletes from a user's config directory
needs its own decision, not a convenience.

**Phase 1 is closed — with its reclamation withdrawn rather than
delivered.** TASK-0034 done, ADR-0017 rejected, TASK-0035 cancelled. The
spike written to *prepare* the claim is what **stopped** it, which is the
sprint's "verify before claiming" ordering earning its place rather than
failing. The sprint's ordering principle was amended accordingly:
*reclaim before authoring* → **verify before claiming**.

**TASK-0043 is done — `agents/` now holds three real roles and Phase 2 is
exercised end to end.** `designer-manager` (primary), `ideator` and `critic`
are authored, gated, indexed and emitted; six client files exist where both
directories were empty. **Phase 2's artifacts are no longer plausible-but-
unproven**: the gate passed on real content for the first time, the registry
populated, and the emitter produced output that was *inspected* rather than
assumed.

**`critic` is proved read-only at runtime in both clients** — the task's
highest-consequence risk. Claude Code reports `WRITE=no EDIT=no AGENT=no`
from the subagent's own tool list (contrast TASK-0036's `cc-permonly`
fixture, which *had* Write and merely declined to use it), and OpenCode's
resolver applies all six of its denies. `designer-manager`'s allowlist
resolves deny-first: `task */deny`, then `critic`, `git-ops`, `ideator`.

**Two decisions it settled:**

- **`design-doc-writer` is declined**, on evidence: **zero** references
  across all shipped content. The manager writes the brief at step 4 and
  `git-ops` commits at step 7, so the role would exist to perform a
  mechanical write another role must do anyway. **The sprint's role count is
  six, not seven.**
- **The capability vocabulary needed a tenth term.** TASK-0043's step-2 gate
  found it could not express its central role's boundary — a primary
  delegating to *exactly* three named subagents. Crucially this was a
  **vocabulary gap, not a client limitation**: both clients can enforce an
  allowlist, and `agent-tiers`' own primaries each carry one. Escalated
  rather than worked around, then fixed as **follow-ups to the owning
  tasks** in ADR-0008's order — definition (TASK-0037), enforcement
  (TASK-0038), emission (TASK-0040) — each recorded in its own log rather
  than patched from TASK-0043.

**`delegation-allowlist` carries a schema rule worth knowing:** it requires
`mode: primary`. Claude Code **ignores** an `Agent(...)` type list in a
subagent definition, so a subagent declaring it would be enforced in
OpenCode and **silently widened** in Claude Code — ADR-0018 clause 8's exact
failure mode, now rejected by the gate. It is also the vocabulary's first
**parameterised** term (`delegates_to`), and the first beyond the basic three
that maps to *both* clients.

**TASK-0044 is done — both loops now exist.** `loops/project-build/` is 218
lines, 8 steps, derived from `agent-tiers`' `bmad-workflow.md` **read in
place** (the import never happened — ADR-0017 rejected). Three findings the
brief did not forecast:

- **ADR-0019 requires a step the inherited sequence lacks.** Clause 2.1's
  autonomous list names *document*; `bmad-workflow.md` has seven numbered
  items and **zero** mentions of documentation (verified by grep). Added as
  step 6 and **labelled in the loop as the one addition**, so a reader
  comparing the two files finds an explanation rather than a discrepancy.
- **Separating the two known bounds left a third one missing.** A `review`
  block correctly does not consume the fix-cycle budget — but stated only
  that way, the review path is **unbounded**: block → fix → block, forever.
  Neither `bmad-workflow.md` nor ADR-0019 addresses it. Added: the **same
  finding** surviving three review rounds stops and escalates, because that
  is a `review`-vs-`build` disagreement about what the story requires. **The
  brief anticipated conflating the two bounds; it did not anticipate the gap
  conflation was hiding.**
- **The two-owners question had no available answer from the brief's
  options.** It offered "the loop is authoritative and the skill points at
  it" or the reverse — **both assume this repo can edit the skill**, which
  ADR-0017 settled it cannot. Recorded instead as **two artifacts with one
  shared ancestor, neither updating the other**, with this loop governing
  work in this repo and any divergence a finding to record. Weaker than one
  owner, and stated as such rather than implying a sync that cannot happen.

`release-check` is **referenced, not restated**, for the commit step — with
the caveat that it is scoped to *this* repo and names
`tests/validate.sh`/`sync-registry.sh` directly, so elsewhere it is the
pattern rather than the procedure.

The executor read-back confirmed the sequence is executable under
`subagent_depth: 1`: every subagent step (test, review, commit) is invoked
**by `build`, a primary** — never subagent-to-subagent, which is the natural
way to write it wrong.

**TASK-0045 is done — six roles now exist and both loops are executable.**
`qa-test`, `review` and `git-ops` are authored in `agents/` from the
`agent-tiers` copies read as reference (never imported — ADR-0017). All
three are **OpenCode-only**: each needs a command allowlist or a path-scoped
edit, neither of which has a per-agent Claude Code expression, so
`install.sh` **skips** them there with exit 0 rather than refusing. Nine
files now emitted across two clients.

**The task's own worst defect was in the emitter, not in the roles — and it
was mine, not inherited.** Merging `git-ops`' three bash-related terms and
sorting the globs **alphabetically** produced an order where, under
OpenCode's last-match-wins resolution, `git push --force` matched
`git push*: ask` *after* `git push --force*: deny` — resolving to **ask, not
deny**, in the one role whose reason to exist is that it cannot force-push.
Fixed by sorting **shorter patterns first** (a longer pattern is the more
specific rule and must win), verified by resolving seven commands against
the emitted order. A second defect: `no-force-push` omitted
`git clean -f*`, which matched `git *` → allow and would have let the role
delete untracked files irrecoverably.

**Both were found by diffing emitted output against the reference roles fact
by fact, and both would have passed a read-through.** That method is the
transferable part: extract every `key=action` pair from each side and
set-difference them. Reading an emitted file and judging it plausible is what
ADR-0018 warns produces "a plausible agent file with wrong permissions".

A third fidelity gap was found *before* authoring: **`bash-allowlist` could
not name the commands it permits**, emitting `bash: {"*": "ask"}` where the
roles **deny** everything unnamed. For `git-ops` that meant a human could
approve `rm -rf` at a prompt the role was designed never to reach. Same
shape as TASK-0043's `delegation-allowlist` gap, so the same resolution was
followed rather than re-escalated: parameterise it (`bash_allow`) as
amendments to TASK-0037/0038/0040 in ADR-0008's order. **The vocabulary now
has two parameterised terms, and both deny by default** — recorded in the
guide as the rule for any future one.

**Two scope questions answered:**
- **Ownership: none of the brief's three options applied**, because all
  three assumed the skill is in this repo. It is not, so
  `agents/<role>/agent.md` is the sole definition here from the first commit.
  The two-owners question moved outward instead and is **documented, not
  fixed**: `git-ops` will exist twice on this machine — project-local via
  `/bmad`, global via `install.sh` — and OpenCode resolves **project over
  global**, so they do not collide. Written into both client snapshots.
- **`shell-runner` not authored.** No step in `loops/project-build/`
  references it, and `bmad-workflow.md` says `build` never invokes it
  directly. A role nothing references is structure without benefit — the same
  reasoning that declined `design-doc-writer`. **Role count six, confirmed.**

Also recorded: **`write` is not an OpenCode permission key.** The live table
documents 15, and `edit` gates `write`/`edit`/`apply_patch`. The emitter
emits `write: deny` anyway — inert, accepted, kept by the resolver, and
defence in depth against a key rename — with `edit: deny` noted in the
emitter as the operative rule, so nobody removes the wrong line.

**TASK-0046's pilot has RUN, and both loops were executed end to end**
(2026-09-15). Phases 1–4 built two loops, six roles and a component category
that is defined, enforced, indexed and deployable; **Phase 5 exercised all
of it**. REVIEW-0008's pre-committed question — *did anything get
exercised?* — is answerable **yes**, from recorded evidence.

What the pilot produced: `skills/ansible-ops/` (SKILL.md, 3 `references/`,
1 `templates/`, 1 `scripts/`, 2 `fixtures/`) and
`loops/ansible-change/loop.md`, both **through** the loops rather than by
hand, plus the accepted, locked design brief at
`docs/design/ansible-ops-brief.md` (lock commit `8e1d1be`).

**The loops survived contact, and the roles' boundaries bound for real.**
Five distinct permission engagements were observed, not asserted: `critic`
could not write its own critique (`write`/`edit: deny`) and could not read
the evidence estate (`worktree-only`); `ideator` could not read a `/tmp`
handoff, which moved the handoff inside the worktree; `git-ops` refused
`&&` chains and a `--` pathspec under its `bash-allowlist`; and **`qa-test`
could not run the tests it exists to run** — its allowlist admits only
`git status/diff/log`, so it correctly refused to claim unobserved passes.
That last one is a real defect in the vocabulary, not a misconfiguration,
and it is the pilot's most actionable finding.

**Both loops' exit conditions fired.** The design loop converged in **one**
iteration (cap 3 unreached) and its critique returned **35 findings** across
four candidates — the opposite of the empty-critique failure mode ADR-0019
clause 1.3 warns about. The production loop's **ambiguity-stop fired in step
1**: `plan` found four HIGH ambiguities the locked brief did not settle and
refused to invent answers, which is clause 2.5 working as designed. `review`
blocked **five** times before passing on round 6.

**The most consequential finding is about method, not about either
component:** five consecutive review rounds each surfaced a *new* instance of
one defect class — a false claim an artifact makes about its own structure
("every gate maps to a field", "stated nowhere else, so it cannot drift",
"linked, never restated", and a checker header asserting `validate.sh` runs
it when **nothing** does). Per-finding fixes never converged; the reviewer
diagnosed that the sweep had been per-finding rather than class-wide, and a
deliberate class-wide sweep then verified **35 claims and found 12 false**.
Nothing in `validate.sh` can catch this class — it checks frontmatter, never
prose claims.

~~**S6 is parked, not closed and not abandoned**~~ — **SUPERSEDED
2026-09-16: S6 is un-parked and current again** (`TASK-0052`; see this
file's opening section). The park was a human decision on 2026-09-15 and
held for one day. B-010…B-013 stayed **ready** throughout, since neither
parking nor un-parking un-scopes a backlog item.

The park's own reasoning is worth keeping, because **it was confirmed from
the other side**: *"parking cost nothing precisely because nothing had been
implemented; the same decision one sprint later would have needed
reconciliation."* Un-parking cost nothing for exactly that reason, and
re-queuing S8 cost nothing for the mirror reason — zero components changed
there. **The prediction held in both directions.**

**The second sprint in a row planned from a human-supplied analysis**, and
**eight of its claims were corrected before planning finished** (against
six in S6). In order of consequence:

1. ~~**Half the production stage already exists, unowned**~~ — **the
   "unowned" half of this claim is RETRACTED as false (TASK-0034,
   2026-09-15).** `~/.config/opencode/skills/agent-tiers/` does implement
   `plan → build → qa-test → (fix loop, max 3) → review → git-ops commit`
   with permission-enforced boundaries, it *has* drifted, and it *has*
   never been switched on. But it is **not unowned**:
   `opencode-customization` **deliberately kept it** by explicit user
   decision on 2026-09-13, in commit `9bae137` — *"agent-tiers is
   deliberately kept in this repo (user decision) — confirmed
   OpenCode-specific by design"* — corroborated by that repo's
   `.ai/30.ROADMAP.md:45` and by a written, **unpulled reopen trigger** at
   `:240` (*"Revisit `agent-tiers` → `ai-toolbox` if a concrete reason
   emerges (not scheduled)"*).

   S7 planned from ADR-0004's quotation of that repo's **older** roadmap
   ("`S027` hands `project-workflow` (and `agent-tiers`)") without re-reading
   that roadmap after `S027` actually ran four days later. So this was not
   lesson 9 (an orphan) but **lesson 7 (a decayed claim)** — and the decayed
   claim was a quotation of an *external* document, the class this file
   already flags as fastest-decaying.

   The drift itself is fully characterised and harmless: **two** files
   differ, the **repo copy is newer for both, consistently, from that one
   commit**, and both changes merely remove `project-workflow`
   cross-references. **The installed copy carries no unique fix**, so
   nothing would be lost by preferring either side. Both still declare
   `metadata.version: "1.0.0"`, which remains a real version-integrity
   defect — but in *that* repo's component, not an unowned one. The installed
   copy is a **real directory** where this repo's skills are symlinks, and
   `opencode.jsonc` still contains **no `agent` key**, so the topology has
   never been in effect.

   **DECIDED 2026-09-15 (human): `agent-tiers` stays with
   `opencode-customization`.** ADR-0017 is **Rejected** — this repo's first
   — with a 3-condition reopen trigger. **TASK-0035 is cancelled** (its
   premise is gone, not pending) and **TASK-0045 is rescoped** to *author*
   the three production roles in `agents/` under ADR-0018, reading the
   installed copies as reference. Nothing is imported; nothing in that repo
   changes.

   The "OpenCode-specific" scoping that repo relied on is **substantively
   correct**, not just a boundary of convenience — verified while deciding:
   - `install-tiers.ps1` depends on `plan`/`build` being **OpenCode
     built-in names overridable by config while keeping their tuned system
     prompts**. Claude Code's custom files *replace* a built-in instead, so
     the mechanism does not exist there.
   - **Codex has no per-role agent definition at all** (`codex-cli
     0.154.0`, checked on this machine): `codex agents` browses *sessions*;
     there is no subagent, delegation or task-spawn concept; `--profile`
     layers one whole config bundle, not a set of named roles. ADR-0006's
     situation exactly — the gap is in the client.
   - `git-ops` and `shell-runner` are **inexpressible as Claude Code
     subagents** (TASK-0036), both existing purely to enforce a command
     allowlist.

   Supporting the split: all five dangling cross-repo citations live in the
   *installer* half, and the four role files contain **zero** — verified,
   so the roles are separable from the installer that ships them.

   **One gap the rejection creates, recorded not left to surface:**
   ADR-0018 clause 7 names `models.jsonc` the single owner of tier→model,
   and that file is now permanently in another repo. `emit-agents.py` emits
   `model: "{tier:<name>}"` with **no resolver in this repo**. Harmless
   today — `model` is optional and no role uses it — and documented in the
   authoring guide, the emitter's header and ADR-0017. **Do not close it by
   adding a second mapping here**; that is the two-owners defect clause 7
   exists to prevent.
2. **Agent definitions are not portable between clients.** Location,
   identity (filename vs a required `name` field), capability gating
   (`permission` vs `tools`/`disallowedTools`), primary-vs-subagent (an
   explicit `mode` vs no equivalent field), model IDs, nesting defaults, and
   delegation restriction **all** differ. The overlap is `description`,
   `model`, `color` — **everything that makes an agent safe differs.** This
   is ADR-0006's situation exactly, and its resolution generalizes:
   portability is scoped **per capability**. Hence ADR-0018, before any role
   is authored.
3. **Claude Code dynamic workflows cannot do the design stage.** Their own
   constraints table: *"No mid-run user input — Only agent permission
   prompts can pause a run. For sign-off between stages, run each stage as
   its own workflow."* An interactive design stage is mid-run user input by
   definition. They are also a Claude-Code-only JS runtime, so a component
   built on them is unportable by construction. **Excluded from the
   architecture.**
4. **Subagents cannot ask the user.** Claude Code strips a fixed tool list
   from every subagent regardless of its `tools` field, including
   `AskUserQuestion`. OpenCode reaches the same place via
   `subagent_depth: 1`, under which a subagent cannot spawn workers. So
   `designer-manager` must be a **primary** agent — forced independently by
   each client, structural rather than stylistic.
5. **`agents/` is a declared category with nothing behind it.** A 141-byte
   README is the only file, yet it is named first-class in `AGENTS.md`,
   `README.md`, ADR-0001, `GLOSSARY.md` and `PROJECT_MAP.md`. No template,
   schema, check, registry section or install path. `prompts/` is identical
   at 127 bytes. ADR-0016 already recorded this and drew the right
   conclusion — *"A declared category can exist indefinitely with nothing
   behind it"* — while deciding a different question.
6. **Emission and symlinking are incompatible.** `install.sh:105` deploys
   skills with `ln -sfn`, so a repo edit is live everywhere with no sync
   step. A per-client **emitted** agent file cannot be a symlink — its
   content differs per client by definition. Agents therefore deploy by
   generation only: no `link`, no `copy`. That makes an emitted file a
   fourth copy whose freshness **nothing can verify**, because ADR-0009
   forbids checking runtime presence. The control is idempotent
   regeneration, not a gate.
7. **"No human intervention" collides with four `AGENTS.md` rules** —
   destructive changes need authorization *in the task file*; pushing needs
   `GITHUB_TOKEN` from the environment; the ambiguity policy says stop and
   ask; the definition of done requires a *reviewed* diff. The defensible
   scope is **autonomous within a locked plan, with a mandatory human gate
   before merge and push**. ADR-0019 records it.
8. **Value inverts from the proposal's ordering.** Highest value is
   *reclaiming what already exists*, not authoring new roles; the genuine
   capability gap is the **design** stage, since `agent-tiers`' `plan` writes
   a spec in one pass with no ideation, no critique, and **no convergence
   criterion**.

**Four proposals were rejected outright**, each recreating a defect already
paid for: a second `agent-skills` repo (ADR-0004's three-copies problem);
in-repo `.claude/skills/` and `.claude/agents/` (a self-referential fourth
copy and a second install path competing with the validated one); a
`workflows/` category (`loops/` already is this, with mandatory exit
conditions enforced at `validate.sh:193-213`); and `ci-skills-sync.yml` (a
machine-specific runtime check, forbidden by ADR-0009). Recorded in S7's
`SPRINT-CURRENT.md` "Out of scope" so they are not re-raised.

**S7's known limitation, stated up front and given a pre-committed review
question:** the sprint adds two loops, one skill, a component category and
**six** roles (settled: `design-doc-writer` declined by TASK-0043). **If the pilot (TASK-0046) does not run, all of it is
scaffolding** — and the sprint would have diagnosed that exact pattern in
`agent-tiers` while reproducing it. This would be the **third** instance
after `mcp-servers/_template/` (ADR-0010) and `agent-tiers` itself. Hence
REVIEW-0008 opens with: *did anything get exercised?*

**Two omissions were found and repaired while planning:**
- **The ROADMAP had no Phase 6 section at all.** S6 existed in
  `SPRINT-CURRENT.md`, `TODO.md`, this file and `PLAN-0003`, but never in
  the roadmap — the same drift REVIEW-0007 caught for Phase 5 ("in progress"
  after completion), **recurring one phase after being diagnosed.** That is
  evidence for its finding 6: the lesson needed a mechanism, not more prose.
  No mechanism was added, and it repeated. Recorded in the new Phase 6
  section rather than quietly backfilled.
- **The S6 planning session left no `SESSION-*.md` record and no `INDEX.md`
  row.** ADR-0012's invariant is that a task be startable cold from its own
  file **plus the two index files**, so a missing row is a hole in the
  mechanism this repo relies on for resumability. Reconstructed as
  `SESSION-20260914-0330`, labelled as reconstructed, with unrecoverable
  fields marked rather than guessed.

**Cross-client claims decay faster than internal ones.** Every mapping fact
above was **fetched 2026-09-15, not recalled**, from
`code.claude.com/docs/en/{workflows,sub-agents}` and
`opencode.ai/docs/agents/`. Both clients ship frequently and their docs
already qualify behaviour by patch version in dozens of places. TASK-0036
must **re-verify rather than cite `PLAN-0004`**, and every ADR records the
date it read what it read.

## Sprint S6, as planned — un-parked 2026-09-16 and now the plan being executed

**This section is still the plan of record, and as of 2026-09-16 it is the
plan of the *current* sprint** rather than a parked one. Everything in it
remains unexecuted apart from TASK-0029/0030 (delivered by S7's pilot), and
it is the plan B-010…B-013 are scoped against.

**Read it with the four `TASK-0052` defect corrections in hand** (D1–D4, in
this file's opening section): the guard's target matching, its fixture set,
its `module_defaults` rule and its `ansible-lint` path were all wrong in this
plan as written. The narrative below is preserved as written; TASK-0031 itself
carries the corrections.
`PLAN-0003` opened Phase 6: an **instruct layer** for the `ansible` MCP
server (skill + loop), a narrowing of that server's blast radius, and one
real enforcement. Ten artifacts written, zero components changed:
TASK-0026…0032, ADR-0014…0016 (all **proposed**), B-010…B-013. Opened by
commit `9528d13`, pushed to `origin/master` and confirmed by re-fetch.

**S7's pilot (TASK-0046) DELIVERED TASK-0029 and TASK-0030** (2026-09-15) —
`skills/ansible-ops/` and `loops/ansible-change/` were produced *through*
S7's new loops, and both S6 briefs are **closed as delivered-by-S7**.
**TASK-0031, the highest-value item below, is NOT delivered**; B-011 stays
open, and the shipped skill says so in writing rather than implying coverage.

**The ADR-0014/0015 gap was resolved explicitly, not glossed** (human
decision, Option 2): the components were built from `PLAN-0003`'s recorded
F1–F7 evidence, and both ADRs **remain `proposed` and still owe
ratification**. The binding consequence, recorded in the brief: the design
may make **no claim resting on an observed lint result**, because
`TASK-0027` is still unrun. `ansible-lint 26.8.0` was confirmed present in
the control venv, so that spike is now cheap to run — it was *not* the
blocker the sprint assumed.

> **Updated 2026-09-16: `TASK-0027` has now RUN, so that constraint is
> lifted** — a claim resting on an observed lint result is now permissible,
> and the observed result is **0 failures across 53 rules, exit 0**. The
> "cheap to run" prediction held: it was one copy and two runs. **Both ADR
> bodies are now written** and both still owe ratification. Note the venv's
> location was *also* wrong in the row that recorded it — it is
> `~/.venvs/sigma-ansible/`, not inside the target repo (`TASK-0052` D4).

**ADR-0015's intended clause 1 is contradicted by evidence and must be
*written* — not rewritten — before ratification** (verb corrected 2026-09-16
by `REVIEW-0008`; see the two qualifications below).

> **DONE 2026-09-16: the body is now written, and clause 1 is formally
> reversed** — the ADR's Decision 1 is *"estate-specific knowledge is derived
> per change, never declared and never stored in the component"*, and the ADR
> was **retitled** so its own title no longer asserts the rejected mechanism.
> `templates/` survives for **copy-out** artifacts (qualification 2 below),
> which is why the shipped `change-record.md` is untouched. **The filename
> still names the rejected shape** — deliberately, per `ADR-0017`'s
> precedent, and flagged in the ADR's own Status so a reader arriving by
> filename is warned. Ratification is still owed, and is owed *specifically*
> on this clause, since reversing an approved mechanism is a substantive
> change rather than a restatement.

Its "portable core plus
per-project `templates/`" shape was marked *assumed* rather than hard, then
**tested and found wrong**: `install.sh` deploys skills with `ln -sfn`, so a
deployed skill is a symlink into this repo's working tree — an operator
filling in a shipped `templates/estate-profile.md` would write one estate's
production facts into the portable component. The pilot chose a **derived,
persist nothing** shape instead. This is exactly what marking a constraint
*assumed* was for, and it is the clearest instance yet of planning prose
failing contact with a file.

**Two corrections from re-reading the ADR itself rather than these notes
about it** — both instances of the class this file already tracks, a claim
about a file that decays from the file:

1. ~~**There is no body to rewrite. ADR-0015 is a skeleton**~~ — **RESOLVED
   2026-09-16, in exactly the order this item prescribed.** It said the open
   work was *"TASK-0027 first, then the body, then ratification"*, and that
   is what happened: the spike ran, then all three bodies were written from
   its observed evidence, and ratification is left outstanding. When written,
   `## Context` said *"To be completed when this ADR is written"*,
   `## Decision` said *"To be written. Intended shape:"*, and
   `## Consequences` said *"To be written. Expected:"*. **Its warning also
   held**: *"filling the sections in from the plan's prose is how it reached
   this state"* — so the bodies cite the spikes and name where a plan-time
   claim did not survive. ADR-0014 owed the same against the same spike and
   now has it. **A rare case in this file of a recorded prescription being
   followed rather than rediscovered.**
2. **"Contradicted" applies to clause 1's *mechanism*, not to `templates/`
   as such.** What is refuted is a consuming repo filling a shipped template
   with **estate facts**. What shipped holds none:
   `skills/ansible-ops/templates/change-record.md` is nine placeholder
   fields for a *per-change record*, and its line 30 reads *"Copy this file
   to wherever your estate keeps records. **This skill does not say
   where**."* Copy-out, not fill-in-place — so the directory survives and
   only that clause's mechanism does not. Earlier wording here and in
   REVIEW-0008 conflated the two.

**Three S6 briefs record ADR-0015 as `accepted`, and two ran `done` with the
precondition unmet** (`REVIEW-0008` finding 8b): `TASK-0029:93`,
`TASK-0030:84`, `TASK-0032:84`. The rows sit under **"Expected state"**, so
they are expectations rather than assertions — S5's handover contract working
as designed — and TASK-0032 is still `planned`, so its expectation is
legitimately forward-looking. But TASK-0029/0030 are `done`, and **the Option
2 waiver was recorded only here, in this file**, not in the task files whose
precondition it waived. A cold reader of TASK-0029 saw `done` above an unmet
input with no explanation — a hole in the ADR-0012 invariant that a task be
startable cold from its own file. **Both task files now carry the waiver**;
the ADR statuses are untouched and stay S6's business.

**F1, F2 and F5 were re-verified read-only on 2026-09-15** before being
restated, per `PLAN-0003`'s own rule. All three hold: one inventory wired at
`ansible.cfg:8`; the `ansible_mounts` D-state hazard and its
"Tracked as unenforced" note verbatim; and `ansible_navigator` still
exposing no inventory, limit, `--check` or `--diff`. **The decay is real
and was measured**: `PLAN-0003` cites `tests/validate.sh` as 474 lines with
the loop check at `:193-213`; it is now 732 lines and `:196-213`. Four days.

**The sprint began from a human-supplied analysis rather than a backlog
item** — a first for this repo at the time — and **six of its claims were
corrected before planning finished**. In order of consequence:

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
  **Amended 2026-09-15 (TASK-0047, ADR-0020):** the third client is
  **classic LM Studio 0.4.24**, which is what that UI check actually
  exercised. The client this repo now targets is **Bionic 1.1.1+5**
  (**1.1.3+5 as of 2026-09-22, `TASK-0053`**), a
  separate app installed alongside it, and Bionic is **unverified** — it
  almost certainly shares `~/.lmstudio/mcp.json`, but that is an inference
  and the GUI check is an open human action.
- B-001…B-008 are all closed. The supposed `main`/`master` default-branch
  mismatch was **retracted as false** by TASK-0019 — it never existed.
- **`.ai/decisions/` filenames are now uniform** (`NNNN-short-title.md`,
  TASK-0024, closing B-008), matching the `project-workflow` convention
  this repo publishes. The *identifier* remains `ADR-NNNN` in every H1 and
  throughout prose — only filenames changed.
- ~~**B-001…B-009 are all closed; eight items are open**~~ — **this count was
  true when written and has decayed twice; `BACKLOG.md` is the owner, so do not
  restate a number here.** As of 2026-09-16: **B-001…B-013 are all closed** —
  S6's entire slice, the first fully-cleared sprint slice in this repo
  (B-010 by S7's pilot; B-011/B-012/B-013 by S6's own execution). B-015…B-017
  closed by S7. **Four remain open: B-018** (Bionic skills deployment, raised by
  TASK-0047), **B-019/B-020** (S8, re-queued) and **B-021** (raised by
  REVIEW-0008). B-014 closed 2026-09-15.
  **B-005's stated reason is retracted** by ADR-0020 — it closed on the
  false "no Agent Skills target" premise, though its *action* was correct.
  B-009 closed by
  TASK-0025/ADR-0013 as *decided, not implemented*: its premise — that the
  two skills share a convention — was false. Two of S6's four items (B-012,
  B-013) are corrections to **this repo's own claims** rather than to a
  component. **Two of S7's four (B-014, B-015) describe state _outside_ this
  repo** — a skill living in another repo plus a live machine config, and
  two vendors' file formats. That is a new class here, and it decays faster:
  both must be re-verified at the moment they are acted on.
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
- **A fourth skill exists on this machine but not in this repo, and it has
  an owner.** `agent-tiers` (`1.0.0`) is installed at
  `~/.config/opencode/skills/agent-tiers/` as a **real directory**, **owned
  by `opencode-customization` by an explicit 2026-09-13 decision to keep
  it** (TASK-0034), drifted from its source by two files (repo copy newer,
  no unique fix on the installed side), and with its topology never applied
  (no `agent` key in the live config). **It is not "deployed but unowned"** —
  that earlier characterisation was wrong. **ADR-0017 is rejected
  (2026-09-15), so it stays there permanently** unless one of that ADR's
  three reopen conditions is met. Its drift and its unapplied topology are
  **that repo's business, not this one's** — do not "fix" either from here.
- **`agents/` is now a real, fully-plumbed category** (TASK-0037…0040):
  schema, template, gate checks, registry section and per-client emission.
  It holds **no role yet**. `prompts/` remains an empty declared category
  (127-byte README), deliberately left alone — it needs its own
  justification rather than symmetry (B-016).

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
- ansible MCP connects, 10 tools. **The count is unchanged and deliberately
  so** (`TASK-0026`, 2026-09-16): `ansible_navigator` is now **disabled by
  default** in all three wiring snippets, but this repo cannot switch off an
  upstream tool — the server still *exposes* ten. **A tool count is not a
  posture.** The destructive-tool *grant* is now four, not five. `TASK-0028`
  confirmed on the same date that `ansible_navigator` is still reachable in a
  live session, which is what the snippets now warn against rather than
  prevent.
  proxmox still lacks `numpy` for its router; obsidian's desktop app still
  isn't running.
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
   **Now four for fourteen** (B-001 superseded, B-002 split, B-009 false
   premise, **B-014 false premise**): a backlog item's *title* encodes an
   assumption, and roughly a third of them do not survive contact with the
   files. B-009 was the sharpest case — written one task earlier, by this
   agent, from a single grep hit, proposing to change the scaffold that
   produced the very structure the repo runs. **B-014 is now sharper
   still**: its title asserted `agent-tiers` was *unowned*, an entire sprint
   phase was ordered around reclaiming it, and the premise was false the
   whole time because it rested on a **four-day-old quotation of another
   repo's roadmap**. **Read the artifacts before estimating the work — and
   when the artifact is in another repo, re-read it rather than the
   quotation.**
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
   **Recurred again, worse:** the roadmap had **no Phase 6 section at all**
   while S6 was planned, opened, committed and pushed — found by TASK-0033
   one sprint later. The same session also found the S6 planning session had
   left no `SESSION-*.md` record. No mechanism was added after REVIEW-0007
   said one was needed, so the class recurred twice in two sprints. **Still
   nothing prevents a third.**
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

   **Third instance, and it was in a fixture set rather than a check
   (TASK-0052, 2026-09-16).** TASK-0031 — the task written *specifically* to
   avoid this failure, whose brief quotes this lesson and makes five observed
   fixture results acceptance criteria rather than steps — specified five
   fixtures that were **all satisfiable by a guard which classifies nothing
   at all**, because every one of them assumed targets are named by group
   while the estate's real playbook names a bare host. **Fixtures-first does
   not help when every fixture shares the design's wrong assumption.** The
   new refinement: a fixture set needs at least one case drawn from the
   *real* subject rather than from the design's model of it. And note where
   the guard was validated from — `ansible.cfg`'s prose, which was accurate
   about the hazard and silent about the subject.
9. **A decision that handles one item from a list of two, without saying why
   the second was left, produces an orphan rather than a deferral.**
   ADR-0004 quoted the other repo's roadmap naming **both**
   `project-workflow` and `agent-tiers`, handed over the first, and said
   nothing about the second. A deferral has a reopen trigger — ADR-0010 has
   one, and it is explicitly *not* pulled. **When a decision narrows a list,
   record what happened to the remainder.**

   **The lesson stands; its worked example was wrong, and the correction is
   more instructive than the original.** S7 read ADR-0004's silence as an
   orphan and planned a reclamation around it. TASK-0034 found the *other*
   repo had closed the gap itself four days later (commit `9bae137`,
   2026-09-13): a stated reason, a scope banner, and a written reopen
   trigger — a textbook deferral. **The orphan existed only in this repo's
   copy of the story.** So the real failure was not ADR-0004's omission but
   **acting on a four-day-old quotation of an external document without
   re-reading the source** — lesson 7, in the class this file already calls
   fastest-decaying. Two lessons pointed at the same facts and the wrong one
   was applied, because the orphan reading was the one this repo had a name
   for.
10. **An unexercised artifact is the repo's most reliable failure mode.**
    `mcp-servers/_template/` (ADR-0010) established it, `agent-tiers`
    continued it — installed, drifted, never switched on (though **owned**;
    see lesson 9's correction) — and S7 is
    structured to avoid being the third instance, with a pilot that produces
    real components and a pre-committed review question. The pattern is
    common enough that a plan adding new component surface should now name,
    at plan time, **what will exercise it**.

## Validations
`tests/validate.sh` (mandatory, automatic via hook) · `scripts/sync-registry.sh`
· `tests/smoke-mcp.sh` (network-dependent, manual, PASS/FAIL/SKIP as three
distinct outcomes — a SKIP is not a pass) · CI on every push.

Validated in WSL (development). Deployment targets: local agent clients via
`scripts/install.sh`.
