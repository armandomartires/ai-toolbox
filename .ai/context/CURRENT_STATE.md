# Current State

## The backlog is being closed out (2026-10-05)

**On the human's routing** (*"closing all backlog tasks and TASK-0129"*),
with each decision item settled by the human at the start of the session.
One task per row:

- **`B-049` (`TASK-0135`).** `scripts/worktree.sh remove` deletes a landed
  branch once its tip is on `master` or `origin/master`. When it keeps one,
  it says so and exits 1, where it used to claim the deletion.
  `tests/test-worktree.sh` is in the gate.
- **`B-045` (`TASK-0136`).** The unattended-run resume guard,
  `git log --grep <task id>`, must never use `--all`, because a park stash
  carries the task id. That is now stated wherever the guard is described.
- **`B-046` (`TASK-0137`).** `loops/ansible-change/` says what a Claude Code
  session needs beyond gate 3. Gate 4 takes the human's exact-match allow
  rule, plus output redirected to a file. Gates 6-8 take per-command rules,
  or the human runs them.
- **`B-050` (`TASK-0138`).** `ansible-ops` role 5 derives `not-applicable`
  for actions that only load tasks (`include_*`, `import_*`), whose
  documentation cannot answer it. The tasks they load are still judged
  (`1.2.0`).

## The estate's ansible-vault password comes from Vault (`TASK-0134`, `B-052`); `.env` variants are ignored (`TASK-0133`, `B-053`)

**2026-10-04, on the human's routing.**
- **B-053.** `.gitignore` now ignores every `.env` variant except
  `.env.example`, and the gate fails if that regresses.
- **B-052, done in the estate repository under its own conventions** (its
  `S042.T001`, ADR 0014, committed `2a09fa0`):
  - `tools/vault_pass.sh` reads the password from the environment, or from
    Vault through the vault-secrets loader;
  - there is no `.env` fallback, and the `.env` entry is gone;
  - the Vault copy was proven first, against all 19 vaulted values;
  - **its push waits for the human**: 15 older unpushed commits, and an
    admin token over `http://`.

**Owned up to, and handed to its owner.** `TASK-0131`'s one-time bootstrap
rewrote Vault's LDAP config outside the estate's codified role. The live
config works, but it is not the declared one. The estate filed it as its
`#96`, which needs the human's admin login. `vault-layout.md` no longer
claims those settings.

## The codebase has its own Vault identity (`TASK-0132`, `ADR-0031`)

**2026-10-04, the human's decisions.** ai-toolbox authenticates to Vault as
the AppRole `ai-toolbox`. Its tokens can create, read and update
`kv/ai-toolbox/*`, can never delete, and live 10 minutes. The loader logs in
per command and keeps no token: `exec` revokes before the child starts. The
credential file is refused if anyone else can read it.

The human's local `.env` held 34 variables in a folder every agent can read.
All 32 secrets in it moved to `kv/ai-toolbox/`, verified by sha256 and then
deleted from `.env`; their names sit in a private, untracked map. Maps now
combine (`--map` repeated, or `VAULT_SECRETS_MAPS`).

Proven offline: 46 cases, and each new safeguard was shown failing with it
broken. The Vault-side setup ran live, and the AppRole login returned only
`ai-toolbox-app`. Through the loader, with that identity and both maps, `check`
read all 34 variables, exit 0.

## Secrets come from Vault; the environment stays the interface (`TASK-0131`, `ADR-0030`)

**2026-10-01..03, the human's decisions.** The three git tokens lived as
exports in one host's `~/.bashrc`. That file was world-readable, the exports
were not always present in a session, and no other host had them. They now
belong in the intranet Vault: TLS on, LDAP login against AD over `ldaps://`,
KV v2 at `kv/`. The human set that up; the root credential never entered the
session.

- `skills/vault-secrets/scripts/vault_secrets.py exec <VAR> -- <cmd>` fetches
  only the named variables into that one command's environment. `login`
  stores only a read-only child token, for 8 hours. `put` writes with a fresh
  login. `check` reports by name. A non-loopback `http://` is refused, and an
  exported variable wins over Vault.
- `secrets.map` maps the three tokens. The runbook's *Secrets on a new host*
  and *Authenticating a push* (`vgit`) are the procedures.
- GitHub and GitLab CI variables were rejected as the store (`ADR-0030`). CI
  is unchanged and needs no custom secret.

**Proven offline and live.** Offline: `tests/test-vault-secrets.sh` (34
cases, in the gate) runs against a loopback stub, and each guarded behaviour
was shown failing with it broken. Live, on 2026-10-03..04:
- `login` stores only `['default', 'workstation-read']`;
- `check` exits 0 with all three tokens readable from Vault;
- both remotes accept pushes authenticated with tokens from Vault.

The `~/.bashrc` token exports are gone. A push token that turned out to exist
in no file at all was replaced. The estate's Ansible Vault password is
`B-052`.

## The closer is handed the figures it must copy (`TASK-0121`, `B-043` closed)

**2026-09-30, the human's decision: route B.** Loop step 10 told the closer to
copy *"every figure from the evidence file"*, which has none: `run-gate.sh`
writes one line per gate (state, exit, elapsed, `LOG=`). Both bindings
already collected the gate-runner's `figures[]` and then dropped them, so the
only role with git rights was pointed at a source that never held the figure.

- `references/evidence.md` now says a gate's log is admissible under three
  conditions: its evidence line names it by `LOG=`, this run wrote it, and the
  figure is quoted verbatim. A recollection, paraphrase or rounded figure
  stays inadmissible however it was obtained.
- Both closers receive the gate reports. `run-gate.sh` is unchanged.
- Eleven files restated the old rule, not the two the brief named. All are
  reconciled, and `decision-standard.md` was regenerated.

**Proven on stubs only.** A test per binding shows the figure reaches the
closer's prompt and fails with the wiring reverted. No real run has shown a
closer copying one, and "verbatim" is instructed rather than checked.
`B-044` and `B-045` remain `ready`.

## ci-alert closes its issue only when no watched workflow is red (`TASK-0130`)

**2026-09-30, the human's decision.** `.github/workflows/ci-alert.yml` used to
close its alert on *any* green run. A push's green `dashboard` would therefore
have closed the alert that the same push's red `validate` had just opened.
This was latent: no red run has happened on `master` while ci-alert existed.

The workflow now:
- re-reads each watched workflow's latest run on the default branch, and
  closes the alert only when none of them is red;
- ignores runs off the default branch, which it never checked before;
- watches `dashboard-daily` (`TASK-0129`).

The rule and its reasons are in the workflow's header. The offline proof is
`tests/test-ci-alert.sh`, run by `tests/validate.sh`.

**Verified after landing**, on the runs the workflow's header names. Test
issue #3 was opened and commented on by simulations, and a real green run
closed it. One path cannot be shown live without a red `master`: a green run
that must not close the alert. That path is proven offline only.

**A correction to `TASK-0124`'s section below.** Its *Known limit* says a
side-branch failure raises nothing, because `workflow_run` fires only for the
file on the default branch. That rule concerns where the listener lives, not
the branch of the run it hears. Until `TASK-0130`, a side-branch failure would
have opened the issue.

## The published dashboard is rebuilt daily, verified (`TASK-0129`, done 2026-10-05)

**Verified on 2026-10-05.** Five scheduled runs, 2026-10-01..05, all
succeeded. Each dispatched a `dashboard` build that also succeeded, and the
logs pair them by run id. The page read `today` `2026-10-05`, built by that
morning's dispatched run with no push since 2026-10-04. The label reads
`VERIFIED`. **The 00:23 UTC slot starts 5 to 6 hours late every day.** The
date is still right, and README and `references/dashboard.md` (skill `5.2.1`)
now say so. The rest of this section is as written at landing.

### As landed, 2026-09-30

**2026-09-30, the human's decisions of the same day.** `skills/project-workflow/`
(`5.2.0`) has an opt-in `github-pages-daily` target. `publish-dashboard.sh
render` writes `.github/workflows/dashboard-daily.yml`, whose only job, once a
day, is to dispatch the unchanged `.github/workflows/dashboard.yml` on the
configured branch, wait for that run, and end as it ends. It is a file of its
own for the reason `ADR-0029` records. GitHub's limits on it are in
`skills/project-workflow/references/dashboard.md`, *Publishing it*.

**Its `STATUS:` was `UNVERIFIED` until a scheduled run was observed**, and
`TASK-0129` stayed `in_progress` until then. The `TASK-0128` section below says
the dispatcher is not built yet; that was true when it was written.

## The published dashboard is built only by CI; a local build is a preview (`TASK-0128`, `ADR-0029`)

**2026-09-30, the human's decisions.** Asked why the published page is not
the local file sent to Pages, the human chose to keep CI as its only builder
and to record why. `ADR-0029` does, weighing each route. Neither Pages
platform accepts a page built outside its own CI. A local build reads the
working tree and checked-out `HEAD`, so it could put what was never pushed on
a public page.

The rule is stated in `AGENTS.md` (*Delivery dashboard*) and in
`skills/project-workflow/references/dashboard.md` (*Publishing it*; skill
`5.1.2`). The "canonical output / optional copy" wording that invited the
question is gone from the conf, the templates and the rendered pipelines.
`build-dashboard.sh`'s header no longer says nothing runs it.

The ADR also records the daily rebuild as a separate dispatcher workflow,
which is not built yet. Until it is, the page's date-dependent figures are as
of its last build. The measurements are in `TASK-0128`.

## `skills/ansible-ops/` exercised end to end, once (`TASK-0116` done)

**2026-09-30, attempt 3.** Gates 6-9 ran on the human's in-file
authorization. The change was the gentlest real mutation available: the
read-back baseline play applied for real, which writes `latest.json` and one
new snapshot file on the control node, behind a read-only PVE token. **The
human executed gates 6-8**, because the Claude Code classifier refused them to
the agent even with the authorization in the file (`B-046` extended). Gate 8
read the effect from state: exactly the two writes gate 4 predicted and nothing
else. The change record closed with `RECORD OK`. The estate's new baseline is
**uncommitted, for the human to keep or roll back**. What is still untested is
a guest-level change with a real PVE snapshot; this change's snapshot was a git
blob.

## `project-migration` generates its own artifacts, installed alone (`TASK-0117`, `B-036` closed)

**2026-09-30, scheduled by the human (trigger 3).** No consumer had been
observed stranded. `skills/project-migration/scripts/` now carries
**byte-identical** copies of `artifact_lib.py`, `new-artifact.sh` and
`check-artifact.sh`. The owners stay in `project-workflow`;
`scripts/sync-artifact-engine.sh` writes the copies, and `tests/validate.sh`
`cmp`s them, a gate observed failing on a mutated copy before it was trusted.
**Proved from a tree containing only `project-migration`**: all four kinds
generate byte-identical to the owner's output, the checker rejects every
unfilled skeleton, and it passes real artifacts. `SKILL.md` (`3.1.0`) and the
scaffold's closing report now point at the skill's own scripts. Making a
verbatim copy correct needed one owner-side change: each wrapper now reads its
own skill's name instead of having `project-workflow` written into it.

## A migrated repository is told the truth about its templates (`TASK-0120`, `B-041` closed)

**2026-09-30, route 1 by human choice.** `skills/project-migration/SKILL.md`
(`3.0.0`) no longer says a migrated repository's `.ai/templates/*.md` are
regenerated by `scripts/sync-templates.sh`. That script exists only here, and
from inside a freshly scaffolded repository the instruction fails:
`No such file or directory`, exit 127. The skill now calls the emitted
templates a **point-in-time copy**, correct on the day it was scaffolded, and
gives a check the target can run: scaffold into a scratch directory and
`diff -r`. Proved from inside the target, exit 0 clean and exit 1 on a mutated
template. **The same claim survives one layer down**: every emitted template's
banner names ai-toolbox's generator, schema path and gate, none of which the
target has. `SKILL.md` warns about it; the fix is `B-051`.

## `skills/ansible-ops/` gates 4-5 exercised live (`TASK-0116` attempt 2, `B-050` raised)

**2026-09-30.** Gate 4 — `--check --diff --limit sigsrvpve1` of the read-back
baseline play — ran against the real estate, exit 0, `ok=18 changed=2
failed=0`; the two `changed` are the play's own snapshot writes, predicted and
not performed (estate `HEAD`, porcelain and every `state/baseline/` checksum
identical either side). **The skill is now exercised through gate 5; gates 6-9,
the only ones that change state, are not**, and wait on a human filling the
task file's Authorization section with a mutating change.

