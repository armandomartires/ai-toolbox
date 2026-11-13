# ADR-0035 — The dashboard is rebuilt at plan approval and after a push; publishing is asked, and a no is recorded

**Status**: accepted
**Date**: 2026-10-11
**Task**: TASK-0159

## Context

The dashboard skill left it to the reader when to build the local file. Publishing existed only if someone happened to write `dashboard-publish.conf`. On 2026-10-11 the human asked for three things:
- a rebuild once a new plan is approved and its workflow files are written;
- a rebuild whenever the code is pushed to GitHub or GitLab;
- every project with a GitHub or GitLab remote to be asked whether to publish to GitHub Pages or GitLab Pages.

ADR-0029 says that only CI builds the published page, and `AGENTS.md` says the dashboard is "not run by any hook".

## Decision

1. **Two rebuild points, both agent steps:**
   - when a plan is approved **and** every workflow file it touches is written;
   - after the push to every remote is confirmed.

   **No git hook.** A pre-push hook runs before the push lands, so it would also rebuild on a rejected push. A published page is already rebuilt on that push by its own pipeline (ADR-0029), so the local file only has to follow the working tree.
2. **The question is asked once per project.** `publish-dashboard.sh decision` lists each remote by host and guessed forge (`github`, `gitlab`, `unknown`), and exits 1 while a remote exists and no conf does. It is asked:
   - at `project-workflow` scaffolding (step 7);
   - in `project-migration` Phase 1 (step 6);
   - at the first task-end push of a project that predates the question.
3. **A no is recorded as `targets = none`**, alone in the conf. `render` writes nothing, and `render --check` still reports any pipeline an earlier yes left deploying. A missing conf means "not yet asked", never "no".
4. **The forge is never guessed for a host it cannot name.** A self-hosted GitLab, ai-toolbox's own among them, is reported as `unknown`, and the human is asked. Only hosts are printed, never URLs, since a URL can carry a token.

## Alternatives considered

- **A pre-push hook:** rejected. It contradicts `AGENTS.md` and ADR-0029's reasoning, fires on a push that is then rejected, and a human push already triggers CI for the page that matters.
- **Recording a no only in an ADR:** rejected, because no script can read it. The question would be re-asked unless the agent searched every ADR.
- **Guessing GitLab for any non-GitHub host:** rejected, because a Bitbucket or Gitea remote would be offered a pipeline that cannot run.

## Consequences

- Every governed project with a remote ends up with a `dashboard-publish.conf`, either the targets or `none`, and `decision` can tell which.
- ai-toolbox is unaffected: its conf already declares three targets.
- `project-workflow` is 6.2.0 and `project-migration` is 4.2.0.
