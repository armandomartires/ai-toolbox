#!/usr/bin/env python3
"""Mod status and the live-verification gate (issues #5 and #9).

Every mods/*/claude/status.json says `experimental` or `verified`. A mod may be
`verified` only when its live_verification list proves, for the version in
its claude/.claude-plugin/plugin.json, that each feature was seen working in a real
session:

  {"feature": "...", "version": "0.6.0", "date": "YYYY-MM-DD",
   "client": "desktop|terminal|vscode|web|mobile",
   "session": ".ai/sessions/SESSION-....md", "verified_by": "...",
   "result": "pass"}

Gate for `verified`:
  - at least one record, every record well-formed;
  - every record's `session` file exists (the recorded live session);
  - at least one record for the current plugin.json version, and every
    record for that version has result "pass";
  - the mod's README (mods/<name>/README.md) states `Status: verified.` and no longer lists anything
    "not yet seen live" or "not yet verified".
`_template*` mods must stay experimental, so a new mod starts there.
Records may be kept while experimental; their shape is checked either way.

Usage: check-mod-status.py [ROOT]      (default: .)
       check-mod-status.py --self-test
"""
import glob
import json
import os
import re
import sys
import tempfile

CLIENTS = {"desktop", "terminal", "vscode", "web", "mobile"}
FIELDS = ("feature", "version", "date", "client", "session", "verified_by", "result")
UNVERIFIED = re.compile(r"not yet (seen live|verified|seen)|## Not yet verified", re.I)


def check_mod(root, d):
    bad = []
    name = os.path.basename(d)
    plugin = os.path.join(d, "claude")  # the Claude Code plugin (ADR-0054)
    sp = os.path.join(plugin, "status.json")
    try:
        st = json.load(open(sp, encoding="utf-8"))
    except (OSError, ValueError) as e:
        return [f"{sp}: missing or not JSON ({e.__class__.__name__})"]
    status = st.get("status")
    recs = st.get("live_verification")
    if status not in ("experimental", "verified"):
        bad.append(f"{sp}: status must be 'experimental' or 'verified', not {status!r}")
    if not isinstance(recs, list):
        bad.append(f"{sp}: live_verification must be a list")
        recs = []
    for i, r in enumerate(recs):
        where = f"{sp}: live_verification[{i}]"
        if not isinstance(r, dict):
            bad.append(f"{where}: not an object")
            continue
        miss = [k for k in FIELDS if not str(r.get(k, "")).strip()]
        if miss:
            bad.append(f"{where}: missing {', '.join(miss)}")
            continue
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", r["date"]):
            bad.append(f"{where}: date must be YYYY-MM-DD")
        if r["client"] not in CLIENTS:
            bad.append(f"{where}: client must be one of {sorted(CLIENTS)}")
        if r["result"] not in ("pass", "fail"):
            bad.append(f"{where}: result must be 'pass' or 'fail'")
        if not r["session"].startswith(".ai/sessions/") or not os.path.isfile(os.path.join(root, r["session"])):
            bad.append(f"{where}: session {r['session']!r} is not an existing .ai/sessions/ record")
    readme = os.path.join(d, "README.md")
    text = open(readme, encoding="utf-8").read() if os.path.isfile(readme) else ""
    if status and text and f"Status: {status}." not in text:
        bad.append(f"{readme}: does not state 'Status: {status}.'")
    if name.startswith("_template") and status != "experimental":
        bad.append(f"{sp}: a template stays experimental, so a new mod starts there")
    if status == "verified":
        try:
            ver = json.load(open(os.path.join(plugin, ".claude-plugin", "plugin.json"), encoding="utf-8")).get("version")
        except (OSError, ValueError):
            ver = None
        cur = [r for r in recs if isinstance(r, dict) and r.get("version") == ver]
        if not cur:
            bad.append(f"{sp}: verified, but no live_verification record for the current version {ver!r}")
        elif any(r.get("result") != "pass" for r in cur):
            bad.append(f"{sp}: verified, but a record for version {ver!r} did not pass")
        if UNVERIFIED.search(text):
            bad.append(f"{readme}: verified, but the README still lists unverified features")
    return bad


def check(root="."):
    bad = []
    for d in sorted(glob.glob(os.path.join(root, "mods", "*", ""))):
        bad += check_mod(root, d.rstrip("/"))
    return bad


def self_test():
    def mk(root, status, recs, readme_extra="", version="1.0.0"):
        d = os.path.join(root, "mods", "m")
        os.makedirs(os.path.join(d, "claude", ".claude-plugin"), exist_ok=True)
        json.dump({"name": "m", "version": version}, open(os.path.join(d, "claude", ".claude-plugin", "plugin.json"), "w"))
        json.dump({"status": status, "live_verification": recs}, open(os.path.join(d, "claude", "status.json"), "w"))
        open(os.path.join(d, "README.md"), "w").write(f"# m\n\nStatus: {status}.\n{readme_extra}")
    rec = {"feature": "pane", "version": "1.0.0", "date": "2026-11-04", "client": "desktop",
           "session": ".ai/sessions/S.md", "verified_by": "armando", "result": "pass"}
    cases = [
        ("experimental, no records", "experimental", [], "", True),
        ("verified without records", "verified", [], "", False),
        ("verified with a passing record", "verified", [rec], "", True),
        ("verified, record for an old version", "verified", [dict(rec, version="0.9.0")], "", False),
        ("verified, failing record", "verified", [dict(rec, result="fail")], "", False),
        ("verified, session file missing", "verified", [dict(rec, session=".ai/sessions/NOPE.md")], "", False),
        ("verified, README still lists unverified", "verified", [rec], "Not yet seen live: the r key.\n", False),
        ("malformed record", "experimental", [{"feature": "x"}], "", False),
    ]
    ok = True
    for label, status, recs, extra, want in cases:
        with tempfile.TemporaryDirectory() as root:
            os.makedirs(os.path.join(root, ".ai", "sessions"))
            open(os.path.join(root, ".ai", "sessions", "S.md"), "w").write("x")
            mk(root, status, recs, extra)
            got = not check(root)
            if got != want:
                print(f"self-test: {label}: expected {'pass' if want else 'fail'}, got {check(root)}")
                ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        sys.exit(self_test())
    findings = check(sys.argv[1] if len(sys.argv) > 1 else ".")
    for f in findings:
        print("MOD STATUS: " + f)
    sys.exit(1 if findings else 0)
