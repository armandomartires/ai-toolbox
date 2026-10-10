#!/usr/bin/env bash
# Prove the vault-secrets loader offline (TASK-0131).
#
# Drives skills/vault-secrets/scripts/vault_secrets.py as a subprocess against
# a stub Vault served from this process on 127.0.0.1, with a throwaway HOME and
# no controlling terminal (so a password prompt can never block the gate). No
# network beyond loopback, no real Vault, no git. tests/validate.sh runs it.
#
# THE CASES THAT MATTER MOST: login stores the read-only CHILD token and never
# the LDAP token, which may carry admin (T1); exec exports only the variables
# it was asked for (T4); an exported variable wins over Vault (T5); a
# non-loopback http:// is refused (T8); and no password, token or value ever
# reaches stdout or stderr (T15).
#
# WHAT THIS PROVES: the script's behaviour and requests against a stub that
# answers the way Vault's KV v2, token and LDAP endpoints are documented to; and
# that the repo's secrets.map is well-formed and documented in .env.example.
# WHAT IT DOES NOT PROVE: that the real Vault answers as the stub does, that its
# policies allow these calls, or that TLS verifies against the real CA.
# TASK-0131's live verification records that.
#
# TASK-0132 adds the AppRole method and several maps: T17-T25. The case that
# matters most there is T17 -- a token minted for one command is revoked BEFORE
# the child starts, so no live token outlives the fetch.
#
# TASK-0149 adds T26-T27: exec ends with the command's own exit status. On
# Windows os.execvpe returns status 0 before the command finishes, so exec
# runs the command and waits there instead. T27 drives that path directly,
# because the gate runs on Linux.
#
# Usage: tests/test-vault-secrets.sh [path/to/vault_secrets.py]   (a copy, for red proofs)
set -euo pipefail
cd "$(dirname "$0")/.."
exec python3 - "${1:-skills/vault-secrets/scripts/vault_secrets.py}" <<'TEST'
import contextlib
import importlib.util
import io
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SCRIPT = os.path.abspath(sys.argv[1])
results, outputs = [], []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))


# Every one of these must stay out of every output (T15).
PASSWORD = "pw-Secret-7731"
PARENT = "hvs.PARENT-carries-admin-0001"
CHILD = "hvs.CHILD-read-only-0002"
ROOT = "hvs.ROOT-token-0003"
STALE = "hvs.STALE-token-0004"
NEW_VALUE = "VAL-new-github-77e"
PUSH_VALUE, GITHUB_VALUE = "VAL-gitlab-push-9a1", "VAL-github-4c2"
ROLE_ID, SECRET_ID, APP = "role-id-5a7c", "sid-Secret-91fe", "hvs.APPROLE-token-0005"
PRIVATE_VALUE, APP_VALUE = "VAL-private-3d8", "VAL-written-by-approle-6b0"
TOKENS = {
    PARENT: ["admin", "default", "secrets-writer", "workstation-read"],
    CHILD: ["default", "workstation-read"],
    ROOT: ["root"],
    APP: ["ai-toolbox-app", "default"],
}
state = {
    "requests": [],
    "store": {
        "ai-toolbox/gitlab-push": ({"token": PUSH_VALUE}, 1),
        "ai-toolbox/github": ({"token": GITHUB_VALUE, "note": "keep-me"}, 3),
        "ai-toolbox/private": ({"password": PRIVATE_VALUE}, 1),
    },
}


