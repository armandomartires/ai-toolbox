# REVIEW-0006 — Sprint S4, Closing the open loops

- Task(s) reviewed: TASK-0012, TASK-0013, TASK-0014, TASK-0015, TASK-0016
- Reviewer: opencode (agent self-review), scope decisions by the human
- Date: 2026-09-13

## Diff summary
Six commits, `615ff10..bd916bc`:

| Commit | Subject |
|--------|---------|
| 9151bb0 | Enforce skill frontmatter rules in validate.sh; open sprint S4 |
| 741f698 | Add MIT LICENSE backing the skills' license: MIT frontmatter |
| 05b6e59 | Warn in install.sh when the pre-commit hook mode is not executable |
| ea5372e | Document required environment variables and enforce the docs |
| d586ed0 | Mark the CI workflow verified after its first successful run |
| bd916bc | Add LM Studio UI verification procedure; record ADR-0010 |

New: `LICENSE`, `.env.example`, ADR-0008/0009/0010, five task briefs.
Changed: `tests/validate.sh` (two new check families), `scripts/install.sh`
(advisory hook-mode warning), `AGENTS.md`, `README.md`,
`docs/operations/runbook.md`, `docs/development/authoring-guide.md`,
`configs/lm-studio/README.md`, `.github/workflows/validate.yml`.

## Findings

**1. The sprint's premise was wrong in a useful way.** S4 was framed as
"close the pending items". Investigation showed only two of seven were
agent-completable; the rest needed a human decision or a GUI. Reporting
that up front, before writing any code, was the right move — "complete all
pending" was not literally achievable and saying so beat quietly doing the
subset and calling it done.

**2. Two items were never blocked — they were undocumented.** The git
remote sat in three consecutive candidate lists as though access were
missing. `GITHUB_URL`/`GITHUB_TOKEN` had been in the environment the whole
time; the token authenticated on the first probe. Nothing in the repo said
those variables were the interface. Similarly B-002 stalled for three
sprints not because it was hard but because its *title* bundled a specified
requirement with an unspecified one. **Before carrying an item forward
again, check whether it is blocked or merely unwritten.**

**3. One test harness proved nothing, and it was nearly missed.**
TASK-0014's first proof cloned the repo to isolate the test — which also
isolated it from the uncommitted change under test. All four cases reported
"no warning", which looked like a code defect. The harness was the defect.
Fixed by copying the working-tree script into the clone and asserting the
new warning string was present before testing. Generalizable: **a test that
clones for isolation may isolate itself from the change it verifies.**

**4. The tempting check was the wrong check, twice.** For env vars, the
obvious check is "is the variable set" — which would have failed on every
fresh clone and in the CI run this sprint proved works. For skills, the
obvious check was `grep -q '^name:'` — which had been in place and could not
detect a name disagreeing with its directory. Both replaced with checks that
can actually fail for the right reason: documentation completeness, and
parsed structure. This is the third sprint in a row where the recurring
lesson is *a check that cannot fail is worse than no check, because it is
still trusted*.

**5. CI was verified, not assumed.** The workflow had shipped labelled
UNVERIFIED because no remote existed. Run #1 passed all seven steps
including registry staleness, and only then was the label changed. Had it
failed, the finding would have been recorded — the label was contingent on
observation, which is why it was worth shipping the honest label first.

**6. An honest gap was preferred to a synthetic asset.** ADR-0010 declines
to author a Python MCP server purely to exercise that shape, citing this
repo's own `_template` registry leak — fixed three times because tooling
could not distinguish scaffolding from a real component. A synthetic server
would be that problem registered, deployed, and smoke-tested, verifying
mostly itself.

**7. No fabricated verification.** The LM Studio UI step was not performed
and is not claimed. `configs/lm-studio/README.md`'s "Not verified" caveat is
untouched; Phase 2's "partly met" wording stands.

**8. One finding in this very checkpoint was false — added retrospectively
2026-09-13 (TASK-0019).** Follow-up 3 asserted a default-branch mismatch that
did not exist. `main` was never created; `default_branch` has been `master`
since the first push.

