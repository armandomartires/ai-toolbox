# Backlog

| ID | Title | Priority | Value | Dependencies | Risk | Status | Ready when |
|----|-------|----------|-------|--------------|------|--------|-----------|
| B-001 | Subagent-run registry validation | low | medium | Phase 3 | low | **done** | TASK-0018 — closed as **superseded**, not implemented (ADR-0011); scoping it found two real registry defects, both fixed |
| B-002 | Skill Linter (frontmatter ~~+ line budget~~) | medium | high | Phase 1 | low | **done** | TASK-0012 — frontmatter only; line budget dropped per ADR-0008 |
| B-003 | MCP server smoke test harness | medium | high | Phase 1 | medium | **done** | TASK-0009 — `tests/smoke-mcp.sh` |
| B-004 | Repo LICENSE file (backs skill `license:` claims) | low | medium | none | low | **done** | TASK-0013 — MIT chosen by human; ADR-0003's known gap closed |
| B-005 | Re-scope Phase 2 exit criterion (~~LM Studio has no Agent Skills target~~ — **premise false**) | high | medium | none | low | **done** | resolved by ADR-0006. **Reason retracted 2026-09-15 by ADR-0020**: the client is Bionic and its Agent Skills target existed all along (`~/.lmstudio/skills/`); the repo checked the `hub/skills/` cache. Stays closed because the *action* — re-scoping the criterion per capability — was right and is done. See B-018 |
| B-006 | ~~Port~~ **Author** a loop component | medium | medium | none | low | **done** | TASK-0008; verb corrected — nothing existed to port (ADR-0006) |
| B-007 | De-duplicate sync-registry.sh per-section loops (or assert no `_template*` row) | medium | medium | none | low | **done** | TASK-0011 — did both |
| B-008 | Unify `.ai/decisions/` file naming (`ADR-NNNN-*` vs `NNNN-*`) | low | low | none | low | **done** | TASK-0024 — 7 files renamed to `NNNN-*`; found `.ai/README.md` was prescribing the *old* scheme |
| B-009 | `project-migration` scaffolds `ADR-NNNN-*.md`, diverging from `project-workflow`'s `NNNN-*` | low | low | none | low | **done** | TASK-0025 — closed as **decided, not implemented** (ADR-0013). Its premise was false: the skills scaffold two different frameworks, not one spelled two ways |
| B-010 | No instruct layer for the `ansible` MCP server | high | high | none | medium | **done** | **Closed 2026-09-16.** Its two components — `skills/ansible-ops/` and `loops/ansible-change/` — were **delivered by S7's pilot (`TASK-0046`, 2026-09-15)** under an Option 2 waiver, so this item was resolved *by another sprint's route* while S6 was parked. Scoped by PLAN-0003 against a real Ansible repo before estimating; six claims in the source analysis were corrected first. **Closed with the limitation stated rather than hidden** (see `TASK-0032` / `CURRENT_STATE.md`): under Option (a) the skill was authored **from** the target estate and **never executed in it**, so it carries the same status as `mcp-servers/_template/` — *treat as unexercised scaffolding*. What *was* exercised is the pair of loops that produced it, which is a different claim; and `TASK-0031`'s guard is the one S6 deliverable validated against real playbook content. **The gap this item named is filled; whether it is filled *well* is not something a backlog row can assert**, and the checkpoint should judge it |
| B-011 | A documented, statically checkable, unenforced Ansible safety rule | high | high | B-010 (shares the skill's vocabulary) | medium | **done** | **Closed 2026-09-16 by TASK-0031** — S6's highest-value deliverable. `skills/ansible-ops/scripts/gather_subset_guard.py` is a custom `ansible-lint` rule (`gather-subset-mounts`) recognising **both** accepted forms, resolving a **bare hostname** to its hazard class through nested inventory `children:`, and failing loudly on an unresolvable target with a distinct message. **Both closure conditions added by TASK-0052 were met, not waived:** (a) **fixture 6 observed failing**, and beyond it the *real* playbook was flipped to `gather_facts: true` in a `/tmp` copy and the guard named `sigsrvpve1` resolved through the real inventory — so the silence on the unmodified playbook is discriminating rather than inert; (b) the **fires-proof ships** as `tests/gather-subset-guard.sh` (10 checks, PASS/FAIL/SKIP) **including a negative control that reproduces the `enable_list` silent-no-op trap**. Three defects were found and fixed during execution, two of them mine: `TASK-0027`'s "declarative wiring" recommendation is **wrong** (per-rule config in `.ansible-lint` is a fatal error for a custom rule, so `get_config()` is unreachable — config is by env var); fixture 4 could never reach the rule (`syntax-check` is unskippable and fails an undefined-variable target first); and my harness matched the rule **ID**, which appears in ansible-lint's own error text, so four fixtures read as "fired" when the rule had not run. **Closed with four stated limits**, all in the artifact rather than only in the log: it proves a keyword not a safe node; nothing in this repo runs it (ADR-0009); it can be installed and inert without `enable_list`; and it cannot see an undefined-variable target. Classes 2–6 of `references/hazards.md` remain unenforced — this item covered class 1 only |
| B-012 | `server.json` overstates `WORKSPACE_ROOT` as the blast radius | medium | medium | none | low | **done** | **Closed 2026-09-16 by TASK-0026.** False for `ansible_navigator` (remote infra) and `ade_setup_environment` (system packages). The manifest now carries a `workspace_root_bounds` key splitting `bounded` from `not_bounded` per tool. **The item's own scope was too small: it said "restated in all 3 wiring snippets", making four locations. There were six** — the fifth was `docs/operations/runbook.md:185`, telling an operator wiring up a live client that this *was* the blast radius, and the sixth was a *lessons* list in `configs/lm-studio-bionic/README.md:253`. Both were found by grepping for the phrase rather than by trusting the count. A final grep returns nothing outside `.ai/`. **Lesson 6's shape again — an item's own statement of a defect can under-count it** |
| B-013 | `ansible_navigator` cannot express the safe workflow but can execute unsafely | high | high | none | low | **done** | **Closed 2026-09-16 by TASK-0026.** No inventory/limit/`--check`/`--diff` parameter exists (re-verified); disabled by default in all three wiring snippets with the reason, plus a `disabled_tools` key in the manifest. Human authorization 2026-09-14, **re-confirmed 2026-09-16** before the edit; `authorization.history` now shows the original five-tool grant *and* the narrowing, so the record reads as a human reducing scope rather than being quietly adjusted. **Closed with a stated limit: the disablement is ADVISORY.** This repo cannot switch off an upstream tool — every documented command still starts a server exposing all ten, and a user can re-enable it. What closed is the *default* exposure and the false description; `TASK-0028` separately found a real per-client enforcement route (OpenCode `tool.execute.before`) that `ADR-0016` **declined** as non-portable |
| B-014 | ~~`agent-tiers` is unowned~~ — **premise false**; it is drifted and has never been switched on, but it **has an owner** | high | medium | none | medium | **CLOSED 2026-09-15 — decided, not implemented** | Closed by ADR-0017's **rejection** (human decision): `agent-tiers` stays with `opencode-customization`. The *item's premise* was the defect; the roles it wanted are authored fresh by TASK-0045 instead. S7 / TASK-0034 **done**. The "unowned" premise is **retracted**: `opencode-customization` kept it deliberately (commit `9bae137`, 2026-09-13, explicit user decision, stated reason, **unpulled reopen trigger**). This repo read ADR-0004's four-day-old quotation of that repo's *older* roadmap and never re-read the source after `S027` ran. Drift is fully characterised and benign: repo copy newer for **both** files from one commit, **no unique fix** on the installed side, all 4 model IDs still resolve. ADR-0017 is **blocked, not ready**; option 3 (take the four roles into `agents/`, leave the installer) recommended in TASK-0034's log |
| B-015 | Agent definitions are not portable between clients, and no decision records it | high | high | none | medium | **done** | Closed 2026-09-16 by REVIEW-0008. S7 / TASK-0036 + **ADR-0018 accepted** — per-capability portability, one source with per-client emission, and clause 8 (the emitter **refuses**, never degrades). The decision the item asked for exists, and `scripts/emit-agents.py` executes it. Its "must be decided **before** any role is authored" condition was **met**: ADR-0018 landed before TASK-0043. Had read **ready** until closure, three tasks after being delivered |
| B-016 | `agents/` and `prompts/` are declared component categories with nothing behind them | medium | medium | B-015 (the schema depends on the portability decision) | low | **done — for `agents/` only** | Closed 2026-09-16 by REVIEW-0008. S7 / TASK-0037…0040 delivered every one of the five absences this item named: template (`agents/_template/`), normative schema (`authoring-guide.md`), `validate.sh` checks (17, each observed failing), a generated registry section, and an `install.sh` emission path. Six real roles now ship through it. **`prompts/` is untouched and still a 127-byte README** — deliberately out of S7's scope, and it needs its own justification rather than momentum (REVIEW-0008 follow-up 6). Re-raise for `prompts/` if that justification ever arrives; do not reopen this item |
| B-017 | No design stage exists — `plan` writes specs but never ideates or critiques | high | high | B-014 (closed — roles now authored by TASK-0045), B-016 (roles need enforcement) | medium | **done** | Closed 2026-09-16 by REVIEW-0008. S7 / ADR-0019 + TASK-0041…0043 — the gap named here is filled by `loops/design-brief/` (7 steps, cap 3), `skills/design-flow/` (the method: distinctness as a load-bearing commitment, 8 named critique obligations) and three roles. All three absences answered: alternatives **are** generated (`ideator`), adversarial review **exists** (`critic`, proved read-only at runtime in both clients), and the missing **convergence criterion** is now human acceptance plus a lock commit (ADR-0019). **Exercised, not just built** — the pilot converged in one iteration on 35 findings |
| B-018 | Deploy skills to Bionic — its Agent Skills target exists and is unused | medium | medium | none | medium | **ready** | TASK-0047 / ADR-0020 corrected the premise: the target is `~/.lmstudio/skills/` (global) and `<project>/.agents/skills/` (project), **not** the `hub/skills/` cache the repo checked for two sprints. Needs a design decision, not just code: global installs are approval-gated (`skill-management/SKILL.md:31` — "DO NOT edit global skills directly", routed through a user-prompting `skill.install` tool), which `install.sh` cannot drive non-interactively. Project skills *are* plain writable files. So the real question is whether a per-project target belongs in a global installer at all, or whether Bionic needs a separate path. Frontmatter is already compatible (Bionic ignores unknown keys) |
| B-019 | Three requested third-party "plugins" have no home, and "plugin" is not one capability | medium | medium | none | low | **ready** | S8 / `ADR-0021`, TASK-0048…0051. Raised from a human request (2026-09-16), not from inspection. The item's own title carries the defect: **"plugin" names three unrelated mechanisms** — ponytail is an npm entry in OpenCode but a *marketplace install plus two Node lifecycle hooks* in Claude Code; omniroute is a provider plugin in OpenCode but *a base URL* in Claude Code; graphify is a plugin in neither sense, being a CLI that generates each platform's integration. So there is no portable capability to abstract, and ADR-0016's declined-category reasoning applies (its three plumbing findings **re-verified 2026-09-16**). Resolution is per-category placement, not a `plugins/` directory: graphify → `mcp-servers/` external shape, ponytail → `configs/*/README.md`, omniroute → out of the component layer by human decision. **Not ready-when-convenient**: TASK-0048 must run first, because everything currently known is vendor documentation and two of those documents already contradict their own source |
| B-020 | `tests/smoke-mcp.sh` reports FAIL where the truth is an unmet precondition | medium | medium | B-019 (found while scoping it) | low | **done** | **Closed 2026-09-23 by TASK-0049**, reproduced live before being fixed — the harness did report `FAIL … no stdout (exit 1)` for a server that was never attempted. Fixed as an optional **manifest-declared** `smoke_test.requires_paths`: a missing path yields SKIP with its reason, and graphify is **not named in the harness**, so the rule covers any future stateful server, which is how the item was scoped. Human-authorized, per PLAN-0005 item 4. One correction to the item's own framing below: the precondition is `.graphify/graph.json`, **not** `.graphify/` — the state directory alone still exits 1, so the fix this item described would have left the same false FAIL in a narrower window. Its resolution also uncovered **B-022**. Original scoping: S8 / TASK-0049. Found by reading `@sentropic/graphify`'s source, not by running anything: `src/serve.ts:188-195` has `createReloadingGraphStore` call `validateGraphFilePath`, then `console.error` + `process.exit(1)`, and `:896-897` defaults the graph path to `resolveGraphInputPath()`. So `graphify serve` with no `.graphify/graph.json` exits 1 without ever speaking MCP, and the smoke test — which launches from `launch.command` and asserts on an `initialize` reply — would call that a **FAIL**. Its own header insists three outcomes exist and that *"a SKIP is not a pass"*; this is **the mirror defect, a check lying in the other direction**, and it is latent for any future server with a state precondition, not only graphify. Fixing it edits a shared validated test file, so a human authorizes it (`PLAN-0005`, item 4). Either outcome is acceptable — precondition-aware SKIP, or a **visible** exclusion — but never a silent false FAIL |
| B-022 | `tests/smoke-mcp.sh` tested whether a server **exits**, not whether it **speaks** | high | high | none | low | **done** | **Raised and closed 2026-09-23 by TASK-0049**, recorded here rather than only in that task's log because *that* is how a defect gets rediscovered instead of fixed (B-021's lesson). The harness used `subprocess.run(input=…, timeout=…)`, which waits for process **termination**. A conforming MCP server keeps serving after answering `initialize`, so the harness reported `FAIL … no reply within 90s (server hung or never spoke)` **while holding the correct reply it had already received** — a message asserting the opposite of what occurred, in the file whose header is most careful about exactly that. `ansible` passed only because its server happens to exit on stdin EOF, so the suite looked healthy and the defect was invisible. **It was found only because TASK-0049 insisted on proving its own SKIP was a precondition gate rather than an exemption** — the check that was not strictly required is the one that found it. Fixed under a second explicit human authorization: stdin stays open, one reply is read with a deadline on a reader thread, the server is then terminated, and the no-reply branch is split so exited-without-speaking and alive-but-silent no longer share one sentence that fits neither. Both servers observed PASS afterwards |
| B-023 | graphify has a manifest and a registry row but no `configs/*/README.md` wiring section | low | medium | none | low | **ready** | Raised 2026-09-23 by TASK-0051, from a **seam between two briefs rather than an oversight by either**: TASK-0049 excluded graphify's client-native surface as belonging to TASK-0050's category, and TASK-0050's scope excluded graphify. Neither brief owned it, and the gap is only visible once both are done. `ansible` has a wiring section in all three clients; graphify has none, so `configs/` and `docs/registry.md` now disagree about how many MCP servers a reader is expected to wire. **Lower priority than ansible's was, on a real difference**: graphify declares no required environment variables and no destructive tools, so `scripts/install.sh`'s generic manifest output (launch command, transport, preconditions) is genuinely most of what a wiring section would say — the ansible sections exist largely to carry a `WORKSPACE_ROOT` warning and a disabled-tool instruction that have no counterpart here. Ready when someone decides whether every `mcp-servers/` entry owes three client sections **as a rule**, or only those with env vars, destructive tools or a non-obvious launch. That rule does not exist yet, and writing three sections before deciding it would set the precedent by accident. Note it also touches `ADR-0021`'s non-exclusivity: graphify's *OpenCode-native* surface (`graphify opencode install`) is a separate question from its MCP wiring, and the two should not be conflated in one section |
| B-021 | `qa-test` cannot run tests — the role's own description says it does | high | high | none | low | **ready** | Raised 2026-09-16 by REVIEW-0008, from the S7 pilot's most actionable finding. `agents/qa-test/agent.md:13-16` declares `bash_allow: git status*, git diff*, git log*`, which emits `bash: {"*": deny, …}` — so it cannot run `pytest`, `npm test` or `tests/validate.sh`, while `docs/registry.md` advertises it as *"Writes and **runs** tests … reports pass/fail evidence"*. **The role makes a false claim about itself**, which is precisely the class TASK-0046 diagnosed. The pilot observed the boundary working correctly (it refused to claim unobserved passes) — the defect is the **vocabulary**, not the role's behaviour. Needs a *decision*, not a widened allowlist: a test-command allowlist term, scoped per client under ADR-0018, in definition→enforcement→emission order (ADR-0008), as `delegation-allowlist` and `bash_allow` both were. **Do not resolve it by adding `bash: allow`** — that hands a test runner arbitrary shell and dissolves the boundary the role exists to have. Until it is fixed, the description overstates the role and should be read as aspirational |