class Stub(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, code, obj=None):
        body = b"" if obj is None else json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def route(self, method):
        n = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(n)) if n else None
        token = self.headers.get("X-Vault-Token")
        path = self.path[len("/v1/"):]
        state["requests"].append((method, path, token, body, time.time()))
        deny = {"errors": ["permission denied"]}
        if path == "sys/health":
            return self.reply(200, {"initialized": True, "sealed": False})
        if re.fullmatch(r"auth/ldap/login/[^/]+", path) and method == "POST":
            if (body or {}).get("password") == PASSWORD:
                return self.reply(200, {"auth": {"client_token": PARENT, "policies": TOKENS[PARENT],
                                                 "lease_duration": 28800}})
            return self.reply(400, {"errors": ["ldap operation failed: failed to bind as user"]})
        if path == "auth/approle/login" and method == "POST":
            if body == {"role_id": ROLE_ID, "secret_id": SECRET_ID}:
                return self.reply(200, {"auth": {"client_token": APP, "policies": TOKENS[APP],
                                                 "lease_duration": 600}})
            return self.reply(400, {"errors": ["invalid role or secret ID"]})
        if path == "auth/token/lookup-self":
            if token in TOKENS:
                return self.reply(200, {"data": {"policies": TOKENS[token], "ttl": 28000}})
            return self.reply(403, deny)
        if path == "auth/token/create" and method == "POST":
            if token != PARENT:
                return self.reply(403, deny)
            if body.get("policies") != ["workstation-read"]:
                return self.reply(400, {"errors": ["unexpected policies"]})
            return self.reply(200, {"auth": {"client_token": CHILD, "policies": TOKENS[CHILD],
                                             "lease_duration": 28800}})
        if path == "auth/token/revoke-self":
            return self.reply(204)
        m = re.fullmatch(r"kv/data/(.+)", path)
        if m:
            if token not in TOKENS:
                return self.reply(403, deny)
            key = m.group(1)
            if method == "GET":
                if key not in state["store"]:
                    return self.reply(404, {"errors": []})
                data, version = state["store"][key]
                return self.reply(200, {"data": {"data": data, "metadata": {"version": version}}})
            if not {"secrets-writer", "ai-toolbox-app"} & set(TOKENS[token]):
                return self.reply(403, deny)
            current = state["store"].get(key, ({}, 0))[1]
            if body["options"]["cas"] != current:
                return self.reply(400, {"errors": ["check-and-set parameter did not match"]})
            state["store"][key] = (body["data"], current + 1)
            return self.reply(200, {"data": {"version": current + 1}})
        return self.reply(404, {"errors": ["no handler for route"]})

    def do_GET(self):
        self.route("GET")

    def do_POST(self):
        self.route("POST")


server = ThreadingHTTPServer(("127.0.0.1", 0), Stub)
threading.Thread(target=server.serve_forever, daemon=True).start()
WORK = tempfile.mkdtemp(prefix="vault-secrets-test.")
HOME = os.path.join(WORK, "home")
os.mkdir(HOME)
TOKFILE = os.path.join(HOME, ".vault-token")
PROBE = os.path.join(WORK, "probe.json")


def write(name, text):
    path = os.path.join(WORK, name)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)
    return path


MAP = write("secrets.map", "# test map\nGITLAB_PUSH_TOKEN=kv/ai-toolbox/gitlab-push#token\n"
                           "GITHUB_TOKEN=kv/ai-toolbox/github#token\n")
GONE_MAP = write("gone.map", "GONE_TOKEN=kv/ai-toolbox/never-written#token\n"
                             "ODD_TOKEN=kv/ai-toolbox/github#nofield\n")
BASE_ENV = {k: v for k, v in os.environ.items()
            if not k.startswith("VAULT_") and k not in ("GITHUB_TOKEN", "GITLAB_TOKEN", "GITLAB_PUSH_TOKEN")}
BASE_ENV.update({"HOME": HOME, "VAULT_USER": "tester",
                 "VAULT_ADDR": "http://127.0.0.1:%d" % server.server_address[1]})


def run(args, stdin="", env=None):
    if os.path.exists(PROBE):  # one case's leftover must not satisfy the next
        os.remove(PROBE)
    e = dict(BASE_ENV)
    e.update(env or {})
    e = {k: v for k, v in e.items() if v is not None}
    p = subprocess.run([sys.executable, SCRIPT] + args, input=stdin, capture_output=True, text=True,
                       env=e, cwd=WORK, timeout=30, start_new_session=True)
    outputs.append(p.stdout + p.stderr)
    return p


def probe_cmd(*names):
    code = ("import json,os,sys,time; d = {k: os.environ.get(k) for k in sys.argv[2:]}; "
            "d['_started'] = time.time(); json.dump(d, open(sys.argv[1], 'w'))")
    return ["--", sys.executable, "-c", code, PROBE] + list(names)


def probe():
    try:
        with open(PROBE, encoding="utf-8") as fh:
            seen = json.load(fh)
        os.remove(PROBE)
        return seen
    except FileNotFoundError:
        return None


def tok():
    try:
        with open(TOKFILE, encoding="utf-8") as fh:
            return fh.read()
    except FileNotFoundError:
        return None


def label(t):
    return {CHILD: "child", PARENT: "LDAP token", ROOT: "root", STALE: "stale", None: "none"}.get(t, "other")


