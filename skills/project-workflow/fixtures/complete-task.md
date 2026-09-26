# S002.T004_CacheHeaders

> FIXTURE, not a real task. It exists so `check-artifact.sh` can be observed
> PASSING on a conformant artifact, next to `incomplete-task.md` where it is
> observed failing. A checker never seen doing both is a checker nobody has
> reason to trust. The content is plausible but invented; no such task ran.

**Status**: completed
**Sprint**: `S002_Performance` (see `../30.ROADMAP.md` for what this sprint means)
**Commits**: `a1b2c3d` — filled in once committed; may be more than one

## Goal

Static assets were served with no `Cache-Control`, so every page load
refetched them. This sets a one-year immutable policy on the fingerprinted
asset routes only. Closes the second item in `../35.AD_HOC_TASKS.md`.

## Inputs

| Artifact | Produced by | Expected state |
|---|---|---|
| `src/server/static.py` | `S002.T001_AssetFingerprints` | serves from `/static/<hash>/…`; hash is content-derived and stable |
| `tests/test_static.py` | pre-existing | 14 tests, all passing before this task starts |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Plan

- Add `Cache-Control: public, max-age=31536000, immutable` to the
  fingerprinted route only.
- Leave the unfingerprinted `/favicon.ico` alone — its URL never changes,
  so an immutable policy there is unrecoverable without a rename.
- Add a test asserting the header on both routes, with opposite expectations.

## Verification

1. `pytest -q` → `16 passed` (14 pre-existing plus the two added here).
2. The fails-when-reverted check: `git stash push -- src/server/static.py`,
   then `pytest -q tests/test_static.py::test_fingerprinted_route_is_immutable`
   → `1 failed`, reporting `AssertionError: assert None == 'public, max-age=…'`
   — absent header, which is the expected reason rather than an import error
   or a fixture fault. `git stash pop` restored it and the suite returned to
   `16 passed`.
3. Measured against the dev server with `curl -sI`: the fingerprinted route
   returns the header, `/favicon.ico` returns none. A test alone could not
   show the two routes genuinely diverge in a running server.

## Outputs / handover

| Artifact | End state |
|---|---|
| `src/server/static.py` | fingerprinted route sets the immutable header; `/favicon.ico` deliberately unchanged, with a comment saying why |
| `tests/test_static.py` | 16 tests; the two new ones assert opposite policies on the two routes |

**Next task starts here**: fingerprinted assets carry a one-year immutable
policy; unfingerprinted ones carry none and are still refetched every load.

## Status notes

The plan assumed one route needed changing. There were two, and the second
was deliberately left alone rather than changed — recorded above, because a
later task scoped against the original plan would otherwise expect both.
