# ADR-0029 — The published dashboard is built only by its destination's CI; a local build is a preview

## Status

Accepted (2026-09-30).

**Clauses 1 and 3 are the human's decisions**, taken by choosing among stated
options (`TASK-0128`). Clause 2 follows from clause 1 and was put to the
human with it. Clause 4 says where the rule is stated. This ADR records the
clauses and the routes they reject.

Builds on `TASK-0123` (the page is published from CI) and `TASK-0127` (the
pipelines are rendered from the skill). Extends `ADR-0028`, whose
consequences already say the public dashboard follows the mirror. Supersedes
nothing.

This is not the `ADR-0029` that the vendored generator's comments cite
(`skills/project-workflow/dashboard/SCHEMA.md` and others). That number
belongs to `sigma-llmwiki`.

## Context

On 2026-09-30 the human asked why the published dashboard is generated
separately from the local one, and why the local file is not built first and
sent to GitHub Pages. Nothing here answered it. `TASK-0123` gave the goal —
current without anyone running a command, with no HTML ever committed — but
not why the builder is CI. Each rendered pipeline's header called the local
file *the canonical output* and the page *an optional copy of it*, which
reads as an invitation to upload it.

The following was established the same day, before deciding. The figures
belong to `TASK-0128`; this file states what they establish.

- **The tool is not the difference.** CI runs the same `build-dashboard.sh`
  over the same vendored generator. A clean build of the pushed commit, made
  on the same UTC day, is the same page as the live one except for the
  generation timestamp.
- **The input is.** A local build reads `.ai/` from the working tree and
  `git log` from the checked-out `HEAD`, so it shows what is uncommitted or
  unpushed. In a worktree it is titled after the worktree and carries
  pre-rebase hashes. Made inside the two-commit record sequence (`AGENTS.md`,
  *Git rules*), it shows that moment's half-written record. `TASK-0123`'s
  *publishing adds no exposure* holds only for a build of the pushed commit,
  and the mirror is public.
- **Each platform fixes who can upload.**
  - GitHub Pages, deploying from Actions as it does here, accepts a
    deployment only with an OIDC token that Actions issues to a workflow run,
    for an artifact that a workflow run uploaded. No API uploads one from
    elsewhere, so a workstation build can reach Pages only through an Actions
    run that fetches it.
  - GitLab Pages has no upload API. Only a Pages job in a pipeline, run by a
    runner, publishes, and no runner is online.
- **The local build is also the slower one**, by a wide margin on this
  checkout.
- **The page is dated by its build.** Part of it is computed against the day
  the generator runs, so a page rebuilt only on push shows every such figure
  as of the last push. A schedule is the obvious fix, but GitHub disables a
  scheduled workflow in a public repository after 60 days without repository
  activity. It does this per workflow file, so a schedule inside the pipeline
  would take the pipeline's push trigger down with it.

This needed a decision rather than a fix: the routes will be proposed again,
and choosing between them decides what a public page can contain.

## Decision

**The page on every Pages destination is built only by that destination's
own CI, from a full clone of the branch that was pushed. A build made on a
workstation is never uploaded, by any route.**

1. **A local build is a preview** of the working tree it runs in, for looking
   at state before it is pushed. It is never published.
2. **The up-to-date copy is the published page, fetched back.** The page is
   one self-contained file. This repository's GitHub destination serves it
   without authentication, like the public mirror. A GitLab page follows its
   project's Pages visibility, which here is private.
3. **The page is also rebuilt once a day, by a separate scheduled workflow
   whose only job is to dispatch the publishing pipeline on the publishing
   branch.** The schedule never goes into the pipeline file itself. That way
   GitHub's inactivity rule can at worst stop the daily rebuild, never
   publishing on push. It is opt-in, as its own rendered file.
4. The rule is stated in `AGENTS.md` (*Commands*, the delivery dashboard) for
   this repository, and in `skills/project-workflow/references/dashboard.md`
   (*Publishing it*) for every project that uses the skill. This file records
   why.

## Alternatives considered