**Two things only running it could show.** `B-046`'s prerequisite has two
parts: an exact-match allow rule clears the classifier, and then ansible-core
2.21.4 refuses non-blocking stdio, which the Bash tool supplies — redirect to a
file. And gate 5's role-5 derivation **cannot answer for control-flow actions**:
`include_tasks` documents check-mode support `none` and ran anyway, so the rule
as written would stop a change whose every state-touching module is `full`
(`B-050`). `skills/ansible-ops/` byte-identical; fixes are separate tasks.

## The dashboard can publish to GitHub Pages or GitLab Pages (`TASK-0127`, `B-048` closed)

**2026-09-29, the human's request.** `skills/project-workflow/` (`5.1.0`) now
ships the publishing pipelines it used to leave to this repository:
`assets/publish/{github-pages,gitlab-pages}.yml`, rendered by
`scripts/publish-dashboard.sh render` from a repo-root `dashboard-publish.conf`.
The local file stays the canonical output; publishing is opt-in per target.
**`B-048`'s route 1** — the only one it costed that cannot rot: this
repository's `.github/workflows/dashboard.yml` is now *rendered* (adopted once
from the hand-written file), and `tests/validate.sh` runs `render --check` and
the 32-case `check-publish.sh`.

**The guard found a hole in the old one while moving.** The hand-written guard
caught a shallow clone by `commits <= 1`. **GitLab clones 20 commits by
default**, which that check passes, so on GitLab it would have published a
plausible, truncated page. `publish-dashboard.sh guard` asks git
(`--is-shallow-repository`) instead, and both templates set full depth. It also
fails on a *missing* model key rather than skipping it — the `TASK-0125`
lesson, now a test.

**Status, as observed**: GitHub Pages **VERIFIED** on run 36608693753
(`36ac929`) — the skill's guard printed `266 commits … full clone` on the
runner and the page returned HTTP 200. **GitLab Pages is UNVERIFIED and cannot
yet be verified**: its job passes the instance's own CI lint (`valid: true`, no
warnings) and pipeline 10 created it, but no runner is online, so every push to
`origin` queues a `pages` job that does not start.

**Found the hard way, and now a comment in the suite**: a pre-commit hook
exports `GIT_DIR`/`GIT_INDEX_FILE`, which override `git -C`. The suite's first
run from the hook reached this repository through them — `core.bare = true`, a
replaced index, a stray 423-file-deletion commit on the session branch, none of
it pushed. Repaired, fixed, and reproduced against a sacrificial repo; details
in `TASK-0127`. **Anyone wiring the binding suites into the gate (`B-037`)
inherits the same trap**: they also run git in scratch repositories.

**Cost to the gate, measured**: `check-publish.sh` 1.7 s on this `/mnt/c`
worktree, after two fixes that took it from 3.4 s — a git call the library made
on every invocation even with `--repo` given, and ~40 reads of the script over
the 9p bridge, now served from a copy in `mktemp`.

## The intranet GitLab is `origin`; GitHub is the mirror (`TASK-0126`, `ADR-0028`)

**2026-09-29, the human's request and routing.** `origin` is now the private
`armando.martires/ai-toolbox` project on `$GITLAB_URL`; the old `origin` is
renamed `github` and kept as a **public mirror** that every task end pushes to
as well. `master` tracks `origin/master`. All three of local, `origin` and
`github` read `9a6c83b` after the first push, compared by hash.

**Git never sends `GITLAB_TOKEN`.** The instance answers on `http://` only —
its https port refuses connections — and that token is an admin token with
`sudo`. Git instead sends `GITLAB_PUSH_TOKEN`, a project access token scoped
`read_repository` + `write_repository` to this one project, expiring
2027-09-28, exported from the shell profile beside `GITLAB_TOKEN` (moved there
2026-09-30 on the human's routing, from a separate file `TASK-0126` first
used). The cleartext exposure is **reduced, not removed**; removing it needs
https on the instance.

**CI still runs only on the mirror.** No GitLab runner is online, so
`validate.yml`, `ci-alert.yml` and `dashboard.yml` stay GitHub Actions, reached
only if the mirror push happens. **The intranet hostname is kept out of every
new tracked file**, since the mirror is world-readable. One earlier record,
`TASK-0015`, already names the host's stem and has been public since
2026-09-13; it is left as written, because editing it would not remove it from
the published history.

**Not measured, and stated so nobody assumes it:** whether GitLab Pages is
served on the instance. A probe of admin-only endpoints was denied by the
Claude Code classifier and not retried. That is `TASK-0127`'s question.

## One dashboard, vendored from its source (`TASK-0125`)

**2026-09-29.** `skills/project-workflow/` no longer carries its own dashboard
generator. `scripts/dashboard_lib.py` and `assets/dashboard.{html,css,js}` are
**deleted**; `dashboard/` holds a vendored copy of the generator developed in
`sigma-llmwiki`, and `build-dashboard.sh` is a thin wrapper over it that keeps
the flag surface `.github/workflows/dashboard.yml` and
`skills/project-migration/SKILL.md` already call. `SKILL.md` is `5.0.0` — a
major, because what produces the artifact changed.

**Why.** Two generators for this convention were built in the same week, in two
repositories, neither aware of the other: this repo's `TASK-0122` and
`sigma-llmwiki`'s `S027.T001`. So the dashboard a project got depended on which
repository it was scaffolded from, which is the opposite of what a skill is
for. One generator, vendored, with `dashboard/VENDORED.md` recording the source
commit and a sha256 per file and a drift check that exits non-zero — so the two
copies matching is a claim a command can refute, not one somebody remembers.

**The fixture earned its place a second time.** Re-pointing
`fixtures/dashboard/` at the incoming generator found three defects in a tool
that was passing every check in its own repository: the fixture parsed to
**zero tasks** (its briefs are `S001.T001_Name.md`; the reader demanded a
sprint name in the filename), every pending task raised a bogus "no lane
assigned" defect (that repo's own execution-lane table applied to a foreign
corpus — `--check` would have failed for every consumer of this skill), and
hand-recorded `**Created**`/`**Updated**` fields were ignored in favour of the
filesystem mtime. All three were fixed at the source and re-vendored.

**`B-048` is untouched and still stands.** It records the human's decision not
to ship the publishing pipeline from the skill, to be reopened "when a second
repository actually wants the pipeline". A second repository now owns the
generator and explicitly does **not** want it: its position is that the local
file is canonical and Pages is optional. So publishing remains a property of
this repository, exactly as routed.

**The gate now runs on Windows (`a8e825b`, a separate commit).** It could not,
and not by failing a check: the `UNTRACKED ASSET` block did `path.split("/")[1]`
over `glob.glob("skills/*/scripts/*")`, which returns backslash-separated paths
there, so it raised `IndexError` and took the whole gate to exit 1 with no
indication of which check had died. Normalising the separator also fixes a
quieter second fault in the same loop — `rel` is compared against `git
ls-files`, which always emits forward slashes, so every declared asset would
have read `NOT TRACKED` even once the crash was fixed. CI runs on Linux, which
is why neither was ever visible. Kept out of `TASK-0125` deliberately: a change
to the mandatory gate is its own reviewable commit.

**Verified live.** `validate` and `dashboard` both **success** on `a8e825b`; the
rewritten guard reported `history OK: 260 commits, 122 task briefs, 16 sprints,
shape numbered_task` — 260 and not 1, so the shallow-checkout trap is still
caught by a guard that previously could not have fired at all. The published
page returns **HTTP 200**, carries `generator content="pm_dashboard.py 2.0.0"`
and twelve tabs, and has **zero** off-file references after the round trip.

Last updated 2026-09-28. **Sprint S10 is CLOSED** on `REVIEW-0012`
(`TASK-0105`), archived to
`.ai/planning/sprints/SPRINT-S10-unattended-bindings.md`; `ROADMAP.md`'s
Phase 10 is COMPLETE. All eight deliverables landed: S10.1 (against a stub)
— `TASK-0086`; S10.2 (against a stub) — `TASK-0087`; S10.3 — `TASK-0088`;
S10.4 — `TASK-0104`; S10.5 — `TASK-0090`; S10.6 — no task of its own; S10.7
— `TASK-0092`; review — `REVIEW-0012`. **No sprint is open.** The dated `##`
sections below carry the detail. **Two post-S10 tasks have since been taken
up on the human's routing, without opening a sprint** — `TASK-0106` (done)
and `TASK-0107` (planned); the section immediately below carries them. A
third and fourth, `TASK-0109` and `TASK-0110`, landed 2026-09-26/27 and
changed how every planning artifact is produced *and* brought the repository
onto it — see **Artifact shape has one owner** and **The repository now
follows it**, below.

## The publishing pipeline stays repo-local (`B-048`)

**2026-09-28, the human's call.** `skills/project-workflow/` ships the
dashboard **generator** and nothing about publishing — measured, not assumed:
`grep -rli 'pages|workflow|github actions|\.github'` over the whole skill
returns zero. All three workflows live in `.github/workflows/`, which travels
with this repository and not with the skill, so a consumer gets *run one
command, get one file*.

Three routes were costed — a rendered template gated on drift (the
`sync-templates.sh` shape), an ungated template, or prose in the reference —
and **none was taken**. Publishing stays a property of this repository.
Recorded as `B-048`, `ready` and unscheduled, with `B-036`'s own reasoning:
building for an absent consumer is how a second owner appears.

**Open items are now thirteen**, recounted from the rows — the second recount
in one day, which is `B-038` and `B-047` making their point again.

## A failing workflow now reaches a person (`TASK-0124`)

**2026-09-28**, closing the question `TASK-0123` deliberately left open.
`.github/workflows/ci-alert.yml` opens a GitHub Issue when `validate` or
`dashboard` fails, comments on further failures rather than filing more
issues, and **closes the issue when CI recovers** — a state indicator rather
than a notification.

**Not email, and that is the finding.** GitHub's failure email defaults to
*on*, so it was almost certainly already sending during all fourteen red
commits and already being missed. Turning on a channel that has already
failed is not a fix. It also cannot be verified or tested from a script:
`/notifications/settings` and `/user/notifications/settings` 404 and
`/user/emails` 403s for this token. GitHub still emails about the issue
through the normal path, so the mail arrives — but the record no longer
depends on it being read.

**No secret and no dependency.** `GITHUB_TOKEN` with `issues: write` is
already in the runner. SMTP would have put credentials in the secrets of a
**public** repository and added a marketplace action where `ADR-0021` prefers
wiring to vendoring. `grep 'uses:'` over the workflow returns nothing.

**All three paths verified against real runs**, six of them, each read back
from the API — and the strongest evidence was unplanned: a **real** green
`validate` on `2bfda15` closed issue #1 through the live `workflow_run`
trigger, naming the actual commit and run URL. Two consecutive failures
produced one issue and one comment, not two issues. Issues `#1` and `#2` are
closed and left as the record.

**Known limit**: `workflow_run` fires only for the file on the **default
branch**, so a failure on a side branch raises nothing, and an edit to the
alert takes effect only once it is on `master`.

`README.md` also carries both badges now, so red is visible without any
notification at all.

## The dashboard publishes itself, and CI was red for two weeks (`TASK-0123`)

**2026-09-28.** `.github/workflows/dashboard.yml` regenerates the dashboard on
every push to `master` and deploys it to GitHub Pages. **Live and verified at
`https://armandomartires.github.io/ai-toolbox/`** — run `36440566161`,
`success`; the page fetched back at HTTP 200, 294 KB, embedded model
reporting **252 commits**, 120 briefs, 10 sprints, 27 ADRs; `model.json`
404s; `http://` 301s. Nothing is committed: `/_site/` is ignored.

**`fetch-depth: 0` is load-bearing and asserted.** `actions/checkout` defaults
to depth 1 and the generator reads `git log`. Measured both ways: full →
249 commits, `--depth 1` → **1 commit**, an empty Activity tab and every
completion date silently degraded from a commit timestamp to the editable
`Updated` field. A plausible page that is wrong. The workflow therefore
refuses to deploy a degenerate history rather than trusting the flag stayed.

