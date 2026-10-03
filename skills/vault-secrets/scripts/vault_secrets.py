#!/usr/bin/env python3
"""Fetch secrets from HashiCorp Vault into one command's environment.

Environment variables stay the interface (ADR-0009); Vault owns the values
(ADR-0030, TASK-0131). A map file names which variable comes from which KV v2
secret -- names and paths only, never values:

    GITHUB_TOKEN=kv/ai-toolbox/github#token

Subcommands:
  login                  log in (LDAP by default) and store a narrow child
                         token in ~/.vault-token, mode 600
  exec VAR... -- CMD...  fetch the named variables, then exec CMD with them
                         set; --all exports every mapped variable instead
  check                  report, by name only, what is readable and what an
                         exported variable shadows
  put VAR                write one value, read from stdin, with a fresh login
  logout                 revoke the stored token and delete the file

Configuration, from the environment:
  VAULT_ADDR         https://<host>:<port> -- required. http:// is refused
                     unless the host is loopback.
  VAULT_CACERT       PEM file of the CA that issued Vault's certificate
                     (default: the system trust store).
  VAULT_AUTH_METHOD  ldap (default) or token.
  VAULT_AUTH_MOUNT   auth mount path (default: the method's name).
  VAULT_USER         login name for ldap (default: the current user).
  VAULT_TOKEN        use this token instead of ~/.vault-token.

A variable already set in the environment wins: Vault is not consulted for it.

Exit status: 0 ok; 1 failure; 2 usage; 3 not logged in, or the token was
rejected. Nothing this script prints contains a secret value or a token.
NOT run from tests/validate.sh directly; tests/test-vault-secrets.sh drives it
against a loopback stub.
"""
import argparse
import getpass
import ipaddress
import json
import os
import re
import socket
import ssl
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request

READ_POLICY = "workstation-read"
CHILD_TTL = "8h"
MAP_LINE = re.compile(
    r"^(?P<var>[A-Z_][A-Z0-9_]*)="
    r"(?P<mount>[A-Za-z0-9_-]+)/(?P<path>[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*)"
    r"#(?P<field>[A-Za-z0-9_.-]+)$"
)
EXIT_FAIL, EXIT_USAGE, EXIT_LOGIN = 1, 2, 3


def die(msg, code=EXIT_FAIL):
    print("vault-secrets: %s" % msg, file=sys.stderr)
    sys.exit(code)


class VaultError(Exception):
    def __init__(self, status, errors):
        super().__init__("HTTP %d: %s" % (status, "; ".join(errors) or "no detail"))
        self.status = status
        self.errors = errors


class Unreadable(Exception):
    """One mapped variable could not be read; the message names it, never a value."""


def is_loopback(host):
    if not host:
        return False
    if host == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


class Vault:
    def __init__(self):
        addr = os.environ.get("VAULT_ADDR", "").strip().rstrip("/")
        if not addr:
            die("VAULT_ADDR is not set (see .env.example)")
        parts = urllib.parse.urlsplit(addr)
        if parts.scheme == "http" and not is_loopback(parts.hostname):
            die("refusing http:// for a non-loopback Vault: the login and every "
                "secret would cross the network in cleartext. Use https:// (ADR-0030).")
        if parts.scheme not in ("http", "https"):
            die("VAULT_ADDR must start with https://")
        self.addr = addr
        cafile = os.environ.get("VAULT_CACERT") or None
        try:
            self.ctx = ssl.create_default_context(cafile=cafile)
        except (OSError, ssl.SSLError) as e:
            die("VAULT_CACERT cannot be loaded: %s" % e)

    def call(self, method, path, token=None, body=None):
        req = urllib.request.Request(
            "%s/v1/%s" % (self.addr, path),
            method=method,
            data=None if body is None else json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
        )
        if token:
            req.add_header("X-Vault-Token", token)
        try:
            with urllib.request.urlopen(req, context=self.ctx, timeout=15) as r:
                raw = r.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            try:
                errors = json.loads(e.read() or b"{}").get("errors") or []
            except ValueError:
                errors = []
            raise VaultError(e.code, [str(x) for x in errors])
        except urllib.error.URLError as e:
            die("cannot reach Vault: %s" % e.reason)


# -- token file ------------------------------------------------------------

def token_path():
    return os.path.join(os.path.expanduser("~"), ".vault-token")


def stored_token():
    try:
        with open(token_path(), encoding="utf-8") as fh:
            return fh.read().strip() or None
    except FileNotFoundError:
        return None


def current_token():
    return os.environ.get("VAULT_TOKEN") or stored_token()


def write_token(token):
    path = token_path()
    # mkstemp creates the file 0600; os.replace keeps that mode, so the token
    # is never readable by others, not even for a moment.
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".vault-token.")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(token)
        os.chmod(tmp, 0o600)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def require_token():
    token = current_token()
    if not token:
        die("not logged in: run `vault_secrets.py login`", EXIT_LOGIN)
    return token