**Four items are open — B-018, B-019 (S8, in progress), B-021** (raised
2026-09-16 by REVIEW-0008) **and B-023** (raised 2026-09-23 by TASK-0051).
B-023 is the first item raised from a **seam between two briefs** — work
each explicitly assigned to the other, visible only once both had run.
**B-020 closed 2026-09-23 by TASK-0049**, and
closing it raised and closed **B-022** in the same task — the first item in
this table to be both raised and resolved by the work that found it, and the
first found by *verifying a fix* rather than by inspection, a source read or
a human request. **ALL FOUR S6 items are now closed**,
which is the first time this repo has cleared a sprint's entire backlog slice:
B-012 and B-013 by `TASK-0026`, **B-011 — the highest-value item in either
sprint — by `TASK-0031`**, and **B-010 by S7's pilot** (delivered while S6 was
parked, so by another sprint's route).

Three things worth keeping visible about that:
- B-012 and B-013 were corrections to **this repo's own claims** rather than to
  a component, and **B-012's own scope under-counted its defect by two
  locations** — it said four, there were six.
- **B-011 was closed on a raised bar, not the original one.** `TASK-0052` found
  its five planned fixtures were all satisfiable by a guard that resolves no
  hostnames, so closure required fixture 6 observed *failing* plus a
  fires-proof. Both were delivered.