**`AGENTS.md` said this repository was private. It is public** — the API says
so and `raw.githubusercontent.com` serves `.ai/` with no token. Confirmed as
intended and corrected: everything committed here is world-readable, which
makes the secrets rule the only thing between this repo and a published
credential rather than belt-and-braces.

**The larger finding: `validate` had failed on every commit for at least
fourteen commits**, back past `TASK-0113`, while the same gate passed locally
every time and `validate.yml`'s header read `STATUS: VERIFIED`. The cause was
**a file mode**, not a check: this checkout is on `/mnt/c` where
`core.filemode` is false, so `chmod +x` changes nothing git records and drvfs
reports every file executable anyway. `scripts/sync-decision-standard.sh` went
in at `100644` and `validate.sh` invokes it with no interpreter prefix.
**Eleven tracked scripts were in that state, three added by `TASK-0122` the
same day.** Reproduced by cloning to ext4, where the CI message appears
verbatim. Fixed in `bd4160c`; `tests/validate.sh` now fails on any tracked
shebang file not recorded executable, with no carve-outs. **Green again.**

**What is still open, and it is not technical.** The mode defect survived two
days because nothing tells anyone a run failed, and `tests/validate.sh`
cannot detect that CI is failing. A second opinion with no way to reach its
reader is not a second opinion. Deliberately left as a decision for the
human rather than fixed inside `TASK-0123`.

## The governance layer now has a generated view (`TASK-0122`)

**2026-09-28, requested by the human; no sprint open.**
`skills/project-workflow/` gained a dashboard generator:
`scripts/build-dashboard.sh` + `scripts/dashboard_lib.py` read a repository's
`.ai/` and write **one self-contained HTML5 file** — no CDN, no external font,
no network, `python3` stdlib only, every chart hand-rolled SVG. Nine tabs;
burn-up and burn-down, cumulative flow, velocity, throughput, cycle-time
percentiles, ageing WIP, a roadmap timeline, a seeded Monte Carlo forecast, a
commit heatmap. A **table view behind every chart**, light and dark themes
both stepped from validated ramps, and `--css` / `--css-href` for branding.
`references/dashboard.md` is the reference; `SKILL.md` → `4.1.0`.

**Both frameworks, and that mattered.** The reader detects
`project-workflow` and `project-migration` from the files present. A
`project-workflow` fixture — the layout *this* repository does not use —
found **three parser defects nothing here could have shown**: the task-id
pattern swallowed the file extension; an identifier field was cleaned as
prose, turning `S001_Foundation` into `S001Foundation (see
../30.ROADMAP.md…)`; and a sprint the plan calls `S002` never matched a brief
saying `S002_Performance`, so every sprint in that layout fell into the
"outside a sprint" bucket with the velocity chart empty. The fixture is also
the only place an **open** sprint is exercised: none is open here.

**It found a real defect on its first run against this repository, and that
is the point.** `BACKLOG.md`'s prose counted twelve open items and named
`B-015`; `B-015`'s own row has read `**done**` since 2026-09-16. The
generator counts from the rows and said eleven. Recorded as **`B-047`** and
the sentence recounted — the third recurrence of `B-038`'s argument in three
days, after `TASK-0115` and `TASK-0118` each repaired it by hand.

**`project-migration` points at it, in a follow-up commit.** The dashboard
reads that framework's shape natively — this repository *is* one, which is
where every figure above came from — but `skills/project-migration/` named it
nowhere, so an agent loading only that skill would never learn it exists.
`SKILL.md` gained a `## Seeing the layer` section (`2.0.0` → `2.1.0`), the
same cross-skill pointer arrangement it already uses for `new-artifact.sh`.
**The install-alone case is unchanged and stays `B-036`**: the generator
lives in the sibling skill and was deliberately not copied. Writing that
pointer found a bug in the command it recommends — `--out docs/dashboard.html`
died with a raw `FileNotFoundError` in a repository with no `docs/` yet. The
generator now creates the parent directory for `--out` and `--json`, and
reports an unwritable path as one line rather than a stack. Documenting a
command is a way of testing it.

**Installed here, and it needed no install step.** Both clients carry the
skills as **symlinks** into this checkout (`~/.claude/skills/` and
`~/.config/opencode/skills/`, `link` mode, ADR-0002), so `4.1.0` and the
dashboard went live the moment the commit landed — verified by running
`~/.claude/skills/project-workflow/scripts/build-dashboard.sh` through the
deployed path and getting the same counts. What *was* missing is that
`AGENTS.md`'s **Commands** section listed every other script in this repo and
not this one; it now does, labelled a view rather than a gate.

**What it is not.** It renders what the artifacts say; it does not audit
them. A brief recording a suite it never ran is rendered as a suite that
passed — the `ADR-0009` boundary, stated on the tool rather than assumed. Its
cumulative-flow diagram is **reconstructed from three dates, not replayed**,
because neither schema records a status transition, and the chart card says
so on its face. It is **not wired into `tests/validate.sh`** and does not
claim to be: the gate is hermetic and offline, and this needs a working tree
and git.

## The scaffold is now on the schemas (`B-040`, CLOSED by `TASK-0119`)

**2026-09-27, from a review of whether `project-workflow` and
`project-migration` are fully integrated.** The answer to the question asked
is **yes for the library and no for one consumer of it**, and both halves are
measured.

**Shared, and working.** `skills/project-workflow/scripts/artifact_lib.py` is
the single engine; `new-artifact.sh --framework project-migration` and
`check-artifact.sh --framework project-migration` resolve the sibling
framework's schemas script-relative, so they survive `install.sh`'s
symlinking; `scripts/sync-templates.sh` renders all seven targets across both
frameworks in one interpreter; `tests/validate.sh` checks four kinds against
`project-migration`'s schemas using `project-workflow`'s engine, and exits
`OK`. Both skills disclaim each other per `ADR-0013`. Nothing here is broken.

**Not shared: `skills/project-migration/scripts/ai-project-scaffold.sh`.** It
writes `.ai/templates/{TASK,PLAN,SESSION,ADR,REVIEW}.md` into every repository
it migrates, as five inline heredocs that predate `ADR-0027` — a second owner
of shape, which is the mechanism that ADR exists to remove. **Two of the five
have already drifted past their own schemas**, extracted and run through the
skill's own checker rather than eyeballed: `TASK.md` fails with six problems,
three of them the `## Preconditions` / `## Dependencies` / `## Expected
result` headings `schemas/task.md` records as `superseded:`; `REVIEW.md` fails
missing all four required sections. `SESSION.md` and `ADR.md` pass.

**Why no gate saw it.** `sync-templates.sh` regenerates `.ai/templates/` in
*this* repository and `validate.sh` fails on drift — and the scaffold's
`mkfile` refuses to overwrite an existing file, so its heredocs are never
written here. They reach only other repositories, where no gate of ours runs.
The gate is real; its blind spot is a script that only fires elsewhere.

**`TASK-0109`'s exclusion was right and its boundary was not.** Its *Not
included* reads *"`ai-project-scaffold.sh`'s layout scaffolding, which is a
different job and stays as it is."* Layout is a different job. But the script
does two jobs, and `mkfile .ai/templates/TASK.md <<'EOF'` is the other one —
shape, which `ADR-0027` had just given an owner. `SKILL.md` line 23 already
writes the division correctly: *"The scaffold script still owns the layout;
the schemas own the shape."* The rule existed; the script never implemented
it. In the same file, the closing report still prints `cp
.ai/templates/TASK.md …`, which `SKILL.md`'s hard rules forbid.

**Two further gaps, raised rather than absorbed.** `B-041`: `SKILL.md` names
`scripts/sync-templates.sh` as the regeneration route for a migrated
repository, and that script exists only at this repo's root — true read from
inside `ai-toolbox`, false for the reader it is written for. `B-042`: the
`plan` kind has six real instances in `.ai/planning/plans/` and no schema
anywhere, and `project-migration`'s `BACKLOG.md` entry has its fields in prose
only while `project-workflow`'s equivalent has `schemas/adhoc.md`.

**`B-040` is CLOSED, 2026-09-28 by `TASK-0119`.** Everything above this
paragraph is the state *before* that task and is left as written. The four
schema-backed templates are rendered into
`skills/project-migration/templates/` by `sync-templates.sh` (7 targets → 11)
and read by the scaffold at run time; the four heredocs are gone; the closing
report names `new-artifact.sh` instead of `cp`; `SKILL.md` is `2.0.0`.
`PLAN.md` stays a heredoc and is labelled — it has no schema in either
framework, which is `B-042`, still open.

**The scaffold did not become dependent on its sibling skill.** Route B of
three was taken for exactly that reason, and it was verified the strong way:
the skill was copied **alone** to a directory outside this repo — no
`project-workflow`, no generator — and run there. Exit 0, all five templates
emitted. `TASK-0117`'s trigger did **not** fire.

**The result worth carrying forward is about gates, not templates.** This
needed **two** checks, and the second is not redundant: re-inlining a heredoc
was *observed* leaving `sync-templates.sh --check` green, because the shipped
templates were still correct — they had simply stopped being what a migrated
repository gets. One gate over one artifact cannot cover both "is it right"
and "is it used". That blind spot is how the original defect survived a gate
that was real, working, and trusted. Anyone who later reads those two checks
as duplication and deletes one restores the defect.

**Still open here**: `TASK-0120` (`blocked` on a route choice) routes
`B-041` — a migrated repository's templates are now correct *at birth*, but
it still has no way to **keep** them correct; and `B-042` is deliberately
unrouted until someone counts what the six plans share.

**Not done, and stated because it could be assumed**: repositories already
scaffolded keep their old templates. `ADR-0027` forbids retroactive edits,
and since `mkfile` never overwrites, **re-scaffolding will not fix them
either** — the four files must be deleted first.

## `ansible-ops` met the real estate, and stopped at gate 4 (`TASK-0116`)

**2026-09-28.** The skill that had never been executed in the estate it was
written from has now been run against it — **as far as the harness allows**.
Gates 1-3 performed, gate 4 blocked, gates 5-9 not reached.

**What ran, and it is the first evidence of quality this skill has had.**
Gate 1 derived the obligation set from the estate's own files: `sigsrvpve1` is
hazard-class, the play's `gather_facts: false` is the applied exclusion so
`ansible_mounts` is never collected, and the bound is `--limit sigsrvpve1`.
Gate 2 lint exit 0 over 13 files. Gate 3 syntax/parse exit 0. The instructions
were followable as written at every one of the three.

**Gate 4 was denied by the Claude Code auto-mode classifier** — not by the
estate, not by the permission model the skill reasons about, and not by
anything `agents/` declares. The command was read-only by construction
(`--check --diff`, bounded, `*_info` modules, a PVEAuditor token). Raised as
**`B-046`**: this is a capability asymmetry of the class `ADR-0018` records
for `worktree-only`, one layer up — a loop written to be agent-runnable end to
end is, on this client, agent-runnable to gate 3. **Not routed around.**

**Gates 6-9 remain unauthorized** and that is by design: the task file's
Authorization section is unfilled, `AGENTS.md` requires it there, and a
conversational "proceed" does not substitute for it.

**The record checker was exercised and is correct.** Against the partial
record it named five missing fields — `check_mode_run`, `check_mode_fidelity`,
`snapshot_ref`, `rollback_verified`, `approver` — mapping to exactly the four
gates not reached. The field-to-gate routing the template claims does work.

**A measured correction.** The estate's own health gate (serial, infers pmxcfs
from `/proc/self/mounts`, never touches `/etc/pve`) reports **6 nodes, 6/6
votes, quorate, ring `1.22c3`, all five services active on every node**. So
`ansible.cfg`'s "3-of-4 quorum with no verified margin ... the cluster's
current normal operating condition" is **false**, and it is a fourth stale
claim under `B-039`. `forks = 2` is untouched: its reason is a historical
observation about a *recovering* pvedaemon, which stands.

**Nearly got wrong, so it is written down**: `ping` reports every node
unreachable — ICMP is filtered, TCP/22 is open. Concluding from the ping would
have produced a confident, false "estate unreachable" finding.

**The estate was verified untouched** either side: `HEAD` `2a6be9a` unmoved,
porcelain empty, and every one of the play's tracked write-targets
byte-identical by checksum.

## The Claude Code binding has now been run (`TASK-0113`)

