#!/usr/bin/env python3
"""Fail on hidden or bidirectional Unicode in agent instruction files (issue #4).

Instruction files (AGENTS.md, CLAUDE.md, agents/, loops/, skills/*/SKILL.md,
prompts/) steer every agent session. Characters a reviewer cannot see in a
diff - bidi overrides (Trojan Source, CVE-2021-42574), zero-width characters
and Unicode tag characters (ASCII smuggling) - can hide instructions there.

Usage: check-hidden-unicode.py [FILE ...]   (no args: the default file set)
       check-hidden-unicode.py --self-test
Exit 1 and one line per finding when any is present.
"""
import glob
import os
import sys
import tempfile

HIDDEN = {
    **{c: "bidi control" for c in range(0x202A, 0x202F)},
    **{c: "bidi isolate" for c in range(0x2066, 0x206A)},
    0x200E: "bidi mark", 0x200F: "bidi mark", 0x061C: "bidi mark",
    0x200B: "zero-width space", 0x200C: "zero-width non-joiner",
    0x200D: "zero-width joiner", 0x2060: "word joiner",
    0xFEFF: "zero-width no-break space / BOM", 0x00AD: "soft hyphen",
    **{c: "invisible operator" for c in range(0x2061, 0x2065)},
}


def classify(cp):
    if cp in HIDDEN:
        return HIDDEN[cp]
    if 0xE0000 <= cp <= 0xE007F:
        return "tag character"
    return None


def default_files():
    pats = ["AGENTS.md", "CLAUDE.md", "agents/**/*", "loops/**/*",
            "skills/*/SKILL.md", "prompts/**/*", ".claude/rules/**/*"]
    out = set()
    for p in pats:
        for f in glob.glob(p, recursive=True):
            if os.path.isfile(f):
                out.add(f)
    return sorted(out)


def scan(path):
    found = []
    try:
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
    except (UnicodeDecodeError, OSError):
        return found  # binary or unreadable: not an instruction text file
    for ln, line in enumerate(text.split("\n"), 1):
        for col, ch in enumerate(line, 1):
            kind = classify(ord(ch))
            if kind:
                found.append(f"{path}:{ln}:{col}: U+{ord(ch):04X} ({kind})")
    return found


def self_test():
    with tempfile.TemporaryDirectory() as d:
        bad = os.path.join(d, "bad.md")
        good = os.path.join(d, "good.md")
        with open(bad, "w", encoding="utf-8") as fh:
            fh.write("ok line\nrun this\u202e txt.exe\nzw\u200bsp\ntag\U000E0041\n")
        with open(good, "w", encoding="utf-8") as fh:
            fh.write("plain text, accents é ü, emoji 🙂, dash —\n")
        b, g = scan(bad), scan(good)
        if len(b) != 3 or g:
            print(f"self-test failed: bad={b} good={g}")
            return 1
    return 0


def main(argv):
    if argv[:1] == ["--self-test"]:
        return self_test()
    findings = []
    for f in argv or default_files():
        findings += scan(f)
    for x in findings:
        print("HIDDEN-UNICODE:", x)
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
