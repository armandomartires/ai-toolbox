# S002.T005_RetryBackoff

> FIXTURE, not a real task. Deliberately defective, so `check-artifact.sh`
> can be observed FAILING and the messages it produces can be read. Its
> sibling `complete-task.md` is the passing half. A checker never seen doing
> both is a checker nobody has reason to trust.
>
> Five defects are present at once, one per rejection rule:
>
>   1. `## Plan` is absent                  -> missing required section
>   2. `## Verification` sits before Inputs -> sections out of schema order
>   3. `## Preconditions` is present        -> superseded by `## Inputs`
>   4. a generator marker survives in Goal  -> the artifact was never finished
>   5. `## Verification` is empty while
>      Status says completed                -> the claim is unverified
>
> Defect 3 is the one worth naming: 23 of this repository's own 105 task
> files carry that heading, superseded well before this schema existed, and
> nothing detected it until shape had an owner.
>
> This blockquote deliberately describes the marker rule without writing the
> emitted marker itself. An earlier draft spelled it out and the checker
> fired here instead of on the real defect below -- the fires-on-correct-text
> failure mode, fixed by narrowing the pattern to the comment form.

**Status**: completed
**Sprint**: `S002_Performance`
**Commits**: `<hash>` — filled in once committed; may be more than one

## Goal

<!-- FILL: One or two sentences. What is this task for, and why does it matter right
     now? If it closes a gap noted in `../35.AD_HOC_TASKS.md` or answers an open
     question in `../30.ROADMAP.md`, link to it. -->

## Preconditions

The HTTP client from `S002.T003` is in place.

## Verification

## Inputs

| Artifact | Produced by | Expected state |
|---|---|---|
| `src/client/http.py` | `S002.T003_HttpClient` | retries are unbounded |

## Outputs / handover

| Artifact | End state |
|---|---|
| `src/client/http.py` | retries now capped at five with exponential backoff |

**Next task starts here**: the client gives up after five attempts.
