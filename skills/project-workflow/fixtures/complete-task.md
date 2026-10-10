# S002.T004_CacheHeaders

> FIXTURE, not a real task: `check-artifact.sh` passes it. Its sibling
> `incomplete-task.md` fails. The content is plausible but invented.

**Status**: completed
**Sprint**: `S002_Performance`
**Created**: 2026-01-20
**Updated**: 2026-01-21
**Applies to**: `src/server/static.py`, dev server
**Depends on**: S002.T001_AssetFingerprints

## Goal

Static assets were served with no `Cache-Control`, so every page load refetched them. Set a one-year immutable policy on the fingerprinted routes only. Closes the second item in `../35.AD_HOC_TASKS.md`.

## Inputs

| Artifact | Expected state |
|---|---|
| `src/server/static.py` | serves `/static/<hash>/…` with a content-derived hash |
| `tests/test_static.py` | 14 tests, all passing |

## Plan

1. Add `Cache-Control: public, max-age=31536000, immutable` to the fingerprinted route.
2. Leave `/favicon.ico` alone: its URL never changes, so an immutable policy there cannot be recovered.
3. Test both routes, with opposite expectations.

## Verification

1. Test suite: `pytest -q` → `16 passed`
2. Fails when reverted: with `static.py` stashed, `test_fingerprinted_route_is_immutable` → `AssertionError: assert None == 'public, max-age=…'` (the header is absent, which is the expected reason)
3. `curl -sI` on the dev server: the fingerprinted route has the header; `/favicon.ico` has none

## Outputs / handover

| Artifact | End state |
|---|---|
| `src/server/static.py` | fingerprinted route immutable; `/favicon.ico` deliberately unchanged |
| `tests/test_static.py` | 16 tests |

Next: unfingerprinted assets are still refetched on every load.

## Status notes

The plan assumed one route; there were two, and the second was left alone on purpose.