- **B-010 is closed with its limitation stated**: the components exist and were
  never executed in the estate they were authored from. A closed item is not a
  claim of quality, and the checkpoint should judge that separately.
B-015…B-017 closed 2026-09-16** as **delivered by S7** — the portability
decision (ADR-0018), the `agents/` category for `agents/` only, and the
design stage. **B-014 closed 2026-09-15** as *decided, not implemented*:
ADR-0017 rejected, so `agent-tiers` stays with `opencode-customization`.
That makes **two** items closed on a false premise (B-009 and now B-014) out
of twenty-one — see the lesson-2 note in `CURRENT_STATE.md`.

**All three S7 items had read `ready` since being delivered**, B-016's entry
still asserting in the present tense that `agents/` had "no template, no
schema, no `validate.sh` check, no registry section, no `install.sh` path"
when all five had shipped. Caught by REVIEW-0008, not by any check — this
file's status column has no owner but whoever last read it. Counted as a
sixth instance of the drift class named below, and the closing note kept
because it is the same lesson: **the status column decays silently, so a
sprint's closure must sweep it.**

This count was rewritten rather than annotated. The first draft of the S8
entries left the old "Eight items are open" paragraph standing underneath a
new "Ten items" line, which would have made this file state its own total
twice with different numbers — the drift class `CURRENT_STATE.md` records
five instances of, appearing here in the act of documenting it. Correct the
count in place; never stack a correction on top of a stale claim.

