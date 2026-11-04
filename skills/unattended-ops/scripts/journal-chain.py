#!/usr/bin/env python3
"""Hash-chained run journal: append and verify (issue #14).

Each journal line is one JSON object with a `prev` field: the SHA-256 of the
previous line's exact bytes (without its newline), or 64 zeros for the first
line. Editing, deleting, inserting or reordering any line breaks the chain
at the line after it, and `verify` names that line.

    journal-chain.py append <journal> '<json object>'
    journal-chain.py verify <journal> [--head <sha256>]
    journal-chain.py --self-test

What the chain cannot show by itself: lines cut off the END. The last line's
hash (`verify` prints it as HEAD) is the anchor. The OpenCode driver records
it at the end of every run (stdout, the run summary, and the handover's
"Journal head:" line) and checks it on resume; pass it back with --head.

Migration (journals written before the chain): unchained lines are legacy.
The first chained line must be line 1 or a `{"event": "chain-start"}` record
whose `prev` is 64 zeros; `append` writes that marker itself when the file
ends in an unchained line. Legacy lines before the marker are not verified.

Appends take an exclusive flock on the journal around read-tail-and-write.
"""
from __future__ import annotations

import fcntl
import hashlib
import json
import os
import sys
import tempfile

GENESIS = "0" * 64


def line_hash(line: str) -> str:
    return hashlib.sha256(line.encode("utf-8")).hexdigest()


def _tail_line(fh) -> bytes:
    """The last non-empty line's bytes, read backwards until a newline."""
    fh.seek(0, os.SEEK_END)
    end = fh.tell()
    while end > 0:
        fh.seek(end - 1)
        if fh.read(1) != b"\n":
            break
        end -= 1
    pos, chunk, buf = end, 4096, b""
    while pos > 0:
        step = min(chunk, pos)
        pos -= step
        fh.seek(pos)
        buf = fh.read(step) + buf
        nl = buf.rfind(b"\n")
        if nl != -1:
            return buf[nl + 1:]
    return buf


def last_hash(path: str) -> str:
    try:
        with open(path, "rb") as fh:
            tail = _tail_line(fh)
    except FileNotFoundError:
        return GENESIS
    return hashlib.sha256(tail).hexdigest() if tail else GENESIS


def append(path: str, rec: dict) -> str:
    """Append rec with its `prev` link under an exclusive lock; returns the
    new head hash. A journal ending in an unchained line gets a chain-start
    marker first."""
    with open(path, "a+b") as fh:
        fcntl.flock(fh, fcntl.LOCK_EX)
        try:
            tail = _tail_line(fh)
            out = b""
            if tail and "prev" not in _json_or_empty(tail):
                marker = json.dumps({"event": "chain-start", "prev": GENESIS}, sort_keys=True)
                out += marker.encode("utf-8") + b"\n"
                prev = line_hash(marker)
            else:
                prev = hashlib.sha256(tail).hexdigest() if tail else GENESIS
            line = json.dumps(dict(rec, prev=prev), sort_keys=True)
            out += line.encode("utf-8") + b"\n"
            fh.seek(0, os.SEEK_END)
            fh.write(out)
            fh.flush()
        finally:
            fcntl.flock(fh, fcntl.LOCK_UN)
    return line_hash(line)


def _json_or_empty(raw: bytes) -> dict:
    try:
        v = json.loads(raw.decode("utf-8"))
        return v if isinstance(v, dict) else {}
    except ValueError:
        return {}


def verify(path: str, head: str | None = None) -> tuple[bool, str]:
    prev, started = GENESIS, False
    with open(path, encoding="utf-8") as fh:
        for n, raw in enumerate(fh, 1):
            line = raw.rstrip("\n")
            try:
                rec = json.loads(line)
            except ValueError:
                return False, "line %d is not JSON" % n
            if not isinstance(rec, dict):
                return False, "line %d is not a JSON object" % n
            if not started:
                if "prev" not in rec:
                    continue  # legacy, unchained line before the chain starts
                if n > 1 and rec.get("event") != "chain-start":
                    return False, "line %d: first chained line after legacy lines is not a chain-start marker" % n
                started = True
            got = rec.get("prev")
            if got != prev:
                return False, "line %d: chain broken (expected prev %s, found %s): line %d or an earlier line was edited, removed or reordered" % (n, prev[:12], str(got)[:12], max(n - 1, 1))
            prev = line_hash(line)
    if not started:
        return False, "no chained line: the journal is unchained or empty"
    if head and head != prev:
        return False, "HEAD %s does not match the recorded anchor %s: lines were cut off the end" % (prev[:12], head[:12])
    return True, prev


def _hammer(path: str, k: int) -> None:
    for i in range(25):
        append(path, {"event": "w%d" % k, "i": i})


def self_test() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        j = os.path.join(tmp, "journal.jsonl")
        for i in range(4):
            head = append(j, {"event": "e%d" % i, "n": i})
        ok, _ = verify(j, head)
        if not ok:
            print("self-test: an untouched journal did not verify"); return 1
        lines = open(j).read().splitlines()
        cases = {
            "edit": lines[:1] + [lines[1].replace('"e1"', '"e1-edited"')] + lines[2:],
            "delete": lines[:1] + lines[2:],
            "reorder": [lines[1], lines[0]] + lines[2:],
            "truncate": lines[:3],
        }
        for what, body in cases.items():
            open(j, "w").write("\n".join(body) + "\n")
            if verify(j, head)[0]:
                print("self-test: %s was NOT detected" % what); return 1
        # A last line longer than 64 KB with multibyte characters.
        open(j, "w").close()
        append(j, {"event": "a"})
        head = append(j, {"event": "big", "blob": "\u00e9" * 70000})
        if last_hash(j) != head or not verify(j, head)[0]:
            print("self-test: a >64 KB multibyte last line was hashed wrongly"); return 1
        # Migration: legacy unchained lines, then a chain-start marker.
        open(j, "w").write('{"event": "old1"}\n{"event": "old2"}\n')
        head = append(j, {"event": "new"})
        body = open(j).read().splitlines()
        if json.loads(body[2]).get("event") != "chain-start" or not verify(j, head)[0]:
            print("self-test: a legacy journal did not migrate"); return 1
        open(j, "w").write("\n".join(body[:2] + body[3:]) + "\n")
        if verify(j)[0]:
            print("self-test: a missing chain-start marker was NOT detected"); return 1
        # Concurrent appends keep the chain intact.
        open(j, "w").close()
        import multiprocessing
        ps = [multiprocessing.Process(target=_hammer, args=(j, k)) for k in range(4)]
        for p in ps: p.start()
        for p in ps: p.join()
        ok, _ = verify(j)
        if not ok or len(open(j).read().splitlines()) != 4 * 25:
            print("self-test: concurrent appends broke the chain"); return 1
    print("journal-chain self-test: OK (edit, delete, reorder, truncation, long lines, migration and concurrency)")
    return 0


def main(a: list[str]) -> int:
    if a == ["--self-test"]:
        return self_test()
    if len(a) == 3 and a[0] == "append":
        print(append(a[1], json.loads(a[2]))); return 0
    if len(a) in (2, 4) and a[0] == "verify":
        head = a[3] if len(a) == 4 and a[2] == "--head" else None
        ok, msg = verify(a[1], head)
        print(("HEAD %s" % msg) if ok else ("JOURNAL TAMPERED: %s" % msg))
        return 0 if ok else 1
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
