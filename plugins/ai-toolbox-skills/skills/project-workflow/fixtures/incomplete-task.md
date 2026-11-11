# S002.T005_RetryBackoff

> FIXTURE, not a real task: deliberately defective, so `check-artifact.sh`
> can be watched failing. It has one defect per rejection rule:
>
>   1. `## Plan` is absent                    -> missing required section
>   2. `## Verification` sits before Inputs   -> sections out of schema order
>   3. `## Preconditions` is present          -> superseded by `## Inputs`
>   4. a generator marker survives in Goal    -> never finished
>   5. `## Verification` is empty, Status
>      says completed                         -> the claim is unverified
>
> This note describes the marker without writing it, so the checker fires
> on the real defect below and not on this text.

**Status**: completed
**Sprint**: `S002_Performance`
**Created**: 2026-01-22
**Updated**: 2026-01-22

## Goal

<!-- FILL: One to three sentences: what changes, and why now. -->

## Preconditions

The HTTP client from `S002.T003` is in place.

## Verification

## Inputs

| Artifact | Expected state |
|---|---|
| `src/client/http.py` | retries are unbounded |

## Outputs / handover

| Artifact | End state |
|---|---|
| `src/client/http.py` | retries capped at five with exponential backoff |

Next: the client gives up after five attempts.