**B-019 is the first item raised from a direct human request** rather than
from a plan, an inspection or a review. Its shape is worth noting: the
request named three things with one word, and **the word was the
assumption that did not survive** — which is B-009's lesson (an item's
title encodes an assumption) arriving through a new door. **B-020 is the
second consecutive item found by reading a third party's source rather than
its documentation**, and it describes a defect in *this* repo's test
harness, not in the third party.

B-014…B-017 were raised by `PLAN-0004`, and **all four are now closed** —
B-014 on a false premise, B-015…B-017 as delivered by S7. **B-001…B-009
remain closed.**

**B-021 is the first item raised by a review checkpoint** rather than by a
plan, an inspection or a human request. Worth noting *why* it needed raising:
the defect was found by the S7 pilot and written up accurately in three
narrative files, and none of that put it anywhere a future sprint would look.
**A defect recorded only in a task log is a defect that will be rediscovered
rather than fixed** — which is what this table is for.

**B-018 was raised by TASK-0047, and B-005 is the item it embarrasses.**
B-005 ("LM Studio has no Agent Skills target") was closed as *resolved by
ADR-0006* — and its premise was false. The target existed the whole time;
the repo checked a cache directory and generalised. B-005 stays closed
because its *action* (re-scope the Phase 2 exit criterion) was correct and
is done, but its stated reason is retracted by ADR-0020. That is now
**three** of twenty items touching a false premise (four, counting B-019 —
whose premise was the *word* "plugin" rather than a claim about a file), and
the only one where
the falsehood propagated into two ADRs and four tasks before a human caught
it by noticing a product name.