# -- map -------------------------------------------------------------------

def load_map(path):
    try:
        with open(path, encoding="utf-8") as fh:
            lines = fh.read().splitlines()
    except FileNotFoundError:
        die("map file not found: %s (pass --map)" % path)
    entries = {}
    for n, line in enumerate(lines, 1):
        text = line.strip()
        if not text or text.startswith("#"):
            continue
        m = MAP_LINE.match(text)
        if not m:
            # The line itself is not echoed: a malformed line may be a value.
            die("%s:%d: expected VAR=<mount>/<path>#<field>" % (path, n))
        if m["var"] in entries:
            die("%s:%d: %s is mapped twice" % (path, n, m["var"]))
        entries[m["var"]] = (m["mount"], m["path"], m["field"])
    return entries


def where(entry):
    mount, path, field = entry
    return "%s/%s#%s" % (mount, path, field)


def read_secret(vault, token, mount, path):
    """The data dict and version of one KV v2 secret, or None if it does not exist."""
    try:
        d = vault.call("GET", "%s/data/%s" % (mount, path), token)["data"]
        return d.get("data") or {}, (d.get("metadata") or {}).get("version", 0)
    except VaultError as e:
        if e.status == 404:
            return None
        if e.status == 403 and not token_valid(vault, token):
            die("the Vault token was rejected (expired or revoked): run "
                "`vault_secrets.py login`", EXIT_LOGIN)
        raise


def token_valid(vault, token):
    try:
        vault.call("GET", "auth/token/lookup-self", token)
        return True
    except VaultError:
        return False


def fetch(vault, token, entries, names):
    values, cache = {}, {}
    for name in names:
        mount, path, field = entries[name]
        if (mount, path) not in cache:
            try:
                cache[(mount, path)] = read_secret(vault, token, mount, path)
            except VaultError as e:
                raise Unreadable("%s: cannot read %s (%s)" % (name, where(entries[name]), e))
        found = cache[(mount, path)]
        if found is None:
            raise Unreadable("%s: no secret at %s/%s -- write it with `put %s`"
                             % (name, mount, path, name))
        data, _ = found
        if field not in data:
            raise Unreadable("%s: secret %s/%s has no field %r" % (name, mount, path, field))
        values[name] = str(data[field])
    return values


# -- authentication --------------------------------------------------------

def method():
    m = os.environ.get("VAULT_AUTH_METHOD", "ldap")
    if m not in ("ldap", "token"):
        die("VAULT_AUTH_METHOD must be ldap or token, not %r" % m)
    return m


def ldap_login(vault):
    """A token for the user's own LDAP login, held in memory only."""
    user = os.environ.get("VAULT_USER") or getpass.getuser()
    mount = os.environ.get("VAULT_AUTH_MOUNT") or "ldap"
    password = getpass.getpass("Password for %s: " % user)
    if not password:
        die("empty password")
    try:
        r = vault.call("POST", "auth/%s/login/%s" % (mount, urllib.parse.quote(user, safe="")),
                       body={"password": password})
    except VaultError as e:
        die("login failed for %s: %s" % (user, e), EXIT_LOGIN)
    return r["auth"]["client_token"]


def lookup(vault, token):
    try:
        return vault.call("GET", "auth/token/lookup-self", token)["data"]
    except VaultError as e:
        die("token rejected: %s" % e, EXIT_LOGIN)


