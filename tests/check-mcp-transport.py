#!/usr/bin/env python3
"""An MCP server's network transport needs an ADR (TASK-0285, ADR-0063).

WHY: a server reachable over HTTP is a network service; for gates it is an
execution server. D7=B allowed one only behind OAuth 2.1, off by default, with
an ADR that owns the decision. This check makes that mechanical.

WHERE THE DECLARATION LIVES: `transports` in server.json (external shape), or
`[tool.ai-toolbox.transports]` in pyproject.toml (authored shape; ADR-0005
forbids a second marker file). A table of transport name -> settings:

    [tool.ai-toolbox.transports]
    stdio = { default = true }
    streamable-http = { default = false, auth = "oauth2.1", adr = "ADR-0063",
                        enabled_by = "GATES_TRANSPORT=streamable-http" }

WHAT FAILS: a non-stdio transport without an `adr` naming an existing
.ai/decisions/NNNN-*.md whose title names the transport and whose status is
proposed or accepted; one that is on by default or omits `default`; one
whose `auth` is not "oauth2.1"; one without `enabled_by`; a default other than
stdio; an unknown transport name; and an authored server whose src/ builds an
HTTP or SSE app (or passes any argument to mcp.run, or calls uvicorn.run)
without a non-stdio declaration.
WHAT IT DOES NOT PROVE: that the server enforces what it declares; that is the
server's own tests (mcp-servers/gates/tests/test_http.py).

  check-mcp-transport.py [--root DIR]   check every mcp-servers/*/ (not _*)
  check-mcp-transport.py --self-test    seeded good and bad cases
"""
from __future__ import annotations

import glob
import json
import os
import re
import sys
import tempfile

try:
    import tomllib
except ModuleNotFoundError:  # validate.sh already requires 3.11; fail, never skip
    print("MCP-TRANSPORT: python3 >= 3.11 (tomllib) required")
    raise SystemExit(1)

KNOWN = {"stdio", "streamable-http", "http", "sse"}
ADR_ID = re.compile(r"^ADR-(\d{4})$")
# Source that builds a network transport with the MCP Python SDK.
# Any argument to mcp.run (positional or a variable) can name a network
# transport, so it counts; so does uvicorn.run.
HTTP_SOURCE = re.compile(r"streamable_http_app|sse_app|run_streamable_http|run_sse_async|"
                         r"\buvicorn\.run\(|\bmcp\.run\(\s*[^)\s]|\.run\(\s*transport\s*=|"
                         r"\.run\(\s*[\"'](?:streamable-http|sse|http)[\"']")
TITLE = re.compile(r"(?m)^# (.+)$")
STATUS = re.compile(r"(?im)^\*\*Status\*\*:\s*(\w+)|^## Status\s*\n+\s*(\w+)")


def declaration(d: str):
    """(transports or None, where), or raises ValueError on an unreadable marker."""
    sj = os.path.join(d, "server.json")
    if os.path.isfile(sj):
        with open(sj, encoding="utf-8") as fh:
            return json.load(fh).get("transports"), "server.json transports"
    pp = os.path.join(d, "pyproject.toml")
    if os.path.isfile(pp):
        with open(pp, "rb") as fh:
            meta = tomllib.load(fh).get("tool", {}).get("ai-toolbox", {})
        return meta.get("transports"), "pyproject.toml [tool.ai-toolbox.transports]"
    return None, "no marker"


def builds_http(d: str) -> bool:
    for path in glob.glob(os.path.join(d, "src", "**", "*.py"), recursive=True):
        with open(path, encoding="utf-8", errors="replace") as fh:
            if HTTP_SOURCE.search(fh.read()):
                return True
    return False


def adr_problems(d: str, name: str, adr: str, path: str) -> list[str]:
    """The named ADR must be about this transport and be proposed or accepted."""
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    title = TITLE.search(text)
    words = name.replace("-", " ").lower()
    out = []
    if not title or words not in title.group(1).replace("-", " ").lower():
        out.append("%s: %s's title does not name the %r transport" % (d, adr, name))
    status = STATUS.search(text)
    value = (status.group(1) or status.group(2)).lower() if status else ""
    if value not in ("proposed", "accepted"):
        out.append("%s: %s is %s, not proposed or accepted" % (d, adr, value or "without a status"))
    return out


