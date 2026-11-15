# S018-checkpoint

**Date**: 2026-11-15
**Sprint completed**: `S018_ClosingS11Loops`

## State of the project

- `tests/validate.sh` passes in the pre-commit hook on every S018 commit, on
  the Windows host (about 16 minutes a run there).
- The planning skills and the three skills beside them describe one
  convention; none calls project-migration a separate framework.
- `worktree-only` means the role's own git worktree (`ADR-0018` amended):
  Claude Code's `isolation: worktree` is a full match; no role promises a path
  fence.
- The Agent SDK runner is the one Claude unattended runner; the Workflow
  binding is the secondary, in-session one. The runner has a spend cap that
  fails closed, and `golden-run-dry` drives the golden fixture against the
  stub SDK on every pipeline.
- The gates server answers `initialize` on Windows in under two seconds; the
  hang was the smoke harness's shutdown, now a tree kill with bounded reads.
- The injection eval keeps its strict grader; every agent and loop quotes an
  injected instruction only in its report line. The xAI and OpenAI eval jobs
  run and report but no longer block the pipeline.
- Broken but accepted: `S018.T004` stays in review until its live job runs.

## What changed this sprint

The draft's five items, opened as six tasks. See `../30.ROADMAP.md` and the
briefs `../tasks/S018.T001_OpenSprintS018.md` to
`../tasks/S018.T006_EvalInjectionAndProviderJobs.md`. Ad-hoc 075 closed;
077 raised.

## Open risks / known gaps

- `golden-run-live` has not run: it needs `ANTHROPIC_API_KEY` scoped to its
  environment and one manual trigger (at most $10). The SDK package is
  unpinned until then. The `Unexercised:` rows are at their cap of 3, so it
  waits as `S018.T004` in review.
- The evals' `rules:if` on a matrix variable is not yet seen in a real
  pipeline; it fails closed (Anthropic stays blocking either way).
- OpenAI's HTTP 429 on every call is most likely an exhausted quota; the next
  scheduled run names the reason.
- xAI (`grok-4`) scores under three floors; non-blocking, not fixed.
- The draft named xAI HTTP 404 and OpenAI HTTP 400; pipeline 1087 shows
  neither. The task worked from the real logs.
- `scripts/mcp-tool-lock.py` has the harness's old Windows shutdown flaw
  (ad-hoc 077).
- Another session landed `dccf809` on `origin` while S018 opened; its draft
  line (ad-hoc 076) is in the plan as proposed, not a task.

## Confidence assessment

- Confident of: the harness fix (one factor varied, pass and failure cases,
  no orphans), the `worktree-only` emitter change (P12 failed before, passes
  after), the runner's halt and handover paths (23 stub tests, three reviews).
- Untested in practice: the live golden-run job and its image; the evals'
  allow-failure rule in GitLab; the reworded agents against a live model.
- Wants a second reader: whether a cost-unknown halt is too strict for a real
  SDK error result.