**`B-043`, this run's headline finding, is routed as of 2026-09-28 by
`TASK-0121`** (`ready`). Writing that brief sharpened it beyond the backlog
row: the missing figure slot is real, but both bindings *already* collect a
verbatim `figures[]` in the gate-runner and then drop it, because the closer
takes no gates parameter in either. The figure never had a path to the only
role told to write it. What stays open is the evidence standard's scope —
whether a log named by an evidence line is admissible — which is a human's
decision and is costed there as three routes.

**2026-09-28.** `REVIEW-0012` finding 4 is discharged: the binding that had
only ever been stub-proven was driven through a real run. One task, one gate, a
scratch repository at `/tmp/opencode/cc-pilot/`, 13 agents, ~20 minutes, zero
agent errors.

**It parked, against a prediction of `accept` recorded before the run.** That
is the useful outcome. Verified from the scratch repository, not from the run's
report: `HEAD` still `aae3965`, no commit, tracker `- [ ]` untouched, tree
clean, the one-line change stashed under `unattended/20260927-2000/TASK-0001`,
and a 14 KB handover written from the journal.

**The headline finding is `B-043`, and it is not a Claude Code defect.**
`run-gate.sh`'s `summary()` emits one fixed line with **no figure slot** — for
any gate, ever — and that is exactly what gets appended to the evidence file.
But `loop.md:234-235` orders the closer to update criteria "copying **every
figure from the evidence file**". The two cannot both be honoured, and
`run-gate.sh` is the **OpenCode** binding's entry point, so both bindings carry
it. Verified against source twice: by the run's adjudicator, and again by hand.

**The adjudicator's reasoning is the part worth keeping.** It declined to
override, because accepting would hand an unsatisfiable instruction to the one
role with git and tracker rights — whose only outcomes are a refusal with git
already engaged, or an invented figure in a committed task file. It parked and
named the unsettled question instead of resolving it. That is the loop doing
precisely what it was built to do, on a defect no stub could reach —
`REVIEW-0012` finding 3's argument, now demonstrated on the other binding.

**Two more findings.** `B-044`: the binding has no repo-root parameter, so it
runs only from the consuming repository's own checkout — hit before the run
could start, and plausibly part of why it had never been run. `B-045`: the
park-steward's stash message carries the task id, so a resume guard written
with `--all` would read a parked task as **closed**; `loop.md`'s guard omits
`--all` and is correct, but nothing states the constraint.

**A direct answer to what `TASK-0111` handed over, with its qualification
intact.** Roles did read the skill — `verdicts.md` ×7, `park-and-recover.md`
×6, `evidence.md` — so on Claude Code the adjudicator reaches the decision
standard **unembedded**. But the reads resolved to
`/…/ai-toolbox/skills/unattended-ops/…`, the pilot session's own cwd, which a
real consuming repository would not have. So **`B-035`'s Claude Code half stays
open**, and `TASK-0106`'s sibling-file argument — about *location*, not
permission — survives untouched.

**`ADR-0022` F5 was not reachable** and that is structural, not luck: the
binding selects roles by `opts.agentType`, never `tools: Agent(...)`, and an
unresolvable agentType throws into a `Halt` rather than failing silently.

**Method note.** The shipped template was **not modified**. The consuming repo
got a copy — which is how the binding is meant to be deployed — differing by
one hunk in `header()`, behind an optional `args.repoRoot`, recorded as a
finding before it was made.

## `ADR-0022`'s last two untested falsifiers are settled (`TASK-0114`)

**2026-09-27.** F7 and F9 both **CONFIRMED**. Eight of the nine now carry
verdicts; **F8 alone is still open**, and only for Bionic.

**F7 — the long-gate claim holds, and generalises structurally.** A 720 s
synthetic gate (120 s past the ten-minute cap) through `run-gate.sh`: `start`
returned a handle in **0 s**, then 12 `wait` polls, **max 61 s**, min 58 s.
Longest agent-side call **61 s against a 600 s cap**. The per-call maximum is
set by `wait`'s own 60 s bound, **not** by the gate's length — so the real
68–72 minute build produces the same ceiling with more polls, and a synthetic
gate is indistinguishable from a compile on the poller's side. That equivalence
is the claim's whole content and it was argued in writing rather than assumed.

**F9 — confirmed, and the falsifier is structurally unreachable.** Two
interruptions of a real driver against a real repository, placed
deterministically by pidfile rather than raced. Between gate and close: tracker
`- [ ]`, no commit, `git log --grep` empty. In the irreducible window — SIGTERM
after `git commit` returned but before `driver.py:661`'s journal write — the
tracker was `- [x]` **and** the commit was there. Neither produces "a ticked
tracker row with no commit behind it", and the second shows why none can: the
closer stages the tracker **into the same commit**, so the two cannot diverge.

**The refinement worth carrying.** `ADR-0022`'s wording implies the *tracker* is
what that window endangers. It is not — the **journal** is, and it carried no
`close` event after a real close had happened. `git log --grep <taskId>` found
the commit, so the resume guard the ADR names as its practical mitigation was
**observed working** rather than asserted. Both runs wrote a handover and
exited 1, so `TASK-0100`'s clean stop held under signal.

**Stated limit.** The model was stubbed, so the closer's *judgement* is
modelled; its disk effects — edit, stage, commit — were real, which is what
these claims are about. Measured on `opencode 1.18.32`, one patch above the
version F1/F2/F4/F5 were settled on.

## `ADR-0014`'s lint figure re-measured under 2.21.4 (`TASK-0115`)

**2026-09-27.** The caveat that has stood on `ADR-0014` since `REVIEW-0010` is
discharged. **53 rules, 15 tags, 0 failures, 0 warnings, exit 0** under
`ansible-core` 2.21.4 — identical to the 2.20.8 figure.

**The number holding is the expected result, not a reassuring one.** The rule
set belongs to `ansible-lint`, which never moved (26.8.0 throughout); only
`ansible-core` did. **What moved is the subject**: `TASK-0027` measured **2
playbooks**, this measured **17 playbooks and 19 roles** — 202 files of 204
processed. So the clean result now covers roughly eight times the content, and
the matching "53 / 0" must not be read as continuity: the old figure said
nothing about what has been added since.

**Two controls, because exit 0 is not evidence the rules ran.** The
silent-no-op trap `TASK-0027` needed four runs to find **still reproduces**: a
custom rule was loaded and listed (`-L` 53 → 54) and never evaluated, at exit
0; named in `--enable-list`, the same rule fired 17 times. And a deliberately
injected violation — an unnamed task using `shell` — **was caught**, exit 2,
with `fqcn`, `name` and `command-instead-of-shell` naming file and line. The
zero is measured, not silent.

**An arithmetic trap worth not repeating**: `--list-profiles` bullets from
`min` through `production` count **55**, because that listing includes sub-rule
tags and omits rules in no profile. `-L` gives 53 and is the figure `ADR-0014`
quotes.

**Method and its degradation, reproduced rather than re-decided.** Run on a
`/tmp/opencode/` copy, never in place; `.env`, `tools/` and every `vault.yml`
excluded, verified by `find`. With `vault_password_file` still set the run
fails at exit 2 with 36 `internal-error` results — the same artifact
`TASK-0027` recorded — so the figure comes from the second copy with that line
commented out. One deliberate change: `roles/` was copied, because the estate
now has 19 and had none before. The estate repository was verified untouched,
`HEAD` unmoved and porcelain empty, before and after.

**Raised, not fixed: `B-039`.** The estate's own `ansible.cfg` carries three
claims that are now false — most importantly that `ansible-config validate`
*rejects* `gather_subset`, when 2.21.4 accepts it **silently**. It is a
separate repository; the action is to report it, not to edit it from here.
`ansible-lint` **26.9.0** is available upstream and remains untracked.

## `worktree-only` is not enforced on Claude Code (`TASK-0111`)

**2026-09-27.** The measurement `ADR-0018` named as outstanding is done, and
the answer is **yes, a worktree-isolated subagent can read and write the main
checkout by absolute path**. `DENIALS: NONE`, so refusal and confinement stayed
distinguishable — the control `TASK-0056` lacked.

**Verified from the main checkout, not from the probe's report**: a file the
probe created is present in the main working tree, and tracked `LICENSE` moved
from md5 `85da8b3a…` to `994f2c99…`, 21 → 23 lines, both visible in
`git status`. Restored afterwards byte-identical, with `HEAD` unmoved.

**It confirms clause 8.2 rather than overturning it.** A role declaring
`worktree-only` still has no per-agent Claude Code target and its emission must
still fail loudly — but the reason is now that the confinement **demonstrably
does not exist**, not that no config key was found for it. `TASK-0107` measured
a different property, effect-isolation, and stands. Together: isolation confines
the accidental and does nothing about the deliberate, which is what the term
exists to deny.

**Still open under this heading, and it is now a decision rather than a
measurement:** whether those roles' Claude Code emission stays refused, the term
is redefined, or the roles stop declaring it.

**Two things worth carrying forward.** The harness raised a classifier warning
about the probe *after* the writes landed — detection is not denial, and a
reader could otherwise mistake the warning for a boundary. And the `B-035` gap
in the Claude Code binding is **not** settled by this: roles there are not
denied the skill, so OpenCode's embedding rationale does not transfer, but
absence of denial is not evidence a role would resolve the path, and the
sibling-file argument is about location rather than permission. `TASK-0113`
should observe its adjudicator before anyone acts on it.

## A binding's own checker was failing, ungated (`TASK-0112`)

**2026-09-27.** The Claude Code unattended-run binding's stub suite was **red
on `master` for two days** and nothing reported it. Found while scoping the
post-S10 queue into briefs, not by any check.

**The defect.** `98ce299` (`TASK-0103`, 2026-09-25) closed `B-032` by adding
the commit-file-list check, and in the same diff put a `must` into
`binding.md:126` citing `TASK-0103`. `check-binding.sh`'s `CITE` pattern does
not accept a task id — **correctly**, and that was confirmed before the fix
rather than assumed: `templates/binding.md` and `ADR-0022` clause 1.4
enumerate a binding's four legitimate rule sources (the loop, the skill,
`agents/`, the consuming repo's `AGENTS.md`), and a task brief is none of
them. So the checker was right and the binding was wrong. Fixed by citing the
real authority — `loops/unattended-run/loop.md` step 10's *"refuse on anything
unexpected"* — not by widening the pattern. **Cause proved before it was
fixed**: the pre-`98ce299` file passes the checker, the current one fails.

**The general finding, now `B-037`.** `tests/validate.sh` runs neither
binding's suite, so a red suite is invisible: three commits landed on top of
this one and the gate exited `OK` throughout. That is **stated doctrine**
(`authoring-guide.md:111`, and `SKILL.md` for `check-binding.sh`), so what is
new is the measured cost, not the fact. Wiring it in is not trivial — the gate
must stay fast, offline and hermetic, the OpenCode suite takes ~2m20s and
pulls `pytest` through `uv`, and `ADR-0009` forbids checking runtime presence,
so a `command -v` guard would produce the silently-skipping gate that ADR
calls worse than none. **Raised, not built.**

**A control worth recording:** `validate.sh` exits `OK` with the binding fixed
exactly as it did with it broken. That is the finding, not a regression check.
The OpenCode suite was green throughout.

## The repository now follows it (`TASK-0110`)

**2026-09-27.** `TASK-0109` built the mechanism and gated one artifact kind
from `TASK-0109` onward, so the repo shipped a convention it did not itself
follow. This closed that.

**The gap was measured before it was planned**, by running each schema over
every existing artifact: **27/27 ADRs and 30/30 sessions already conformed**,
11 of 12 reviews did, and 72 of 106 briefs did. So gating three of the four
kinds cost nothing but the decision to do it.

**All four kinds are now gated**, in one interpreter (`check-groups`), and
`FIRST_GENERATED_TASK` is **24**, not 109 — lowered *after* repairing the 11
modern briefs it newly covered. **`TASK-0001`–`TASK-0023` stay exempt and are
byte-identical**; `ADR-0012` and `FIRST_CONTRACT_TASK` own that exemption and
this task did not reopen it. 152 artifacts are checked each run.