def check_server(root: str, d: str) -> list[str]:
    try:
        decl, where = declaration(d)
    except (ValueError, OSError) as exc:
        return ["%s: marker does not parse: %s" % (d, exc)]
    if decl is None:
        if os.path.isfile(os.path.join(d, "pyproject.toml")) and builds_http(d):
            return ["%s: src/ builds an HTTP/SSE transport but %s is missing; declare it "
                    "with an ADR id" % (d, where)]
        return []
    if not isinstance(decl, dict) or not decl:
        return ["%s: %s must be a non-empty table" % (d, where)]
    bad = []
    if (os.path.isfile(os.path.join(d, "pyproject.toml")) and builds_http(d)
            and not any(n != "stdio" for n in decl)):
        bad.append("%s: src/ builds an HTTP/SSE transport but %s declares stdio only"
                   % (d, where))
    defaults = [n for n, t in decl.items() if isinstance(t, dict) and t.get("default") is True]
    if defaults != ["stdio"]:
        bad.append("%s: the one default transport must be stdio, got %s" % (d, defaults or "none"))
    for name, t in sorted(decl.items()):
        if name not in KNOWN:
            bad.append("%s: unknown transport %r (known: %s)" % (d, name, ", ".join(sorted(KNOWN))))
            continue
        if not isinstance(t, dict):
            bad.append("%s: transport %r must be a table" % (d, name))
            continue
        if name == "stdio":
            continue
        if t.get("default") is not False:
            bad.append("%s: transport %r must declare default = false (off by default)" % (d, name))
        if t.get("auth") != "oauth2.1":
            bad.append("%s: transport %r must declare auth = \"oauth2.1\" (no anonymous mode)"
                       % (d, name))
        if not isinstance(t.get("enabled_by"), str) or not t["enabled_by"].strip():
            bad.append("%s: transport %r must name the setting that enables it (enabled_by)"
                       % (d, name))
        adr = t.get("adr")
        m = ADR_ID.match(adr) if isinstance(adr, str) else None
        if not m:
            bad.append("%s: transport %r has no ADR id (adr = \"ADR-NNNN\")" % (d, name))
        else:
            # `ADR-NNNN-*.md` (ADR-0066).
            files = glob.glob(os.path.join(root, ".ai", "decisions", "ADR-" + m.group(1) + "-*.md"))
            if not files:
                bad.append("%s: transport %r names %s, which is not in .ai/decisions/" % (d, name, adr))
            else:
                bad += adr_problems(d, name, adr, files[0])
    return bad


def check(root: str) -> list[str]:
    bad = []
    for d in sorted(glob.glob(os.path.join(root, "mcp-servers", "*", ""))):
        d = d.rstrip("/\\")
        if os.path.basename(d).startswith("_"):
            continue
        shown = os.path.relpath(d, root).replace(os.sep, "/")
        bad += [b.replace(d, shown, 1) for b in check_server(root, d)]
    return bad


GOOD_ADR = "# ADR-0999 — srv may speak Streamable HTTP\n\n**Status**: proposed\n"