- **Build locally and upload the file**, as the question proposed. Neither
  platform has an upload route for it (see Context). Even a build from a
  clean clone of the pushed commit, which would fix the input, has nowhere to
  go but one of the routes below.
- **Commit the built page to `master`** for CI to deploy as-is. A committed
  page cannot contain the commit that adds it, so it is stale on arrival.
  That is why `AGENTS.md` keeps the output gitignored. Every publish would
  also add a wholly derived commit to the public history.
- **A `gh-pages` branch**, with Pages set to deploy from a branch.
  - It needs an admin settings change away from the verified workflow build.
  - Each publish either force-pushes the public mirror or adds a compressed
    copy of the page to its history.
  - The branch goes through Jekyll unless told not to, and branch builds are
    rate-limited.
  - The `github-pages` environment, which admits only `master`, would have to
    admit that branch.
  - The branch build is itself an Actions run.
- **Pass the page in a dispatch payload** (`workflow_dispatch` inputs or a
  `repository_dispatch` payload) for a workflow to deploy. Both are capped at
  a fraction of the page's size, even compressed.
- **Attach it to a release** for a workflow to fetch and deploy. It is still
  an Actions run and still the working tree's content, and it adds a release
  artifact per publish on a public repository.
- **A self-hosted runner on the laptop.** GitHub advises against self-hosted
  runners on public repositories, because a fork's pull request can run code
  on them. The page would also depend on the laptop being on. It would not
  change the input either: a runner checks out the pushed commit, as the
  hosted one does.
- **Keep a local copy current with the vendored generator's
  `--install-hook`.** It writes `.git/hooks/post-commit`, which this
  repository does not use (`core.hooksPath` is `.githooks`). Its hook calls a
  script path that does not exist here, and swallows the errors. The
  generator is vendored and not ours to fix (`AGENTS.md`). A post-commit
  build would still be a working-tree build.
- **A `schedule:` inside the pipeline file** for the daily rebuild. The human
  rejected this in favour of the separate dispatcher in clause 3:
  - GitHub's inactivity rule disables the whole file, so a quiet stretch
    would silently stop publishing on push too.
  - A schedule fires on the default branch, so a project that publishes
    another branch would get the wrong page.
  - A skipped scheduled run still joins the pipeline's concurrency group, and
    can cancel a deploy in progress.
- **Adopted, for the local copy: fetch the published page back.** An
  unauthenticated GET returns the bytes that were deployed. The run's Pages
  artifact holds the same page, but it needs a token and expires within a
  day.

## Consequences

- **The public page shows what was pushed, and only that.** It carries no
  draft text, no worktree name, no pre-rebase hash and no half-recorded date.
  `TASK-0123`'s no-exposure premise holds by construction rather than by
  care.
- **Nothing has to be run for the page to be current.** A push is enough, and
  once clause 3 is built it also covers a day without one. That was
  `TASK-0123`'s goal, and its reason is now recorded.
- **A preview and the published page differ in their input and in their
  date.** The input differs because the preview reads the working tree and
  the page the pushed branch. The date differs because the preview uses the
  workstation's date today and the page the runner's UTC date at its last
  build. Since both come from the same command, any other difference is a
  defect.
- **The page follows `github/master`.** A forgotten mirror push leaves it
  behind, and only the hash comparison says so (`ADR-0028`).
- **Reading the current dashboard needs the network**, and updating it needs
  CI. Offline, a local build is the only view, with its preview caveats.
- **The daily rebuild can itself stop.** GitHub's inactivity rule, a delayed
  or dropped scheduled run, or a failed dispatch each leaves the page dated
  to its last build. The page header's *as of* date is what shows it.
- **GitLab Pages still needs a runner.** No workaround is offered, because
  the only one — build elsewhere and upload — is what this rejects. Where a
  runner is hosted is a separate decision.
- **Nothing enforces it.** Whether someone uploads a local build is not
  visible in the tree, so no gate is added. The control is the documentation,
  as in `ADR-0023` clause 5.