**Nine briefs were repaired by disclosure, not reconstruction.** Each lacked
a section written *before* the work — `## Likely files` ×5,
`## Mandatory validations` ×2, `## Execution plan`, `### Attempt 1`. Each now
carries the heading plus a dated line saying it was not recorded. Rebuilding
them from git history was declined on the merits and by the human: a forecast
written after the work is an outcome wearing a forecast's label, and it reads
as evidence. All nine edits are **purely additive** — zero deletions.
`TASK-0108` had `## Status` moved (content proven identical by a sorted-line
diff); `TASK-0057`'s dead template scaffold was **demoted, not deleted**,
because someone had explicitly retained it.

**Two exemptions, named rather than absorbed into a number.** `REVIEW-0012`
is the only review of twelve that diverges — different labels *and* different
order, where the other eleven are byte-identical in order. Making it conform
means relocating sections inside a closed sprint's point-in-time record,
which the review schema's own write-once rule forbids; honouring a schema by
rewriting the artifact it describes is not compliance. A numeric boundary was
rejected as over-claiming. A second such exemption would be drift, not an
outlier.

**A regression in `TASK-0109`, found and fixed here.** Turning the review
template into a schema dropped its write-once rule, which had lived in the
copy-instruction blockquote and was discarded as if it were one. Restored to
both review schemas. **The general lesson:** when a template becomes a
schema, its prose must be triaged line by line into *instruction about
copying* and *rule about the artifact* — only the first may be dropped.

**Also fixed:** the gate's artifact list was first passed in `$GROUPS`, which
bash owns as a built-in array, so the assignment was silently dropped and
python raised `KeyError`. Renamed `ARTIFACT_GROUPS`.

**Cost, measured.** Native ext4 1.17 s → 1.36 s for 152 artifacts — 1.25 ms
each. On this `/mnt/c` working copy 2.79 s → 3.90 s; that delta is the 9p
bridge reading 152 files, not the checking.

**Still open:** `B-036` unchanged (the engine is unreachable from
`project-migration` alone). `ADR-0027` carries a dated clarification, since
two of its statements were true when written and are now false.

## Artifact shape has one owner (`TASK-0109`, `ADR-0027`)

**2026-09-26.** Planning artifacts are no longer produced by copying a
template and imitating it. A **schema** owns each artifact's shape — the
headings, their order, which are required, and whether each is written
before or after the work — and the templates are **generated from it**.

**The requirement that forced it**, from the human: the convention has to
hold for models from roughly 12b parameters to frontier. Copy-and-imitate
degrades with capability, because every "keep this line or delete it?"
judgment is an independent chance to drift. Fill-a-marked-slot does not.

**Three measurements motivated it, taken against the tree that day.**
`project-workflow`'s own template contradicted its `SKILL.md` about the task
ID format — `S###_SprintName.T###_TaskName` against `S###.T###_Name` — and
nothing caught it, because both were prose. This repo's 105 task briefs ran
102 to 661 lines with ~14 competing heading sets: `## Inputs` in 86 of them,
a `## Preconditions` superseded by `ADR-0012` in 23, and heading order
entirely ungoverned. `.ai/templates/ADR.md` was 71 bytes of bare headings
while real ADRs reach 37 KB.

**What shipped.** `skills/project-workflow/scripts/new-artifact.sh` emits a
skeleton with identifiers, date and every heading already correct;
`check-artifact.sh` proves a finished artifact conforms, reading the headings
*from the schema* so it can never become their second owner;
`scripts/sync-templates.sh` regenerates all seven templates. Eight schemas
across both frameworks — they stay separate, per `ADR-0013`; only the engine
is shared. `tests/validate.sh` gained a template-staleness check and a brief
shape check bounded by `FIRST_GENERATED_TASK = 109`.

**`--guidance`, not `--tier`.** Four prose densities (`terse`, `standard`,
`explicit`, `literal`) vary only the text inside `<!-- FILL: … -->` comments;
the filled artifact is byte-identical at every level, verified by generating
all four, stripping comments and diffing to one hash. The flag is deliberately
not named for parameter counts: `scripts/emit-agents.py` already emits an
unresolved `{tier:<name>}` and the authoring guide forbids a second
tier→model owner here (`ADR-0018` clause 7, `ADR-0017` rejected). The
model-size column in `SKILL.md` is documentation, not a resolver.

**Limits, stated.** Shape is checked, never content — a conformant brief can
still say nothing, and the checkers say so in matching *what this does not
prove* paragraphs. **No size budget was added anywhere**; `ADR-0008` forbids
a gate inventing a number, so uniform shape is enforced and smaller files are
a consequence rather than a rule. The templates in fact grew — `.ai/templates/
ADR.md` 71 → 1297 bytes — because they now describe the artifact. Only task
briefs are gated; ADR, review and session schemas exist and generate, but
nothing checks the finished files. The 105 pre-existing briefs are untouched
and exempt, for the reason `FIRST_CONTRACT_TASK` already carries. **`B-036`
is open**: the engine lives in `project-workflow`, so a consumer installing
only `project-migration` gets schemas with no generator — nothing is broken
here, and it is not built for an absent consumer.

**Gate cost, measured rather than assumed.** On a native ext4 copy, 1.03 s →
1.32 s; on this `/mnt/c` working copy, 2.25 s → 2.79 s. The two new passes
cost 0.225 s between them; batching each into one interpreter rather than one
subprocess per file gave back 1.4 s of a first attempt that had spawned seven.

## Post-S10 housekeeping and two routed items

**2026-09-26.** With no sprint open, three things were closed or started on
the human's instruction to close loose ends.

**Housekeeping (`7a59f8c`).** The leftover `agent/pilot` worktree from the
S10.7 pilot was removed — clean, and with no commits `master` did not have.
`.claude/` was added to `.gitignore`: everything under it is either
machine-specific (`settings.json` carried absolute `/mnt/c/...` paths and a
permission grant for a worktree that no longer exists) or an emission whose
source is tracked elsewhere. `.claude/skills/` and `.claude/agents/` were
**rejected outright when S7 was planned**, and `.claude/workflows/` is where
the Claude Code binding is emitted from
`skills/unattended-ops/templates/bindings/claude-code/`. The rationale sits
beside the entry, as `.graphify/`'s does.

**`B-035` closed by `TASK-0106`.** The human chose **embed the references**
over accepting the standard as body-plus-enum. The adjudicator now receives
`references/verdicts.md` and `references/evidence.md` verbatim in its step-9
prompt. It cannot read them itself — `worktree-only` denies the skill, which
is why `prompt()` tells every role not to try — and `driver.py` is a template
a consuming repository copies out, after which the references are at no known
relative path. So the text ships as a **generated sibling file** that travels
with the copy, and `tests/validate.sh` fails when it drifts from its two
sources. That is `docs/registry.md`'s arrangement: a derived copy is
allowed exactly as long as a gate proves it still matches.

**The check was wrong the first time, and the gate caught it.** It was
written with `git diff --quiet`, which reports no change for an **untracked**
file — so it would have passed vacuously for as long as the generated file
went uncommitted. A check that cannot fail is this repo's most-repeated
lesson and it recurred here; replaced with generate-to-scratch-and-`cmp`,
which does not depend on tracking. Recorded as a deviation in the task file.

**A red proof was also wrong the first time.** Reverting the embed by hand
broke `driver.py`, so the test failed with `IndexError` before the
adjudicator was ever invoked — a failure for the wrong reason, which proves
nothing. Redone against the genuine pre-change step 9: `AssertionError` on
the exact assertion, with the run completing normally.

**The Claude Code binding has the same gap and was deliberately left.** Its
`step9Adjudicate` carries the enum and schema only. Whether *its* roles can
read the skill turns on the `worktree-only` question below, so fixing it now
would risk building a workaround for a denial that may not exist there.

**`TASK-0107` ran, and the measurement is clean.** `TASK-0056` was
confounded by permission denials; this time denial-reporting was an explicit
instruction to the probe and the result was `DENIALS: NONE`, so confinement
and refusal are distinguishable. **A worktree-isolated subagent's commit does
not reach the real tree**: verified from the main checkout, `master` unmoved
at `5d51e2d`, the probe commit not an ancestor, the file absent. The object
database and ref namespace *are* shared.

**It does not settle the emission, and saying so is the point.**
`worktree-only` denies *access* outside the worktree; what was measured is
*effect-isolation* — where a commit lands. The probe's worktree sat inside
the main repository and nothing stopped it reaching the main checkout by
absolute path; that was not tested and is not assumed. `ADR-0018` clause 8.2
stands and the term table still reads "no per-agent equivalent". The next
measurement, if this is picked up, is named in the ADR: can such a subagent
read and write the main checkout by absolute path?

**An unasked-for finding with teeth.** Claude Code creates its worktree
**inside** the repository (`.claude/worktrees/agent-<id>/`), the placement
`docs/operations/runbook.md` forbids for this repo's own `worktree.sh`. Both
feared consequences were checked and neither bit — the component globs are
one level deep, `validate.sh: OK`, registry byte-identical — and `git status`
stayed clean **only because `TASK-0106` had gitignored `.claude/` hours
earlier**. That is luck, not design: `Driver.step1_preflight_repo()` refuses
a dirty tree, so without that ignore an unattended run using worktree-isolated
subagents would refuse to start.

## The `ansible-core` version count, re-counted and closed

**`TASK-0108`, 2026-09-26.** `SPRINT-CURRENT.md` item 6's own instruction was
**"re-count before acting"**, and the count is why it closes rather than
sweeping again.

**Live version, confirmed by running the binary today**, not cited:
`ansible-lint 26.8.0 using ansible-core 2.21.4` — unchanged since
`TASK-0069`'s 2026-09-23 check.

**The trajectory: nine (`REVIEW-0010`) → five (2026-09-23) → three today**,
in two files. The other **~38 mentions are dated records** — task logs,
reviews, session notes, archived sprints, `ADR-0014`'s evidence section — and
are **correct as written**. Not touching them is the finding, not an
omission: a bulk replace of `2.20.8` would have destroyed accurate history
and made this repo claim things were observed that were not.
`skills/ansible-ops/references/hazards.md` and `ADR-0014` were already
correct — `TASK-0069` and `TASK-0054` respectively — and were left alone.

**The one that mattered was not a version number.**
`docs/design/ansible-ops-brief.md` asserted that `gather_subset` in
`ansible.cfg` `[defaults]` is *"rejected as an unknown key"*. `TASK-0069` had
already disproved that by re-running it: under 2.21.4 the setting is accepted
**silently** — exit 0, no error, no warning, and `ansible_mounts` still
collected. That is **worse than the brief describes**, because the rejection
it promises is a diagnostic an operator would rely on and no longer receives.
The brief is `status: accepted`, so it was corrected in `TASK-0069`'s shape:
the accepted text stays visible and a dated correction sits beside it.
`ROADMAP.md`'s "recorded nine times" was the third stale claim.

**What survives under this heading is a measurement, not a sweep**:
`ADR-0014`'s standing caveat that the "53 rules / 0 real violations" figure
has never been re-run under 2.21.4. Separately noted and deliberately not
acted on — `ansible-lint` **26.9.0** is available upstream and nothing in
this repo tracks it.

## Sprint S10 is CLOSED

**`TASK-0105`, 2026-09-26.** Closed on `REVIEW-0012`, archived to
`.ai/planning/sprints/SPRINT-S10-unattended-bindings.md`, with **Phase 10
marked COMPLETE in the same commit** — the same atomic-commit control every
promotion and closure since `TASK-0077` has used.

**Six of seven exit criteria met; criterion 3 stays partly met**, carried
into the closure exactly as `REVIEW-0012` found it rather than upgraded:
the OpenCode binding enforces the command boundaries its roles declare, but
two declared boundaries do not hold (bulk staging; a role reading the gate
map), and the Claude Code binding was never exercised against a real run.

**S10.4 was the sole closure blocker `REVIEW-0012` named, and `TASK-0104`
discharged it the day before this closure** rather than the sprint closing
over an unstarted deliverable. Established, against the live artifact:
Bionic has no externally scriptable surface — CLI, REST, OpenAI-compat,
Anthropic-compat, MCP-via-API, or SDK — that creates a project, session, or
orchestrator outside a live GUI chat turn, so it cannot be a binding's
target.

**Promoted `TASK-0085`, 2026-09-23.** S10 executed where S9 declared: it
shipped runnable code, registered a server that can launch a seventy-minute
build, and ended with a real unattended run against a real repository —
this repo itself, on the human's choice.