def self_test() -> int:
    http = {"default": False, "auth": "oauth2.1", "adr": "ADR-0999",
            "enabled_by": "X_TRANSPORT=streamable-http"}

    def toml_table(t: dict) -> str:
        return "{ %s }" % ", ".join("%s = %s" % (k, json.dumps(v)) for k, v in t.items())

    cases = [  # (name, shape, transports or None, src text or None, adr exists, should pass)
        ("stdio only, undeclared", "py", None, None, True, True),
        ("http declared with an existing ADR", "py", {"stdio": {"default": True}, "streamable-http": http}, "app.streamable_http_app()", True, True),
        ("external http declared with an ADR", "json", {"stdio": {"default": True}, "streamable-http": http}, None, True, True),
        ("http without an ADR id", "py", {"stdio": {"default": True}, "streamable-http": {k: v for k, v in http.items() if k != "adr"}}, None, True, False),
        ("external http without an ADR id", "json", {"stdio": {"default": True}, "sse": {k: v for k, v in http.items() if k != "adr"}}, None, True, False),
        ("ADR id names no file", "py", {"stdio": {"default": True}, "streamable-http": http}, None, False, False),
        ("malformed ADR id", "py", {"stdio": {"default": True}, "streamable-http": dict(http, adr="0062")}, None, True, False),
        ("http on by default", "py", {"stdio": {"default": False}, "streamable-http": dict(http, default=True)}, None, True, False),
        ("http default omitted", "py", {"stdio": {"default": True}, "streamable-http": {k: v for k, v in http.items() if k != "default"}}, None, True, False),
        ("anonymous http", "py", {"stdio": {"default": True}, "streamable-http": dict(http, auth="none")}, None, True, False),
        ("no enabled_by", "py", {"stdio": {"default": True}, "streamable-http": {k: v for k, v in http.items() if k != "enabled_by"}}, None, True, False),
        ("unknown transport", "py", {"stdio": {"default": True}, "websocket": http}, None, True, False),
        ("undeclared HTTP in source", "py", None, "mcp.run(transport=\"streamable-http\")", True, False),
        ("undeclared positional mcp.run", "py", None, "mcp.run(TRANSPORT)", True, False),
        ("stdio-only declaration, uvicorn in source", "py", {"stdio": {"default": True}}, "uvicorn.run(app)", True, False),
        ("stdio-only declaration, plain mcp.run()", "py", {"stdio": {"default": True}}, "mcp.run()", True, True),
        ("ADR title names another subject", "py", {"stdio": {"default": True}, "streamable-http": http}, None, "# ADR-0999 — Role guard\n\n**Status**: proposed\n", False),
        ("ADR rejected", "py", {"stdio": {"default": True}, "streamable-http": http}, None, "# ADR-0999 — Streamable HTTP for srv\n\n**Status**: rejected\n", False),
        ("v1 ADR accepted", "py", {"stdio": {"default": True}, "streamable-http": http}, None, "# ADR-0999 — Streamable HTTP for srv\n\n## Status\nAccepted - 2026-01-01\n", True),
    ]
    failures = 0
    for name, shape, transports, src, adr_exists, should_pass in cases:
        with tempfile.TemporaryDirectory() as root:
            d = os.path.join(root, "mcp-servers", "srv")
            os.makedirs(os.path.join(d, "src", "srv"))
            os.makedirs(os.path.join(root, ".ai", "decisions"))
            if adr_exists:
                with open(os.path.join(root, ".ai", "decisions", "ADR-0999-x.md"), "w", encoding="utf-8") as fh:
                    fh.write(adr_exists if isinstance(adr_exists, str) else GOOD_ADR)
            if shape == "json":
                m = {"name": "srv"}
                if transports is not None:
                    m["transports"] = transports
                with open(os.path.join(d, "server.json"), "w") as fh:
                    json.dump(m, fh)
            else:
                body = '[project]\nname = "srv"\n'
                if transports is not None:
                    body += "\n[tool.ai-toolbox.transports]\n" + "".join(
                        "%s = %s\n" % (json.dumps(k), toml_table(v)) for k, v in transports.items())
                with open(os.path.join(d, "pyproject.toml"), "w") as fh:
                    fh.write(body)
            if src:
                with open(os.path.join(d, "src", "srv", "server.py"), "w") as fh:
                    fh.write(src + "\n")
            got = check(root)
            if (not got) != should_pass:
                failures += 1
                print("MCP-TRANSPORT self-test: %r expected %s, got %s"
                      % (name, "pass" if should_pass else "fail", got or "pass"))
    if failures:
        return 1
    print("MCP-TRANSPORT self-test: %d cases OK" % len(cases))
    return 0


def main(argv: list[str]) -> int:
    if argv == ["--self-test"]:
        return self_test()
    root = argv[1] if len(argv) == 2 and argv[0] == "--root" else \
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if argv and not (len(argv) == 2 and argv[0] == "--root"):
        print(__doc__)
        return 2
    bad = check(root)
    for b in bad:
        print("MCP-TRANSPORT: %s" % b)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