def cmd_login(args):
    vault = Vault()
    if method() == "token":
        token = getpass.getpass("Vault token: ").strip()
        if not token:
            die("empty token")
        info = lookup(vault, token)
        if "root" in (info.get("policies") or []):
            die("refusing to store a root token on disk: create a narrower one")
        write_token(token)
        policies, ttl = info.get("policies"), info.get("ttl", 0)
    else:
        parent = ldap_login(vault)
        # The LDAP token carries every policy mapped to the user -- possibly
        # admin. Only a child limited to READ_POLICY is ever written to disk.
        try:
            child = vault.call("POST", "auth/token/create", parent, {
                "policies": [READ_POLICY],
                "ttl": CHILD_TTL,
                "display_name": "workstation",
                "meta": {"host": socket.gethostname()},
            })["auth"]
        except VaultError as e:
            die("cannot create a %s child token (%s). The %s policy needs "
                "`update` on auth/token/create -- see references/vault-layout.md"
                % (READ_POLICY, e, READ_POLICY))
        write_token(child["client_token"])
        policies, ttl = child.get("policies"), child.get("lease_duration", 0)
    print("logged in: policies %s, valid %dh%02dm, stored in ~/.vault-token (mode 600)"
          % (policies, ttl // 3600, ttl % 3600 // 60))


def cmd_exec(args, command):
    if not command:
        die("nothing to run: exec [VAR ...|--all] -- CMD [ARG ...]", EXIT_USAGE)
    entries = load_map(args.map)
    names = list(entries) if args.all else args.vars
    if not names:
        die("name the variables the command needs (or pass --all): exporting "
            "every secret into every command is what this refuses", EXIT_USAGE)
    unknown = [n for n in names if n not in entries]
    if unknown:
        die("not in %s: %s" % (args.map, ", ".join(unknown)), EXIT_USAGE)
    env = dict(os.environ)
    needed = [n for n in names if not os.environ.get(n)]
    if needed:
        vault = Vault()
        try:
            env.update(fetch(vault, require_token(), entries, needed))
        except Unreadable as e:
            die(str(e))
    try:
        os.execvpe(command[0], command, env)
    except FileNotFoundError:
        die("command not found: %s" % command[0], 127)


def cmd_check(args):
    entries = load_map(args.map)
    vault = Vault()
    try:
        vault.call("GET", "sys/health")
        print("vault: reachable, certificate verified")
    except VaultError as e:
        print("vault: reachable but not healthy (%s)" % e)
    token, ok = current_token(), True
    if token:
        try:
            info = vault.call("GET", "auth/token/lookup-self", token)["data"]
            ttl = info.get("ttl", 0)
            print("token: policies %s, %dh%02dm left" % (info.get("policies"), ttl // 3600, ttl % 3600 // 60))
        except VaultError:
            print("token: rejected (expired or revoked) -- run login")
            token = None
    else:
        print("token: none -- run login")
    for name, entry in entries.items():
        if os.environ.get(name):
            print("%s: set in the environment, shadows Vault (%s)" % (name, where(entry)))
        elif not token:
            print("%s: not checked, no valid token" % name)
            ok = False
        else:
            try:
                fetch(vault, token, entries, [name])
                print("%s: readable from %s" % (name, where(entry)))
            except Unreadable as e:
                print("%s: MISSING -- %s" % (name, str(e).split(": ", 1)[1]))
                ok = False
    sys.exit(0 if ok else EXIT_FAIL)


def cmd_put(args):
    entries = load_map(args.map)
    if args.var not in entries:
        die("not in %s: %s" % (args.map, args.var), EXIT_USAGE)
    mount, path, field = entries[args.var]
    vault = Vault()
    # A write never uses the stored read-only token: it takes VAULT_TOKEN or a
    # fresh login, held in memory only.
    if os.environ.get("VAULT_TOKEN"):
        token = os.environ["VAULT_TOKEN"]
    elif method() == "ldap":
        token = ldap_login(vault)
    else:
        token = getpass.getpass("Vault token with write access: ").strip()
    if sys.stdin.isatty():
        value = getpass.getpass("Value for %s (hidden): " % args.var)
    else:
        value = sys.stdin.read().rstrip("\r\n")
    if not value:
        die("empty value: nothing written")
    try:
        found = read_secret(vault, token, mount, path)
    except VaultError as e:
        die("cannot read %s before writing: %s" % (where(entries[args.var]), e))
    data, version = found if found is not None else ({}, 0)
    data[field] = value
    try:
        r = vault.call("POST", "%s/data/%s" % (mount, path), token,
                       {"options": {"cas": version}, "data": data})
    except VaultError as e:
        die("write to %s failed: %s" % (where(entries[args.var]), e))
    print("wrote %s to %s (version %s)" % (args.var, where(entries[args.var]),
                                           (r.get("data") or {}).get("version", "?")))


def cmd_logout(args):
    token = stored_token()
    if token:
        if os.environ.get("VAULT_ADDR"):
            try:
                Vault().call("POST", "auth/token/revoke-self", token)
            except VaultError:
                pass  # already expired or revoked; the file goes either way
        else:
            print("VAULT_ADDR unset: token not revoked, it expires on its own", file=sys.stderr)
        os.remove(token_path())
    print("logged out")


def main(argv):
    command = []
    if "--" in argv:
        i = argv.index("--")
        argv, command = argv[:i], argv[i + 1:]
    ap = argparse.ArgumentParser(prog="vault_secrets.py", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("login")
    p = sub.add_parser("exec")
    p.add_argument("--map", default="secrets.map")
    p.add_argument("--all", action="store_true")
    p.add_argument("vars", nargs="*", metavar="VAR")
    p = sub.add_parser("check")
    p.add_argument("--map", default="secrets.map")
    p = sub.add_parser("put")
    p.add_argument("--map", default="secrets.map")
    p.add_argument("var", metavar="VAR")
    sub.add_parser("logout")
    args = ap.parse_args(argv)
    if args.cmd != "exec" and command:
        die("`--` is only for exec", EXIT_USAGE)
    if args.cmd == "exec":
        cmd_exec(args, command)
    else:
        {"login": cmd_login, "check": cmd_check, "put": cmd_put, "logout": cmd_logout}[args.cmd](args)


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except KeyboardInterrupt:
        die("interrupted", 130)