**B-010…B-013 stayed `ready` through S6's park, and all four are now closed**
(S6 un-parked 2026-09-16 by `TASK-0052`; **S8 is re-queued**). Neither a park
nor a re-queue un-scopes a backlog item: while parked, the items described real
gaps that were still real, and their "Ready when" column kept naming S6's task
numbers because those remained the plan of record.

**B-011, B-012 and B-013 were closed by S6's own execution** (`TASK-0031` and
`TASK-0026`, 2026-09-16); **B-010 by S7's pilot**, which delivered its two
components while S6 was parked. So the slice was cleared by two different
routes, and only B-010's route is the kind a checkpoint should question.

**B-011's closure condition was met rather than waived, and that is the point
worth carrying forward.** `TASK-0052` found that TASK-0031's original five
fixtures were **all satisfiable by a guard that resolves no hostnames at
all**, because the estate's one PVE playbook targets `sigsrvpve1` by bare
hostname rather than by group. So the bar was raised: closure required
**fixture 6** (bare hostname, `gather_facts: true`) **observed failing**. It
was — and beyond it, the *real* playbook was flipped to `gather_facts: true`
in a `/tmp` copy and the guard named `sigsrvpve1`, resolved through the real
nested inventory. **That is what makes its silence on the unmodified playbook
evidence rather than inertia.** A green fixture run would not have shown it.