**Four stale claims were corrected at promotion**, two of which would have
cost real work: **S10.1's contract, checker and fixtures already shipped**
(`TASK-0062`, with the red-then-green proof already run), so only the
**OpenCode driver** remained; `TASK-0059` was done; Bionic's snapshot already
recorded its coverage, so S10.4 owed *establishing* the orchestration claim
rather than writing the section — done by `TASK-0104`; and half the
pre-committed checkpoint question was already answered in S9 and was
**replaced** with one this sprint answered partly — whether a binding
reintroduces what the role boundary denies, given `git add -- .` survives
only as prose.

**`B-035`, raised 2026-09-25 while closing `B-029`, was not carried forward
by the outgoing sprint file's own carried-forward section** — caught by
reading the backlog directly at closure rather than trusting that list, and
now in the fresh `SPRINT-CURRENT.md`.

## S10.4: Bionic cannot orchestrate — established, not dropped

**`TASK-0104`, 2026-09-25.** The claim `PLAN-0006`, `ADR-0022` and the Bionic
snapshot had all deliberately left unestablished is now checked against the
live artifact and confirmed. **No externally scriptable surface exists**:
`lms.exe`'s full subcommand tree is model/server/runtime management only;
the documented REST v1, OpenAI-compat, Anthropic-compat and MCP-via-API
endpoints (re-read 2026-09-25) are inference and in-chat tool-calling only.
None creates a project, a session, or an orchestrator.