The mechanism deserves attention, because finding 5 of this same review
congratulates the sprint for verifying CI rather than assuming it — and this
finding did the opposite in the same document:

- A field describing an *intention* (the creation response's
  `default_branch`, with `auto_init: false` and no refs yet) was read as one
  describing a *state*.
- The claim was restated three times with **increasing specificity and no
  new evidence**: "nominal default holding nothing" → "exists but is empty"
  → "a PR would target nothing".
- Labelling it "needs authorization" made it look deliberately deferred
  rather than unverified, which suppressed the re-check that would have
  caught it. Had authorization been given, the rename would have failed
  against a nonexistent ref.

No local check could have caught this: the claim was about external state,
and `validate.sh` is hermetic by design (ADR-0007, ADR-0009). The control is
procedural — **verify a claim about external state when recording it, and
again before acting on it.** Sprint S4's own lesson about checks that cannot
fail has an analogue for claims that were never tested.

## Validation results
- `tests/validate.sh`: OK. 0.366 s, offline, hermetic — passes with the
  entire environment unset. Two new check families added without breaking
  either property.
- Fails-when-reverted, TASK-0012: 10 fixtures, one rule each — name
  mismatch, multi-line description, non-semver version, missing name,
  missing description, absent frontmatter, unterminated frontmatter, empty
  license (8 must-fail, each producing its specific message), plus valid
  frontmatter and fully-quoted values (2 must-pass). Fixture removal
  confirmed by directory listing.
- Fails-when-reverted, TASK-0015: 4 cases — required var removed from
  template, var present only in a comment (still fails), template deleted,
  restored (passes, byte-identical per `diff -q`).
- Fails-when-reverted, TASK-0014: 4-way matrix of recorded hook mode ×
  `core.filemode`, in a throwaway clone. Warning only on the wrong mode; the
  `chmod`-won't-help note only when `core.filemode=false`; exit 0
  throughout; clone's index unmutated.
- `scripts/sync-registry.sh`: no diff at any point — correct, as no
  component changed this sprint.
- `scripts/install.sh`: deploys 4 skills across 2 clients, no spurious
  warning (real hook correctly 100755).
- CI: run #1 on ea5372e, **success**, 7/7 steps.
- Secrets: pre-flight grep for `ghp_`, `github_pat_`, `glpat-`, `AKIA`, PEM
  headers and internal hostnames — clean. Post-push: `git remote -v`
  token-free, no `credential.helper` persisted, no token in `.git/config`.

## Verdict
**Approve.** All five exit criteria met. Both closeable backlog items closed
(B-002, B-004); the two human-only items converted to a procedure and a
decision; the remote wired and CI verified.

## Follow-up tasks
1. **B-001 (subagent-run registry validation)** is now unblocked — its
   "CI exists" condition is met — but remains unscoped and low priority. CI
   already performs the registry-staleness check, so B-001's marginal value
   should be re-examined before briefing it. It may be closeable as
   redundant rather than implementable.
2. **LM Studio UI verification** — human action, procedure at
   `docs/operations/runbook.md`. Closing it would let Phase 2's second exit
   criterion move from *partly met* to met.
3. ~~**Default-branch mismatch.** GitHub created the repo with
   `default_branch: main`; this repo uses `master`. `main` exists but is
   empty, so a PR opened against the default base would target nothing.
   Worth aligning, but renaming a default branch needs explicit
   authorization.~~

   **RETRACTED 2026-09-13 (TASK-0019). This finding was false.** There is no
   mismatch and never was: `default_branch` is `master`, and `main` does not
   exist (`heads/main` → 404). The claim came from reading the repo-creation
   response's `default_branch` — which, with `auto_init: false`, reports the
   account's default *name preference* rather than an existing ref.

   Retained rather than deleted, because the failure mode is more
   instructive than the finding was. It is recorded as a review finding in
   its own right below.
4. **Authored Python MCP shape** — deferred by ADR-0010 with a trigger. Not
   a candidate; do not re-add it to a candidate list.
5. `skills/*.zip` remain untracked pre-existing artifacts, still out of
   scope, still deliberately untouched.