**B-019 and B-020 stay `ready` through S8's re-queue**, by the same rule.
B-020 in particular is latent for **any** future stateful MCP server, so it
outlives S8's scheduling regardless.

B-014…B-017 were written after reading the artifacts, not before. Two of
them are corrections to state **outside this repo**: B-014 describes a
skill living in another repo and a live machine config, and B-015 describes
two vendors' file formats. That is a new class here — every prior item was
about this repo's own files — and it decays faster, because vendors ship
and machines change without this repo noticing. Both items must be
re-verified at the moment they are acted on rather than trusted from
`PLAN-0004`.

All four were written **after** the artifacts were read, which is the
practice the note below ("read the artifacts before estimating the work")
asks for. The source analysis that prompted them proposed a
staging-promotion workflow the target estate cannot implement at all; that
correction happened at plan time rather than becoming a fourth item closed
on a false premise.

Two are corrections to **this repo's own claims** (B-012, B-013), not to a
component. Worth noting because the governance layer polices components
and nothing polices the governance layer — the standing lesson 6 — and
these two are that pattern reappearing in `mcp-servers/` and `configs/`.
**Both closed 2026-09-16, and closing them proved the point twice over:**
B-012's own description said the false claim sat in four places, and it sat in
**six** — the extras being an operations runbook and a *lessons* list, i.e.
the two most quotable places to be wrong. Nothing in `validate.sh` could see
any of it; it was found by grepping for the sentence.

Three of the nine were closed by **scoping rather than building**: B-001
(superseded, ADR-0011), B-002 (split, ADR-0008), B-009 (false premise,
ADR-0013). In each case the item's *title* encoded an assumption that did
not survive contact with the files. That is now the expected outcome for
any item written before it was scoped — read the artifacts before
estimating the work.

Notes:
- B-001 was scaffold boilerplate from the initial commit (`e72b78c`), never
  scoped or justified by an observed failure. By the time its `CI exists`
  condition was met, its *mechanism* had been overtaken: registry validation
  is deterministic and hermetic in `validate.sh`, run by the pre-commit hook
  and CI. A subagent would have been slower, nondeterministic, and unable to
  gate a commit — a weaker check presented as done. Closed as superseded
  (ADR-0011). **Two real defects came out of scoping it anyway**, which is
  the argument for scoping an item before either building or dropping it.
- Read alongside B-002: both sat for sprints as boilerplate. One turned out
  to contain a real requirement once split from an unspecified one; the other
  did not. **An item's age is not an argument for implementing it.**
