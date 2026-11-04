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
hash (`verify` prints it as HEAD) is the anchor - record it outside the file
(the handover, the commit message, ops-log) and pass it back with --head.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import tempfile

GENESIS = "0" * 64


def line_hash(line: str) -> str:
    return hashlib.sha256(line.encode("utf-8")).hexdigest()


def last_hash(path: str) -> str:
    try:
        with open(path, "rb") as fh:
            fh.seek(0, os.SEEK_END)
            size = fh.tell()
            back = min(size, 65536)
            fh.seek(size - back)
            tail = fh.read().decode("utf-8").rstrip("\n").split("\n")[-1]
    except FileNotFoundError:
        return GENESIS
    return line_hash(tail) if tail else GENESIS


def append(path: str, rec: dict) -> str:
    """Append rec with its `prev` link; returns the new head hash."""
    rec = dict(rec, prev=last_hash(path))
    line = json.dumps(rec, sort_keys=True)
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(line + "\n")
    return line_hash(line)


def verify(path: str, head: str | None = None) -> tuple[bool, str]:
    prev = GENESIS
    with open(path, encoding="utf-8") as fh:
        for n, raw in enumerate(fh, 1):
            line = raw.rstrip("\n")
            try:
                got = json.loads(line).get("prev")
            except ValueError:
                return False, "line %d is not JSON" % n
            if got != prev:
                return False, "line %d: chain broken (expected prev %s, found %s): line %d or an earlier line was edited, removed or reordered" % (n, prev[:12], str(got)[:12], max(n - 1, 1))
            prev = line_hash(line)
    if head and head != prev:
        return False, "HEAD %s does not match the recorded anchor %s: lines were cut off the end" % (prev[:12], head[:12])
    return True, prev


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
    print("journal-chain self-test: OK (edit, delete, reorder and truncation detected)")
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