**Bionic's orchestrator is real, and the finding is precise about that.**
A bundled system prompt (*"You are the orchestrator agent … help the user
create 'sessions'"*) paired with a `session_control` skill exposing
`bionic_tool` calls does exist — but every call in it is something the model
**inside an active Bionic chat turn** invokes; nothing external reaches it.
The claim is "no external entry point," not "no orchestration concept,"
which is the distinction that keeps the finding honest.

**The trap named and avoided:** LM Studio's SDKs ship `model.act(prompt,
[tools])`, a real agentic primitive that could be wired to hand-rolled
functions. That would not be a Bionic binding — `.act()`'s tools carry
**zero client-enforced permission boundary**, so the calling script would
implement the entire boundary itself, borrowing none of Bionic's own
mechanism. It would be a new, unenforced driver using an LM-Studio-served
model as a backend, not a binding into this client.

`configs/lm-studio-bionic/README.md` carries the full evidence;
`ADR-0022`'s existing Consequences bullet gets one dated verification
pointer, left otherwise as written.

## S10.1: the OpenCode binding ships — proven against a stub, not a client

**`TASK-0086`, 2026-09-24.** `skills/unattended-ops/templates/bindings/opencode/`
holds `driver.py`, the `run-gate.sh` entry point, `binding.md`, and 23
hermetic tests; skill `1.1.0`. Rule 2 is structural (the driver runs the gate;
prompts carry handles, never a command), a silent refuter fails closed, and the
driver issues no git write — each shown by a test that fails when the behaviour
is reverted (18 reverts, all red).

**What this does not establish:** everything runs against a *stub* `opencode`.
Phase 10 criterion 3 (*"demonstrated against an emitted file and a real run"*)
stays open until the pilot. The nine roles are **not yet emitted** to
`~/.config/opencode/agents/` — that is S10.5, and the pilot needs it first.

**A finding for the human, not resolved:** loop step 7 and `agents/gate-runner/`
say the gate-runner invokes the entry point; `ADR-0022` and
`references/gate-map.md` say the driver does. The binding follows the ADR (the
loop says the ADR wins) and records it as deviation 1.

## The post-review backlog pass (2026-09-25)

The human asked for every open backlog item to be completed, and made the
four design choices in one sitting (multiple choice): `B-029` — stop pointing
roles at the skill; `B-031` — a fixed commit placeholder the driver checks;
`B-025` — leave open, its readiness condition unmet; `B-034` — draft the
upstream report, the human files it.

- **`B-030` closed — `TASK-0098`.** No file a run role can reach holds a gate
  command: the OpenCode driver refuses a map inside the repository, and
  `run-gate.sh` no longer copies each gate's argv into the run directory
  (`spec.json`) — a second leak found while scoping. Rests on
  `external_directory: deny`, observed for reads outside the worktree by the
  pilot; a live check against a map specifically **stalled twice** in this
  session and is not established.
- **`B-031` closed — `TASK-0099`.** The closer writes two fixed log lines
  the driver hands it — `Commit: pending — recorded at landing (run <id>)`
  and `Push: not taken — the run pushes nothing` — and the driver halts on
  any other `Commit:`/`Push:` entry in the committed task file. **Landing an
  unattended run now owes a follow-up commit** replacing them with the landed
  hash (`docs/operations/runbook.md`).
- **`B-033` closed — `TASK-0100`.** Optional per-role `role_timeouts:`;
  **to stop a run, signal the driver** — it kills the role call's process
  group, retries nothing, and writes a *STOPPED* handover itself; a role
  killed from outside halts the run instead of being retried.
- **`B-029` closed — `TASK-0101`; `B-035` raised.** No run-role body tells
  it to open the skill, and every OpenCode prompt says not to. **The gap it
  exposed:** the adjudicator's decision standard (`verdicts.md`,
  `evidence.md`) is not in its prompt either — it never reached the role in
  the pilot — and that route is the human's.
- **`B-034` closed — `TASK-0102`.** Emitted OpenCode roles with a shell
  allowlist now end with a generated list of the commands they may run and
  *quote path arguments*. **An upstream report for OpenCode is drafted in
  `TASK-0102`, not filed** — filing is the human's.
- **`B-032` closed — `TASK-0103`.** The Claude Code binding now halts on a
  closed commit holding an undeclared path, as the OpenCode driver does
  (`TASK-0097`); the file list comes from the preflight witness.
- **`B-025` re-statused `waiting`** (its second-role condition is unmet).
- **Re-emitted** with `scripts/install.sh link` (exit 0): nine roles to
  `~/.config/opencode/agents/`, three to `~/.claude/agents/`; the live
  `closer.md` carries the generated command list and `log_lines`, and both
  clients' `adjudicator.md` the revised standard paragraph — checked by grep.

**Open after the pass:** `B-035` (`ready` — the adjudicator's standard, the
human's route) and `B-025` (`waiting`); the drafted OpenCode report in
`TASK-0102`, unfiled. S10.4 is now done (`TASK-0104`); all eight of S10's
deliverables are complete, and closing the sprint is the human's decision.

## REVIEW-0012: S10's work approved; the sprint was held open for S10.4

**2026-09-24.** Six of Phase 10's seven exit criteria met; **criterion 3
partly** — the OpenCode port enforces what its roles declare, but two
declared boundaries do not hold (the closer may `git add -- .`; a role may
read the gate map). The first is now caught by the driver (`TASK-0097`),
the second is `B-030`. Six backlog items raised, `B-029`…`B-034`. **S10.4
(Bionic) had not started** at review time; it is now done (`TASK-0104`,
2026-09-25), so closing the sprint is the human's call rather than blocked
on an unstarted deliverable.

## S10.7: the pilot closed two real tasks unattended — and found eighteen things

**`TASK-0092`, 2026-09-24.** The OpenCode binding ran `loops/unattended-run/`
against this repository: three dry runs (two correct halts, each fixed —
`TASK-0095`, `TASK-0096`), a first live run stopped by the human, and a rerun
that **closed `TASK-0093` and `TASK-0094`** with verified commits, all gates
green, nothing pushed; landed on the human's authorization (`57dbd49`,
`ec0efa4`). **Believed because it found things:** OpenCode's glob tool cannot
see `.ai/`; a user plugin's OAuth silently stalled runs; roles cannot read the
skill (57 wasted denials); the closer wrote a false self-claim; and **Phase 10
criterion 4 is answered no** — the closer's permissions allow `git add -- .`
(quoted or not), observed live; the driver does not check a commit's file
list.

## S10.5: installed for both clients; gates connects in both, and is wired in neither

**`TASK-0090`, 2026-09-24, on the human's choices** (`link`, both clients;
verify then unwire; pilot target ai-toolbox itself). `install.sh link` exit 0:
`unattended-ops` in both skill dirs, `task-planner` + `adjudicator` in
`~/.claude/agents/`, all nine roles in `~/.config/opencode/agents/`, each
`(primary)` in `opencode agent list`. The emitter's refusal path was proven
first. `gates` reported connected in Claude Code and OpenCode, then both
registrations were removed; `opencode.jsonc` untouched. `ADR-0022` F6
**confirmed**, F8 two of three clients. A stale `~/.claude/agents/designer-manager.md`
was found and, on the human's decision (`TASK-0091`, `ADR-0026`), the emitter
now prunes a role's file from a client the role no longer declares — which
removed it.

## Who starts a gate is decided — `ADR-0025`

**`TASK-0089`, 2026-09-24, the human's decision.** The driver starts a gate
wherever it has a shell; the gate-runner only where it has none; the entry
point always writes the evidence and the gate-runner only reads it. The loop,
the role, `gate-map.md`, `evidence.md` and both bindings now say so; no code
changed. `agents/gate-runner/`'s `*run-gate.sh*` allowlist is wider than an
OpenCode gate-runner now needs, and **the human chose to keep it** (small
reach; a driver-less binding needs it) — reason recorded in the role file.

## S10.3: the first authored MCP server ships — and the template it was copied from was broken

**`TASK-0088`, 2026-09-24.** `mcp-servers/gates/` runs a consuming
repository's gates by **name**, detached behind a watchdog, with evidence
byte-compatible with `run-gate.sh`. Destructive (`start_gate`, `kill_gate`),
**authorized by the human** in its task file, and — by that authorization's
one condition — **wired into no client**; S10.5 wires it. `ADR-0024`
supersedes `ADR-0010`; `ADR-0022` F8 is **partly** settled (harness PASS, no
client yet).

**Walking the authored path found what reading could not:** the template
could be neither built (no `__init__.py`) nor imported (`mcp>=1.0` now
resolves to mcp 2.x). Both fixed. `smoke-mcp.sh` now handshakes authored
servers, the wiring gate reads both shapes (carried item 4, closed), and the
launch form is `uv --directory <dir> run <dir>` everywhere.

## S10.2: the Claude Code binding ships — weaker by construction, and says where

**`TASK-0087`, 2026-09-24.** `skills/unattended-ops/templates/bindings/claude-code/`
holds the `unattended-run.js` Workflow template, `binding.md` and 23 tests
against a stub runtime; skill `1.2.0`. `task-planner` and `adjudicator` run as
their own agent definitions via `agentType`; the other seven are prompt-level.
Rule 2 is **instructed** here, not structural. Both bindings share
`run-gate.sh` and one evidence format.

**The gate-invoker disagreement is now resolved in opposite directions** by
the two bindings, each for a stated reason — still a decision for the human.
**`node --check` is vacuous** on a workflow-shaped file; do not cite it.

## Sprint S9 is CLOSED

**`TASK-0081`, 2026-09-23.** Closed on `REVIEW-0011`, archived to
`.ai/planning/sprints/SPRINT-S9-unattended-runs.md`, with **Phase 9 marked
COMPLETE in the same commit** — the same atomic-commit control the promotion
used, since nothing mechanical enforces roadmap/sprint agreement.

**All seven exit criteria met, and the order matters.** `REVIEW-0011` found
**criterion 7 unmet** — the OpenCode-first asymmetry was stated in the skill
and in none of the three wiring snapshots — and recommended fixing it before
closure. `TASK-0080` did. **A sprint that closes over its own unmet criterion
teaches the next sprint that criteria are advisory.**

**No sprint is open.** S10 is queued and allocates no task ids. **Nothing runs
unattended yet**: S9 delivered the portable core, every binding is S10, and
none exists — all three `configs/*/README.md` now say so.

**Both post-S9 decisions are now taken.** `TASK-0083` closed two of the three
trailing-flag holes (`--amend` into `no-force-push`, `--no-verify` into a new
`no-bypass` term) and recorded the third — `git add -- .` — as **not closable
at the glob layer**, after verifying that an equal-length deny loses. And
**`ADR-0023` is `Accepted`** (`TASK-0084`), ratified on the evidence S9
produced: five concurrent sessions in their own worktrees, landed serially, no
index collision. `AGENTS.md`'s git rule was updated in the same change.

## What S9 delivered, and the finding that outlived it

**`REVIEW-0011`, 2026-09-23.** The sprint delivered its portable core: one
loop, one skill with seven references and a working checker, nine roles, two
vocabulary decisions, three closed backlog items, and a twelfth capability
term that exists because the sprint caught itself shipping a boundary that
did not hold.

**Six of seven exit criteria are met. Criterion 7 is not** — and it is the one
the pre-committed question targeted. `skills/unattended-ops/SKILL.md` states
the OpenCode-first asymmetry plainly; **none of the three
`configs/*/README.md` mentions the unattended harness at all.** The question
guarded against describing three clients as equivalent; what happened is
**silence, which reads as equivalent by omission**. A Claude Code user reading
their own wiring snapshot learns nothing about seven roles they will never
receive.

**`REVIEW-0011` recommends fixing that before closing S9**, rather than
closing over a stated exit criterion. **Closure is a human decision**, as
promotion was.

**The sprint's defining finding: the false-boundary defect class appeared four
times** — `qa-test` (`B-021`), `designer-manager` (`B-028`), `read-only` not
stopping a shell, and `git-ops`'s `no-force-push` covering push only. Four
mechanisms, one shape: a component's self-description outrunning its
enforcement. **Three were caught by resolving what a declaration actually
produces rather than reading the declaration**, which should now be the
standard move for capability work.

**Three holes remain open** and affect two roles: a prefix glob cannot
constrain a trailing flag, so `git commit -m x --amend`,
`git commit -m x --no-verify` and **`git add -- .`** all resolve to *allow*.
The last bulk-stages through the pattern meant to prevent bulk staging.
Closing them means editing `no-force-push`'s map in the emitter, changing four
roles' boundaries — a decision, not a task.

**`ADR-0023` now has its evidence.** Five concurrent sessions ran in their own
worktrees and landed serially by rebase, with no index collision — the failure
it was written for, which had happened twice before the mechanism existed. It
is still `Proposed`.

## Three S9 tasks ran in parallel and landed

**2026-09-23.** `TASK-0058`, `TASK-0060` and `TASK-0061` ran **concurrently,
one git worktree each** (`ADR-0023`) and landed serially by rebase, so
`master` stayed linear with one commit per task. First real use of the
worktree mechanism `TASK-0070` built.

- **`mode: all` is REJECTED** — `ADR-0022` clause 5.2 required the decision to
  be explicit, and this is it. `mode` is a portability declaration, not a
  passthrough of OpenCode's field, and it is load-bearing for a safety rule:
  `delegation-allowlist` is valid only with `primary` because Claude Code
  ignores an `Agent(...)` allowlist inside a subagent definition. **`all`
  means both**, so the boundary would be enforced or silently widened
  depending on how the role happened to be invoked. `MODES` is unchanged.
- **`worktree-only` for Claude Code remains unsettled, explicitly.** Both
  available answers would have been decided on `TASK-0056`'s confounded
  evidence. The question that settles it is now written down: **does a
  `worktree`-isolated subagent's commit reach the real tree?**
- **The registry shows client coverage** — `| Name | Clients | Description |
  Path |`, closing `B-026` and `ADR-0018` clause 8.5. Four of six roles are
  visibly `opencode`-only. **`B-026`'s own stated justification was wrong and
  was corrected:** "`validate.sh` constrains `clients` to a closed set" does
  not separate it from `mode`, which is closed-set checked too. The separator
  is the **emitter** — `clients` gates emission (a role omitting a client gets
  **no file written**) while `mode` is merely carried through.
- **`loops/unattended-run/loop.md` exists** — 14 steps, nine roles, three
  deliberately unmerged retry bounds, and a **null refuter that fails closed**
  (the driver synthesises `refuted: true` rather than reading silence as
  consent).

**One correction applied at landing:** the loop named its ninth role `scribe`
while `PLAN-0006`, `SPRINT-CURRENT.md` and `TASK-0064`'s brief all say
**`run-scribe`** — left alone, `TASK-0064` would have authored a role the loop
never cites. Renamed in the loop.

**Two defects found in passing, recorded not fixed:**
`loops/release-check/` step 8 says to write a commit hash back *"and amend"*,
which changes the hash just recorded; and `install.sh`'s authored-MCP launch
line has **two** form discrepancies, both assigned to `TASK-0067`.

## Sprint S9 is OPEN

**`TASK-0077`, 2026-09-23.** Promoted, with `ROADMAP.md`'s **Phase 9** added
in the **same commit** — the only control that exists for that pairing, since
`validate.sh` has no roadmap/sprint check and is not getting one. All seven
outstanding briefs (`TASK-0058`…`0064`) were confirmed present by counting
them, which is step 4's precondition.

`sprints/SPRINT-S9-unattended-runs.md` is **deleted**; its content now lives
in `SPRINT-CURRENT.md` and returns to `sprints/` at closure, the way S6 and
S8 moved. **Five stale claims were corrected rather than inherited** — most
importantly *"six of the ten capability terms"* (now seven of eleven) and
`TASK-0059`'s `delegates_to` check, which `TASK-0075` already built.

**Three front doors are open at once:** `TASK-0058`, `TASK-0060` and
`TASK-0061` all depend only on the cleared gate. Two sessions working them in
parallel need **one worktree each** (`ADR-0023`).

## S9's spikes have run and `ADR-0022` is ratified

**`TASK-0055`/`0056`/`0057`, 2026-09-23.** S9 is **not promoted** — the
spikes ran because they are the evidence its gate needs and they change no
component file. **That gate is now cleared: `ADR-0022` was ratified as
written on 2026-09-23** (`TASK-0076`), after the spikes had run and the draft
had been corrected against them — so what was signed is **more cautious than
the draft**, not less.

**Ratification unblocked `TASK-0058`, `TASK-0060` and `TASK-0061` without
scheduling them, and did not promote the sprint.** Promotion is a separate
decision and needs `ROADMAP.md`'s Phase 9 written in the same change.

**Two questions were carried into ratification rather than closed by it:**
whether `mode: all` is admitted to this repo's schema (clause 5.2 makes
`TASK-0058` decide it **explicitly**), and whether
`push-requires-confirmation` survives in the vocabulary at all, now that an
unattended `ask` is known to auto-deny while blaming an absent human. A third
item is a gap rather than a question — **`isolation: worktree` is still
uncharacterised**, and all nine S9 roles declare `worktree-only`.

**F1 is FALSIFIED, and it is the finding with teeth.** `opencode run --agent`
**cannot** select a `mode: subagent` role: it warns on stderr, **falls back to
the default agent**, and returns well-formed output with exit 0. A driver
reading stdout or the JSON stream **cannot tell the wrong agent answered**.
Every driver-invoked role must be `primary`. `mode: all` turns out to be a
real third value OpenCode accepts and `tests/validate.sh`'s `MODES` rejects,
so `TASK-0058`/`TASK-0059` now owe a schema decision.

**F5 is CONFIRMED and it is a live defect, raised as `B-028`.**
`~/.claude/agents/designer-manager.md` ships `tools: Agent(ideator, critic,
git-ops)` while `git-ops.md` does not exist for that client, and Claude Code
says **nothing**. A control naming only an absent delegate got 0 bytes of
stderr and ended up with **no delegates at all**. The silence is real, not an
artifact: `claude -p --agent <absent>` fails loudly with exit 1.

**Two things that will bite a binding author, both found by failure:**
`opencode run` with no configured default model and no TTY **hangs forever —
no output, no error, no exit**; and an `ask` permission headless **auto-denies
and reports "The user rejected permission" with no user present**, so
unattended every `ask` is a `deny` wearing a false attribution.

**F4 confirms the closer's staging boundary and constrains it:** `git add -A`
and `git add .` are denied as intended, but so is `git add ./sub/b.txt` — the
allowlist mandates the `--` form for *every* legitimate staging command.

**`isolation: worktree` is still open**, and now openly so: `TASK-0056` tried
and the attempt was confounded by permission denials. All nine S9 roles
declare `worktree-only` and the acting roles must commit, so it cannot be
reasoned out.

**The unscheduled backlog queue is empty.**

## A delegate must exist for every client its caller is emitted for

**`TASK-0075`, 2026-09-23.** `B-028` closed — the live instance fixed and the
class gated. `agents/designer-manager/agent.md` is now `clients: [opencode]`,
and `tests/validate.sh` gained a **cross-role** pass: the only agent rule that
must see two files at once, because `designer-manager` was valid, `git-ops`
was valid, and the *pair* was broken.

**The check was written before the fix and fired on the real defect**, exit 1.
A check first demonstrated on an invented fixture has only been shown to catch
inventions.

**`loops/design-brief/` is now OpenCode-only**, and that is a real capability
loss stated in both wiring snapshots rather than buried. `git-ops` cannot have
a Claude Code form (`bash-allowlist`, `ADR-0018` clause 8.3) and `ADR-0019`'s
lock commit needs it. The honest framing: **the loop did not work on Claude
Code before; it only looked as though it did.**

**Two things left behind deliberately.** `~/.claude/agents/designer-manager.md`
is now stale on any machine that installed it and **`install.sh` will not
remove it** (clause 4 forbids a freshness check) — the snapshot carries the
`rm` command, and the task did not delete from the user's client config
itself. And this **made `B-026` worse**: four of six roles are now
OpenCode-only while `docs/registry.md` still presents all six identically, so
`TASK-0060` is more urgent than when it was scoped.

## One guard pair for both command allowlists, and a self-correction

**`TASK-0074`, 2026-09-23.** `B-027` closed. `bash_allow` and `test_allow` are
now checked by **one function**, so the two cannot drift: both directions of
the iff, non-emptiness, and two entry guards — no bare `*`, no shell chaining
metacharacter.

**It also corrected `TASK-0071`, three tasks after it shipped.** That task's
wildcard guard rejected every entry *beginning* with `*`, while its stated
reason — an allowlist must not open universal — supports rejecting only a
**bare** `*`. `*pytest*` is narrow and legitimate and was being rejected. **A
rule that fires on a legitimate case gets deleted by the next author rather
than argued with**, so it was narrowed at the same time as it was extended.

Eight cases observed across the two keys, including `*pytest*` **accepted** as
the regression test. `git-ops`, `review` and `qa-test` — the three roles that
actually carry `bash_allow` — pass **unchanged**, and no role file was edited.

## A server owes a wiring section only under three conditions

**`TASK-0073`, 2026-09-23.** `B-023` was blocked on a rule that did not
exist: does *every* `mcp-servers/` entry owe three client sections? The
answer is **no** — one is owed when a server declares a required environment
variable, a destructive capability, or a launch a client cannot perform from
the manifest alone. The first two are **gated**; the third is judgment and
deliberately is not, because a check that cannot really decide is a check
that cannot fail.

**The rule changes no file's content, and that is the argument for it.**
Measured before it was written: `ansible` triggers two conditions and has
sections in all three snapshots; graphify triggers none and had none. The
rule describes the arrangement that already existed rather than imposing a
new one — so `B-023` closed **without writing the three sections it named**,
which is what the item itself asked for.

**Two things the gate got right only by being tested.** Its `_template*`
carve-out is load-bearing: `_template-external` declares a required variable
and appears in no snapshot, so without it the gate would fail on a clean
checkout — `ADR-0009`'s forbidden shape, inside a check written to enforce
documentation. And the first version matched the server name **anywhere in
the file**, while the same task added a pointer naming graphify *to explain
that it has no section* — so the sentence denying a section would have
satisfied the check. Tightened to require a heading, and the tightening was
proved with a mention-only fixture that still failed.

## Skills deploy to Bionic projects; Bionic's global target stays manual

**`TASK-0072`, 2026-09-23.** `scripts/install.sh --client lm-studio-bionic
--bionic-project DIR` writes `DIR/.agents/skills/`, in `link` or `copy`,
idempotently, under the same overwrite policy as every other client. **A run
without the flag touches no Bionic path** — observed, not assumed.

**The global target is not automated, and that is the closure rather than
what is left.** Bionic routes global installs through an approval-gated
`skill.install` prompt (*"DO NOT edit global skills directly"*), which a
non-interactive installer cannot drive; writing `~/.lmstudio/skills/` anyway
would circumvent a vendor control rather than support the client. No script
here writes it.

**A second, independent reason, found while closing it: `$HOME` is the wrong
home.** `~/.lmstudio/` **does not exist** at the WSL `$HOME`; the real,
empty directory is at `/mnt/c/Users/<user>/.lmstudio/skills/`, the Windows
home. Every `CLIENTS` row is built from `${HOME}`, so a global Bionic row
written the obvious way would point where Bionic never looks — **and would
succeed**, creating an empty directory nothing reads. This is why
`--bionic-project` takes an explicit path instead of deriving one, and why
`configs/lm-studio-bionic/README.md`'s "exists and is empty on this machine"
needed a which-home qualifier.

**Bionic is still not in the `CLIENTS` table**, so `validate.sh`'s
client-pairing parse still sees exactly two clients. Every row there is a
`$HOME`-global target the script probes for existence; a per-project target
has no such location, so a row would have had to invent one.

**Not verified, and not claimed: that Bionic *loads* a skill deployed this
way.** Files observed landing at the vendor-documented path; the client was
not run. A human verification step of the `TASK-0016`/`0017` shape.

## The capability vocabulary has eleven terms, and `qa-test` can run tests

**`TASK-0071`, 2026-09-23.** `B-021`'s defect — a role whose description said
it *runs* tests over a `bash_allow` that denied every test command — is
closed by an eleventh term, **`test-allowlist`**, with its own `test_allow`
key. Definition in the authoring guide, then the gate, then the emitter, in
`ADR-0008`'s order.

**The term is deliberately narrower than `bash_allow`, or it would have been
a rename.** `B-021` forbade resolving it as `bash: allow`, so two properties
of `test_allow` entries are gated and `bash_allow`'s are not: **no entry may
be or begin with `*`**, and **none may contain a shell chaining
metacharacter**, or `pytest; rm -rf /` is one "test command". All five new
failure modes were **observed failing** against a passing negative control.

**It stays OpenCode-only, and the emitter refuses rather than degrades.**
Naming commands is intra-`Bash` granularity; Claude Code grants or withholds
whole tools. A Claude Code `qa-test` would ship with unrestricted `Bash` —
*wider* than its description implies — so refusal is the honest outcome, and
was observed. Note the division this confirms: `validate.sh` **accepts** a
role declaring the term for `claude-code`; term/client compatibility is the
emitter's job by design (ADR-0009 keeps the gate to source completeness).

**The ceiling is in the guide, not just in the task log:** the term bounds
the command surface the agent may type, **not** what the tests themselves
execute. No per-agent model can do the latter — running a test is running
arbitrary code.

**Side finding: `agents/shell-runner/` has never existed.** The authoring
guide asserted *"`git-ops` and `shell-runner` are OpenCode-only roles"* in the
present tense, while this file's own S7 section records the role as **not
authored**. Found only because the task was editing that sentence for another
reason and checked the name instead of reusing it. The guide now names
`git-ops`, `review` and `qa-test`. **`ADR-0017` and `ADR-0018` still say
`shell-runner` and are left alone** — a decision record states what was
decided when it was decided.

**Raised: `B-027`** — `bash_allow` has both of `test_allow`'s hazards and
neither guard. Left open rather than fixed in passing, because closing it
changes the emitted boundary of `git-ops` and `review`.

## Each agent session now gets its own worktree — and every script is executable

**`TASK-0070`, 2026-09-23.** Two sessions shared this checkout and it cost
work twice in two hours: `TASK-0068` had to renumber, and `TASK-0069` found
**sixteen of the other session's files staged in the shared index**,
mid-commit-preparation. A git index has no locking between sessions, so the
failure mode is not a merge conflict — it is **one session committing
another's half-finished work**, producing a *green* commit that no gate here
can detect.

`scripts/worktree.sh add|list|remove` creates one worktree per session as a
**sibling** of the repo, on `agent/<name>`. Two exist: `s9` and `maint`.

**Git refuses the same branch in two worktrees, so this also decided how work
reaches `master`.** It lands by `git fetch && git rebase origin/master &&
git push origin HEAD:master` — `master` stays linear and still gets one
commit per task, so `AGENTS.md`'s rule survives with a rebase added. That is
a change to a stated rule, so **`ADR-0023` is `Proposed`, not `Accepted`**,
and awaits a human.

**The gate was observed *refusing* inside a worktree**, not merely passing —
`INVALID SKILL: … does not match directory`, exit 1, `HEAD` unmoved, on both
filesystems. A worktree whose gate silently does not run is worse than no
worktree, because it looks identical to a working one.

**A repo-wide defect found while verifying: every `.sh` and `.py` entry point
was recorded `100644`.** Only `.githooks/pre-commit` was `100755`. Hidden for
the repo's entire life because `/mnt/c` is DrvFs and reports every file
`0777`, and because the hook and CI both invoke `bash tests/validate.sh`
rather than the bare path. **On a POSIX checkout every command `AGENTS.md`
documents returned exit 126** — any Linux clone, container or CI checkout.
Fixed with `git update-index --chmod=+x`; a plain `chmod` is invisible while
`core.filemode` is `false`.

**How it surfaced is itself the lesson:** a gate timing of **2 ms** in an
ext4 worktree. Not a fast gate — a gate that never ran. That is the **third**
time this session an implausibly fast number turned out to be a command
exiting 126, after `REVIEW-0009` finding 5. Nothing flags it; only
implausibility does.

**This task landed through the workflow it documents**, from the `maint`
worktree, rather than asserting that the flow works — which also avoided
committing a *"do not work in the main checkout"* decision from the main
checkout.

All four briefs ran — `TASK-0048` (spike), `TASK-0049` (graphify as a
component, plus two `smoke-mcp.sh` fixes), `TASK-0050` (ponytail per
client), `TASK-0051` (the placement rule and `third-party-tools.md`).
`REVIEW-0009` approved the work and named one blocker; the human **ratified
`ADR-0021` as written** the same day, and `TASK-0068` closed the sprint.
Before it: S6's closure with S8 promoted to current (`TASK-0054`).

## S9 and S10 are planned: an unattended-run harness, documentation only

**`PLAN-0006`, 2026-09-23.** Planning only — **no component file changed**, and
that boundary was the human's instruction rather than a scoping choice. What
exists is `ADR-0022` (**`Accepted` 2026-09-23**), two sprint files, ten task briefs
(`TASK-0055`…`0064`) and three backlog items. Nothing in `loops/`, `skills/`,
`agents/`, `mcp-servers/`, `configs/`, `scripts/` or `tests/` was touched.

**The work generalises something that already runs elsewhere.** `asset-management`
has an unattended orchestrator as its ad-hoc task `A119` — a gate runner plus a
700-line Claude Code Workflow script. It has closed three tasks with commits,
parked one correctly, and found a real defect (`A120`: a gate that had reported
red on an untouched tree for two stages). So this is a generalisation from a
measured artifact, not a design from first principles — which is why `ADR-0022`
can re-raise `ADR-0019` clause 3 at all.

**The headline finding, and the thing most likely to be softened later:
seven of the nine roles will be OpenCode-only.** The harness's five rules are
per-agent *command* boundaries, and six of the ten vocabulary terms have no
per-agent Claude Code expression. The two roles that port — `task-planner` and
`adjudicator` — are **the two that only think**. `ADR-0018` clause 8.3 already
put `git-ops`, `qa-test` and `review` in the same position. **This harness is
OpenCode-first**, and under Claude Code and Bionic it runs with boundaries that
are weaker by construction, not equivalent.

**`ADR-0022` narrows two clauses and was deliberately unratified until
2026-09-23**, when the human ratified it as written (`TASK-0076`). Clause 3
(dynamic workflows) is narrowed to the *component* layer: still forbidden as a
component, permitted as a **binding** that carries no rule of its own. Ground 1
("no mid-run user input") is inapplicable to an unattended run by construction
rather than refuted, and stands unaltered for the two interactive loops. Ground 2
(single-client) is **not waived** — it becomes the reason for per-client
bindings. Clause 2.5 ("ambiguity stops the loop") is narrowed to "parks the task
and reports it"; inventing an answer stays forbidden. Narrowing a stated
requirement is the human's call, so the ADR is `Proposed` and nothing it
unblocks may be authored.

**Three findings that are this repo's, not the harness's**, raised as backlog
items rather than folded into the plan:

- **`B-024`** — `validate.sh`'s destructive-capability gate and its
  `.env.example` check both read `server.json` only. The first authored server
  will be a **command runner**, so its authorization block would be prose nothing
  checks. The "claims a component makes about its own wiring" defect class,
  in the file that polices it.
- **`B-025`** — no vocabulary term for "may call only this MCP server".
  `B-021`'s sibling, and the reason `gate-runner` has no Claude Code equivalent.
- **`B-026`** — `ADR-0018` clause 8.5 has been unsatisfied since S7: the registry
  cannot say a role is OpenCode-only, while three of six already are. S9 would
  take that to eight of fifteen, so it must be fixed **before** the roles land.

**Two corrections to the source harness, recorded so the port does not inherit
them:** a null refuter currently **fails open** — a refuter returning nothing
reads as an absence of objections — and rule 2 can be made *structural* rather
than instructed by having the driver invoke the gate from its own map, so no
agent ever sees a verification command string.

**One thing this planning pass did not resolve, and named rather than assumed:**
`worktree-only` still has no settled Claude Code emission (`ADR-0018` clause 7's
leftover, assigned to `TASK-0040`, still open). All nine new roles declare it,
and for the *acting* roles an isolated copy is the wrong confinement. `TASK-0058`
must settle it or say explicitly that it has not.

**Numbering note.** S9 took `TASK-0055`…`0064` and S10 resumes at `TASK-0065`,
**stepping over `TASK-0068`**, which belongs to S8 — it was written by a
concurrent session closing that sprint while `PLAN-0006` was being drafted. A
gap in a numeric sequence reads as a lost file; this one is not.

## S8 closed; `ADR-0021` Accepted; nothing is scheduled next

**`TASK-0068`, 2026-09-23.** `ADR-0021` is **Accepted — 2026-09-23**,
ratified **as written**. Three alternatives were offered and declined:
tightening clause 5, rejecting (as `ADR-0017` was), and holding.

**Ratification covers the Decision clauses, not the Context.** `TASK-0048`
overturned two of this ADR's three falsifiable claims, and those claims are
**left exactly as written** — rewriting them would erase the evidence that
the spike was load-bearing. An ADR is a dated record, not a live status
page.

**One clause carries an open question.** `REVIEW-0009`'s finding 2 showed
clause 5's provenance label records *how* a claim was obtained but not
*which artifact it describes*. The amendment was offered at ratification and
**not taken**, so it stays a follow-up — reopening it now means amending an
`Accepted` ADR.

**S8 cleared its own backlog slice** (B-019 and B-020), the second sprint to
do so after S6 — while also raising *and closing* B-022 inside one task and
leaving B-023 behind. All seven roadmap exit criteria are met, **four of
them mechanically**: no `plugins/` directory, the three scripts
byte-identical across the whole sprint, nothing vendored, and the manifest
observed failing when deliberately broken.

**Nothing was promoted to replace S8.** `ROADMAP.md` has no Phase 9 section,
and while **S9 and S10 exist as plans** (`PLAN-0006` — unattended task runs,
written concurrently with this closure) both are queued in `sprints/`, and S9
is gated on `ADR-0022`, which was `Proposed` and blocked on its own two
spikes. `SPRINT-CURRENT.md` now says that explicitly and carries the
outstanding queue — three `ready` backlog
items (**B-018**, **B-021**, **B-023**), four `REVIEW-0009` follow-ups and
two inherited from `REVIEW-0010`. Leaving a closed sprint in that file would
be the false-present-tense defect `REVIEW-0008` had to sweep across four
files.

**One prediction came true and is worth keeping visible:** two of three
deliverables were prose, the fourth instance of that pattern — and the
defence pre-committed against it (*"the honest cut is a product, never the
spike"*) was **never exercised**, because nothing had to be cut. It is
carried forward as an untested commitment, not a vindicated one.

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
   (`ansible-core` 2.20.8 → **2.21.4**). ~~recorded in nine files~~
   **Corrected 2026-09-23 by `TASK-0069`: fifteen files, of which exactly
   one was a live defect.** The other fourteen are dated records that must
   not be rewritten. Counting occurrences was the wrong measure — see that
   task.
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