- B-002's title was the defect, like B-006's verb before it. It bundled a
  fully-specified requirement (frontmatter rules, written down in
  `docs/development/authoring-guide.md` and unenforced) with an entirely
  unspecified one (a "line budget" defined nowhere in the repo). That
  mismatch is why it sat `ready` for three sprints: it could not be
  scoped as written. Split, the first half took one commit. See ADR-0008.
- B-004 was a *known* gap, not a discovered one — ADR-0003 recorded at the
  time that `license: MIT` was unbacked, and it stayed that way for three
  sprints. Recording a gap honestly is necessary but not sufficient; it
  also has to get closed.
- B-003 closed by TASK-0009. Its seed was TASK-0006's by-hand `initialize`
  handshake; that incantation is now `tests/smoke-mcp.sh`, driven entirely
  from each `server.json` manifest. Kept out of `tests/validate.sh` on
  purpose so the mandatory gate stays offline and fast.
- B-007 comes from REVIEW-0004: the template-leak defect was fixed three
  separate times (MCP loop, skills loop, loops loop) because
  `sync-registry.sh` duplicates its iteration logic per section, so a rule
  added to one does not reach the others. The pattern is the finding, not
  any one fix. `tests/smoke-mcp.sh` skips templates from the outset.
- B-005 and B-006 came from REVIEW-0003's follow-ups; both closed by
  ADR-0006 and TASK-0008. B-006 is kept visible rather than deleted
  because its *verb* was the defect: it said "port", and a search found no
  first-party loop artifact existed anywhere to port. Recording the
  correction is the point.
- **B-004's row had fallen outside the table**, stranded below these notes
  since TASK-0013 appended it instead of inserting it. Moved back into the
  table by S5's planning session. Worth recording because of what it says
  about the registry-integrity work: `validate.sh` checks the *generated*
  `docs/registry.md` for column-count and pipe defects (TASK-0018), and
  nothing checks the hand-maintained tables in `.ai/`. The defect class
  this repo already fixed downstream was live upstream the whole time.
- B-008 is a naming inconsistency in `.ai/decisions/`: ADR-0001 through
  ADR-0007 use an `ADR-` prefix, ADR-0008 through ADR-0012 do not. Both
  resolve for a human reader, so nothing is broken — but any future
  tooling that globs decisions has to know both forms, and the split
  point is arbitrary rather than meaningful. Low value, genuinely
  unblocked, and explicitly **out of scope for S5** (see
  `SPRINT-CURRENT.md`): it was found while reading for PLAN-0002 and has
  nothing to do with handover. Fixing it mid-sprint would bundle an
  unrelated rename into a contract change.

  **Closed by TASK-0024.** It was never a matter of taste: the
  `project-workflow` skill, which this repo owns and is canonical for
  (ADR-0004), prescribes `decisions/NNNN-short-title.md`. The `0008`–`0012`
  files followed it; `ADR-0001`–`ADR-0007` predated it and were never
  migrated. **The item as written understated the problem** — it described
  a cosmetic split, but `.ai/README.md:4` was actively prescribing the
  *old* scheme, so the normative doc contradicted the convention this repo
  publishes to other projects. A grep for broken paths does not find a doc
  that is wrong; only reading it does.
- B-009 came out of closing B-008. `project-migration`'s scaffold script
  emits `.ai/decisions/ADR-0001-repo-structure.md` and documents
  `ADR-NNNN-*.md`, so every project it scaffolds starts on the scheme this
  repo just migrated away from. **Deliberately not fixed in TASK-0024**:
  `project-migration` is an independent skill that never claims alignment
  with `project-workflow`, so "make them agree" is a decision about
  whether the two skills share one convention — not a rename. It needs
  that decision (an ADR) before it needs code.

  **Closed by TASK-0025 / ADR-0013 as decided, not implemented.** The
  investigation found there is *no shared convention to diverge from*:
  the two skills scaffold two different frameworks, differing in nine
  ways, of which the ADR filename is the smallest. `project-workflow`
  uses `00.CONVENTIONS.md`/`20.PLAN.md`/`30.ROADMAP.md`/`reference/` with
  `S###.T###` tasks; `project-migration` uses
  `context/`/`planning/`/`sessions/`/`templates/` with `TASK-####`. **This
  repo runs the latter** (ADR-0001, and `.ai-layout.json` declaring
  `entrypoint: AGENTS.md` rather than `00.CONVENTIONS.md`).

  So the literal fix would have aligned 1 of 9 differences and produced a
  scaffold belonging to *neither* framework — worse than a clean
  divergence, since it destroys the signal that these are separate
  systems while fixing nothing. Resolved with one documentation line in
  each `SKILL.md` naming the other skill, so the item cannot be re-raised
  by the next person who greps for `ADR-`.