def set_tok(t):
    with open(TOKFILE, "w", encoding="utf-8") as fh:
        fh.write(t)
    os.chmod(TOKFILE, 0o600)


def clear_tok():
    if os.path.exists(TOKFILE):
        os.remove(TOKFILE)


def taken():
    r = list(state["requests"])
    state["requests"].clear()
    return r


try:
    # T1 - LDAP login stores the read-only child, never the LDAP token.
    clear_tok(); taken()
    p = run(["login"], stdin=PASSWORD + "\n")
    creates = [x for x in taken() if x[1] == "auth/token/create"]
    check("T1 ldap login exits 0", p.returncode == 0, p.stderr.strip())
    check("T1 stored token is the read-only child, not the LDAP token", tok() == CHILD, "stored: " + label(tok()))
    check("T1 token file is mode 600", tok() is not None and stat.S_IMODE(os.stat(TOKFILE).st_mode) == 0o600)
    check("T1 the child is created by the LDAP token with workstation-read only",
          len(creates) == 1 and creates[0][2] == PARENT and creates[0][3]["policies"] == ["workstation-read"])

    # T2 - a wrong password fails with the login exit code and stores nothing.
    clear_tok()
    p = run(["login"], stdin="wrong-password\n")
    check("T2 wrong password exits 3 and stores nothing", p.returncode == 3 and tok() is None, p.stderr.strip())

    # T3 - token login stores a token as given, but never a root token.
    p = run(["login"], stdin=ROOT + "\n", env={"VAULT_AUTH_METHOD": "token"})
    check("T3 token login refuses to store a root token", p.returncode == 1 and tok() is None and "root" in p.stderr)
    p = run(["login"], stdin=CHILD + "\n", env={"VAULT_AUTH_METHOD": "token"})
    check("T3 token login stores a non-root token as given", p.returncode == 0 and tok() == CHILD, p.stderr.strip())

    # T4 - exec exports only the variables it was asked for.
    set_tok(CHILD)
    p = run(["exec", "--map", MAP, "GITHUB_TOKEN"] + probe_cmd("GITHUB_TOKEN", "GITLAB_PUSH_TOKEN"))
    seen = probe() or {}
    check("T4 exec runs the command", p.returncode == 0 and seen, p.stderr.strip())
    check("T4 the named variable arrives with Vault's value", seen.get("GITHUB_TOKEN") == GITHUB_VALUE)
    check("T4 an unnamed mapped variable is NOT exported", "GITLAB_PUSH_TOKEN" in seen and seen["GITLAB_PUSH_TOKEN"] is None)

    # T5 - an exported variable wins, and Vault is not consulted for it.
    taken()
    p = run(["exec", "--map", MAP, "GITHUB_TOKEN"] + probe_cmd("GITHUB_TOKEN"),
            env={"GITHUB_TOKEN": "from-the-environment"})
    seen = probe() or {}
    check("T5 an exported variable wins over Vault", seen.get("GITHUB_TOKEN") == "from-the-environment")
    check("T5 Vault is not consulted for it", not any(x[1].startswith("kv/") for x in taken()))
    p = run(["exec", "--map", MAP, "GITHUB_TOKEN"] + probe_cmd("GITHUB_TOKEN"),
            env={"GITHUB_TOKEN": "from-the-environment", "VAULT_ADDR": None})
    check("T5 with every named variable exported, exec needs no Vault at all (CI)",
          p.returncode == 0 and (probe() or {}).get("GITHUB_TOKEN") == "from-the-environment", p.stderr.strip())

    # T6 - --all exports every mapped variable.
    p = run(["exec", "--map", MAP, "--all"] + probe_cmd("GITHUB_TOKEN", "GITLAB_PUSH_TOKEN"))
    seen = probe() or {}
    check("T6 --all exports every mapped variable",
          seen.get("GITHUB_TOKEN") == GITHUB_VALUE and seen.get("GITLAB_PUSH_TOKEN") == PUSH_VALUE, p.stderr.strip())

    # T7 - naming nothing is refused.
    p = run(["exec", "--map", MAP] + probe_cmd("GITHUB_TOKEN"))
    check("T7 exec with no variable and no --all exits 2 and runs nothing", p.returncode == 2 and probe() is None)

    # T8 - plain http to anything but loopback is refused before any request.
    for cmd, stdin in ((["exec", "--map", MAP, "GITHUB_TOKEN"] + probe_cmd("GITHUB_TOKEN"), ""),
                       (["login"], PASSWORD + "\n")):
        p = run(cmd, stdin=stdin, env={"VAULT_ADDR": "http://vault.example.invalid:8200"})
        check("T8 %s refuses a non-loopback http:// address" % cmd[0],
              p.returncode == 1 and "cleartext" in p.stderr and probe() is None, p.stderr.strip())

    # T9 - a missing secret or field fails, names the variable and path, runs nothing.
    p = run(["exec", "--map", GONE_MAP, "GONE_TOKEN"] + probe_cmd("GONE_TOKEN"))
    check("T9 a missing secret exits 1, names variable and path, runs nothing",
          p.returncode == 1 and "GONE_TOKEN" in p.stderr and "ai-toolbox/never-written" in p.stderr
          and probe() is None, p.stderr.strip())
    p = run(["exec", "--map", GONE_MAP, "ODD_TOKEN"] + probe_cmd("ODD_TOKEN"))
    check("T9 a missing field exits 1 and names it", p.returncode == 1 and "nofield" in p.stderr and probe() is None)

    # T10 - a rejected token exits 3 and says to log in.
    set_tok(STALE)
    p = run(["exec", "--map", MAP, "GITHUB_TOKEN"] + probe_cmd("GITHUB_TOKEN"))
    check("T10 a rejected token exits 3, says login, runs nothing",
          p.returncode == 3 and "login" in p.stderr and probe() is None, p.stderr.strip())

    # T11 - check reports by name.
    set_tok(CHILD)
    p = run(["check", "--map", MAP], env={"GITLAB_PUSH_TOKEN": "exported"})
    check("T11 check exits 0 when everything is readable or shadowed", p.returncode == 0, (p.stdout + p.stderr).strip())
    check("T11 check reports a readable variable", "GITHUB_TOKEN: readable from kv/ai-toolbox/github#token" in p.stdout)
    check("T11 check names a shadowed variable", "GITLAB_PUSH_TOKEN: set in the environment, shadows Vault" in p.stdout)
    p = run(["check", "--map", GONE_MAP])
    check("T11 check exits 1 and says MISSING for an absent secret",
          p.returncode == 1 and "GONE_TOKEN: MISSING" in p.stdout, (p.stdout + p.stderr).strip())

    # T12 - put writes with a fresh login, merges, and uses check-and-set.
    set_tok(CHILD); taken()
    p = run(["put", "--map", MAP, "GITHUB_TOKEN"], stdin=PASSWORD + "\n" + NEW_VALUE + "\n")
    writes = [x for x in taken() if x[0] == "POST" and x[1] == "kv/data/ai-toolbox/github"]
    check("T12 put exits 0", p.returncode == 0, p.stderr.strip())
    check("T12 put writes with a fresh LDAP login, not the stored read-only token",
          len(writes) == 1 and writes[0][2] == PARENT, "writer: " + (label(writes[0][2]) if writes else "no write"))
    check("T12 put merges: other fields kept, value replaced",
          bool(writes) and writes[0][3]["data"] == {"token": NEW_VALUE, "note": "keep-me"})
    check("T12 put uses check-and-set on the version it read", bool(writes) and writes[0][3]["options"]["cas"] == 3)
    check("T12 a write leaves the stored token unchanged", tok() == CHILD)

    # T13 - logout revokes and removes.
    taken()
    p = run(["logout"])
    check("T13 logout revokes the token and removes the file",
          p.returncode == 0 and tok() is None
          and any(x[1] == "auth/token/revoke-self" and x[2] == CHILD for x in taken()), p.stderr.strip())

    # T14 - a malformed map line fails by line number and is never echoed.
    bad = write("bad.map", "GITHUB_TOKEN=ghp_PASTEDVALUE123\n")
    p = run(["check", "--map", bad])
    check("T14 a malformed map line fails with its line number, unechoed",
          p.returncode == 1 and "bad.map:1" in p.stderr and "ghp_PASTEDVALUE123" not in p.stdout + p.stderr)

    # T17-T25 - the AppRole method and several maps (TASK-0132).
    vault_dir = os.path.join(HOME, ".config", "vault")
    os.makedirs(vault_dir)
    def cred(name, secret_id, mode):
        path = os.path.join(vault_dir, name)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump({"role_id": ROLE_ID, "secret_id": secret_id}, fh)
        os.chmod(path, mode)
        return path
    APPROLE, LOOSE, BADSID = cred("app.approle", SECRET_ID, 0o600), cred("loose.approle", SECRET_ID, 0o644), \
        cred("bad.approle", "sid-wrong", 0o600)
    EXTRA = write("private.map", "PRIVATE_PASSWORD=kv/ai-toolbox/private#password\n")
    DUP = write("dup.map", "GITHUB_TOKEN=kv/ai-toolbox/elsewhere#token\n")
    approle = {"VAULT_AUTH_METHOD": "approle", "VAULT_APPROLE_FILE": APPROLE}

    clear_tok(); taken()
    current = state["store"]["ai-toolbox/github"][0]["token"]  # T12 rewrote it
    p = run(["exec", "--map", MAP, "GITHUB_TOKEN"] + probe_cmd("GITHUB_TOKEN"), env=approle)
    seen, r = probe() or {}, taken()
    revokes = [x for x in r if x[1] == "auth/token/revoke-self" and x[2] == APP]
    check("T17 approle exec delivers the value with no stored token and no prompt",
          p.returncode == 0 and seen.get("GITHUB_TOKEN") == current and tok() is None, p.stderr.strip())
    check("T17 the value was read with the AppRole token",
          any(x[1] == "kv/data/ai-toolbox/github" and x[2] == APP for x in r))
    check("T17 the AppRole token is revoked BEFORE the child starts",
          len(revokes) == 1 and "_started" in seen and revokes[0][4] < seen["_started"])

    p = run(["put", "--map", MAP, "GITHUB_TOKEN"], stdin=APP_VALUE + "\n", env=approle)
    r = taken()
    writes = [x for x in r if x[0] == "POST" and x[1] == "kv/data/ai-toolbox/github"]
    check("T18 approle put writes with the AppRole token, no password prompt",
          p.returncode == 0 and len(writes) == 1 and writes[0][2] == APP
          and writes[0][3]["data"]["token"] == APP_VALUE, p.stderr.strip())
    check("T18 the AppRole token is revoked after the write",
          any(x[1] == "auth/token/revoke-self" and x[2] == APP for x in r))

    p = run(["exec", "--map", MAP, "GITHUB_TOKEN"] + probe_cmd("GITHUB_TOKEN"),
            env=dict(approle, VAULT_APPROLE_FILE=LOOSE))
    check("T19 a credential file readable by others is refused before any login",
          p.returncode == 1 and "readable by group or others" in p.stderr and probe() is None
          and not any(x[1] == "auth/approle/login" for x in taken()), p.stderr.strip())

    p = run(["exec", "--map", MAP, "GITHUB_TOKEN"] + probe_cmd("GITHUB_TOKEN"),
            env=dict(approle, VAULT_APPROLE_FILE=BADSID))
    check("T20 a wrong secret_id exits 3 and runs nothing",
          p.returncode == 3 and "AppRole login failed" in p.stderr and probe() is None, p.stderr.strip())

    p = run(["login"], env=approle)
    check("T21 approle login verifies, prints policies, stores nothing",
          p.returncode == 0 and "ai-toolbox-app" in p.stdout and tok() is None
          and any(x[1] == "auth/token/revoke-self" and x[2] == APP for x in taken()), p.stderr.strip())

    set_tok(CHILD)
    p = run(["exec", "--map", MAP, "--map", EXTRA, "GITHUB_TOKEN", "PRIVATE_PASSWORD"]
            + probe_cmd("GITHUB_TOKEN", "PRIVATE_PASSWORD"))
    seen = probe() or {}
    check("T22 two --map files combine", p.returncode == 0 and seen.get("PRIVATE_PASSWORD") == PRIVATE_VALUE
          and seen.get("GITHUB_TOKEN") == APP_VALUE, p.stderr.strip())
    p = run(["exec", "--map", MAP, "--map", DUP, "GITHUB_TOKEN"] + probe_cmd("GITHUB_TOKEN"))
    check("T23 a variable mapped in two files is an error, not an override",
          p.returncode == 1 and "mapped twice" in p.stderr and probe() is None, p.stderr.strip())
    p = run(["exec", "PRIVATE_PASSWORD"] + probe_cmd("PRIVATE_PASSWORD"),
            env={"VAULT_SECRETS_MAPS": MAP + ":" + EXTRA})
    check("T24 VAULT_SECRETS_MAPS names the maps when no --map is given",
          p.returncode == 0 and (probe() or {}).get("PRIVATE_PASSWORD") == PRIVATE_VALUE, p.stderr.strip())

    clear_tok(); taken()
    p = run(["check", "--map", MAP, "--map", EXTRA], env=approle)
    check("T25 approle check reads every mapped variable and revokes its token",
          p.returncode == 0 and "PRIVATE_PASSWORD: readable" in p.stdout and "revoked after this check" in p.stdout
          and any(x[1] == "auth/token/revoke-self" and x[2] == APP for x in taken()), (p.stdout + p.stderr).strip())

    # T26 - exec ends with the command's own exit status, not its own 0.
    # The variable is exported, so no Vault state from earlier cases matters.
    p = run(["exec", "--map", MAP, "GITHUB_TOKEN", "--", sys.executable, "-c", "import sys; sys.exit(7)"],
            env={"GITHUB_TOKEN": "exported-t26"})
    check("T26 exec exits with the command's status", p.returncode == 7, "exit %s" % p.returncode)

    # T15 - nothing secret in any output, across every run above.
    blob = "\n".join(outputs)
    leaked = [name for name, s in (("password", PASSWORD), ("LDAP token", PARENT), ("child token", CHILD),
                                   ("root token", ROOT), ("stale token", STALE), ("new value", NEW_VALUE),
                                   ("push value", PUSH_VALUE), ("github value", GITHUB_VALUE),
                                   ("role_id", ROLE_ID), ("secret_id", SECRET_ID), ("AppRole token", APP),
                                   ("private value", PRIVATE_VALUE), ("approle-written value", APP_VALUE))
              if s in blob]
    check("T15 no password, token or value in any output (%d runs)" % len(outputs), not leaked, ", ".join(leaked))

    # T16 - the repo's own map: well-formed, and documented in .env.example.
    sys.dont_write_bytecode = True  # leave no __pycache__ in the skill
    spec = importlib.util.spec_from_file_location("vault_secrets", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    # T27 - the Windows path: run the command, wait for it, exit with its status.
    def spawned(command):
        if os.path.exists(PROBE):
            os.remove(PROBE)
        try:
            with contextlib.redirect_stderr(io.StringIO()):  # die()'s message
                mod.run_command(command, dict(os.environ), spawn=True)
        except SystemExit as e:
            return e.code
        return None
    code = spawned([sys.executable, "-c", "import json,sys,time; time.sleep(0.5); "
                    "json.dump({}, open(sys.argv[1], 'w')); sys.exit(7)", PROBE])
    check("T27 on Windows, exec waits for the command and exits with its status",
          code == 7 and probe() == {}, "exit %s" % code)
    # An absolute path: a bare name searched along a WSL PATH can raise EACCES.
    code = spawned([os.path.join(WORK, "no-such-command-t27")])
    check("T27 on Windows, a missing command exits 127", code == 127, "exit %s" % code)

    if not os.path.exists("secrets.map"):
        check("T16 secrets.map exists at the repo root", False)
    else:
        with open("secrets.map", encoding="utf-8") as fh:
            lines = [l.strip() for l in fh if l.strip() and not l.strip().startswith("#")]
        with open(".env.example", encoding="utf-8") as fh:
            documented = set(re.findall(r"(?m)^([A-Z_][A-Z0-9_]*)=", fh.read()))
        malformed = [i for i, l in enumerate(lines, 1) if not mod.MAP_LINE.match(l)]
        undocumented = [m["var"] for m in map(mod.MAP_LINE.match, lines) if m and m["var"] not in documented]
        check("T16 secrets.map lines are VAR=<mount>/<path>#<field>", lines and not malformed,
              "entries %s" % malformed if malformed else "no entries")
        check("T16 every secrets.map variable is documented in .env.example", not undocumented,
              ", ".join(undocumented))
finally:
    server.shutdown()
    shutil.rmtree(WORK, ignore_errors=True)

failed = 0
for name, ok, detail in results:
    print("%s %s%s" % ("PASS" if ok else "FAIL", name, "" if ok or not detail else ": " + detail))
    failed += not ok
print("test-vault-secrets: %d/%d passed" % (len(results) - failed, len(results)))
sys.exit(1 if failed else 0)
TEST