- B-014 was raised as **ADR-0004's unfinished half**. That ADR's own Context
  quotes `opencode-customization`'s roadmap: *"`S027` hands
  `project-workflow` (and `agent-tiers`) to `ai-toolbox` permanently."* The
  parenthesis was in the source text, and ADR-0004 executed the handover for
  `project-workflow` alone.

  **TASK-0034 (2026-09-15) found the conclusion drawn from that is wrong.**
  `agent-tiers` has *not* been unowned: the quoted roadmap was **superseded
  four days after ADR-0004**, when `S027` actually executed and that repo
  recorded an explicit user decision to **keep** the skill (commit
  `9bae137`) with a stated reason (*"confirmed OpenCode-specific by
  design"*) and a written, unpulled reopen trigger. This repo acted on its
  own four-day-old quotation of an external document without re-reading the
  source — **lesson 7, not lesson 9.** The item is retained rather than
  deleted because the error pattern is the valuable part.

  Three consequences, all now observable: two files differ between the
  installed copy and its source while both declare `metadata.version:
  "1.0.0"` (**exactly** the version-integrity defect ADR-0004 was written
  to kill, on a second skill); the installed copy is a **real directory**
  while this repo's two skills are symlinks, so `install.sh:100-103` would
  announce a `NOTICE` and delete it; and the live global `opencode.jsonc`
  has **no `agent` key**, so the permission boundaries that are the whole
  point of the skill have never been in effect.

  The lesson is narrower than "finish what you start": **a decision that
  handles one item from a list of two, without saying why the second was
  left, produces an orphan rather than a deferral.** A deferral has a
  reopen trigger (ADR-0010 has one). This had nothing.
- B-015 is the first item here whose subject is **two external file
  formats**. It exists because the proposed architecture assumed one
  markdown role file serves every client, and the vendors' current docs say
  otherwise in six separate respects — including that OpenCode takes agent
  identity from the *filename* while Claude Code requires a `name` field,
  and that OpenCode has an explicit `mode: primary|subagent` with no Claude
  Code equivalent.

  Read alongside B-005, which is the same shape one capability earlier: a
  criterion assuming cross-client uniformity, found unsatisfiable once
  tested, resolved by ADR-0006 scoping portability **per capability**.
  B-015 is that resolution's third application (skills → 2 clients, MCP →
  3, agents → ?). **The pattern is now established enough to check for
  proactively**: any new component category should have its portability
  scoped before its first instance is authored, not after.
- B-016 was raised by ADR-0016 before it had an ID. That ADR argued against
  a `hooks/` category and cited this exact situation as its evidence:
  *"`prompts/` and `agents/` are declared component categories with 3-line
  stub READMEs and zero tooling. A declared category can exist
  indefinitely with nothing behind it."* It used the observation to decline
  new work and, reasonably, did not also fix it.

  Deliberately scoped to **`agents/` only**. `prompts/` stays a 127-byte
  README: this sprint has a concrete need for agent roles and none for
  prompt fragments, and extending the work to a second category on the
  strength of symmetry alone is how a sprint acquires an item nobody asked
  for. If `prompts/` is ever built out it needs its own justification.
- B-017 is the only one of the four that is a **genuine capability gap**
  rather than a defect, a drift, or an orphan. The other three are cleanup
  the sprint has to do before it can safely build this one.

  `bmad-workflow.md:14-16` has `plan` write a story or spec artifact
  directly: *"No code is written in this phase."* One pass, one artifact.
  Nothing generates alternatives, nothing critiques them, and — the part
  that matters most — **nothing defines when the design is finished.**
  Without a convergence criterion an "iterate until happy" loop either runs
  forever or stops arbitrarily, which is precisely why `loops/`' mandatory
  `## Exit conditions` section is the right home for it and why ADR-0019
  must settle that the criterion is **explicit human acceptance** rather
  than a model's self-assessment.
