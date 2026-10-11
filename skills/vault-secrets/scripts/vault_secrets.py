#!/usr/bin/env python3
"""Fetch secrets from HashiCorp Vault into one command's environment.

Environment variables stay the interface (ADR-0009); Vault owns the values
(ADR-0030, TASK-0131). A map file names which variable comes from which KV v2
secret -- names and paths only, never values:

    GITHUB_TOKEN=kv/ai-toolbox/github#token

A project may instead declare where its values live in a tracked secrets.conf
(ADR-0034): backend = local | vault | gitlab | github. With no secrets.conf,
the map-driven Vault behaviour above applies unchanged.

Subcommands:
  init --backend B --project P
                         write secrets.conf and the files that backend needs;
                         a second identical run changes nothing
  login                  LDAP: store a read-only child token in ~/.vault-token
                         (mode 600). approle: verify the credential, store nothing
  exec VAR... -- CMD...  fetch the named variables, then exec CMD with them
                         set; --all exports every mapped variable instead
  check                  report, by name only, what is readable and what an
                         exported variable shadows
  put VAR                write one value, read from stdin, with a fresh login
                         (AppRole, LDAP or VAULT_TOKEN) -- never the stored token.
                         local backend: into .env, mode 600
  logout                 revoke the stored token and delete the file
  provision [--dry-run]  vault backend: create the project's own KV v2 mount,
                         its read/write/app policies and its AppRole, with an
                         admin token held in memory; never deletes or rewrites

Configuration, from the environment:
  VAULT_ADDR         https://<host>:<port> -- required. http:// is refused
                     unless the host is loopback.
  VAULT_CACERT       PEM file of the CA that issued Vault's certificate
                     (default: the system trust store).
  VAULT_AUTH_METHOD  ldap (default), approle or token.
  VAULT_AUTH_MOUNT   auth mount path (default: the method's name).
  VAULT_USER         login name for ldap (default: the current user).
  VAULT_APPROLE_FILE approle: JSON file holding role_id and secret_id, mode 600.
                     Each command logs in with it; the token it gets is revoked
                     as soon as the values are fetched (ADR-0031).
  VAULT_TOKEN        use this token instead of logging in or ~/.vault-token.
  VAULT_SECRETS_MAPS colon-separated map files, used when no --map is given
                     (default: secrets.map). --map may be repeated; a variable
                     mapped twice is an error.

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
import stat
import subprocess
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

CONF_FILE, ENV_FILE, ENV_EXAMPLE, MAP_FILE = "secrets.conf", ".env", ".env.example", "secrets.map"
BACKENDS = ("local", "vault", "gitlab", "github")
# key -> the backend it belongs to (None: every backend).
CONF_KEYS = {"backend": None, "project": None, "gitlab_project": "gitlab", "github_repo": "github"}
PROJECT_NAME = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")
REPO_PATH = re.compile(r"^[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)+$")
# A project's name becomes its Vault mount: never one Vault or the shared store owns.
RESERVED_MOUNTS = {"sys", "auth", "identity", "cubbyhole", "kv", "secret"}
ENV_LINE = re.compile(r"^(?:export\s+)?(?P<var>[A-Z_][A-Z0-9_]*)=(?P<value>.*)$")
EXAMPLE_NAME = re.compile(r"(?m)^([A-Z_][A-Z0-9_]*)=")
# Appended together, in this order: `!.env.example` must come after `.env.*`.
GITIGNORE_LINES = (".env", ".env.*", "!.env.example")


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


def session_token(vault):
    """(token, minted) for reading: VAULT_TOKEN, else an AppRole login, else the
    stored token. A minted token was created for this command alone and is
    revoked by the caller as soon as it is done with it."""
    if os.environ.get("VAULT_TOKEN"):
        return os.environ["VAULT_TOKEN"], False
    if method() == "approle":
        return approle_login(vault), True
    return stored_token(), False


def revoke(vault, token):
    try:
        vault.call("POST", "auth/token/revoke-self", token)
    except VaultError:
        pass  # already expired or revoked


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


def map_paths(args):
    if args.map:
        paths = args.map
    elif os.environ.get("VAULT_SECRETS_MAPS"):
        paths = [p for p in os.environ["VAULT_SECRETS_MAPS"].split(":") if p]
    else:
        paths = ["secrets.map"]
    return [os.path.expanduser(p) for p in paths]


def load_maps(paths):
    entries, source = {}, {}
    for path in paths:
        for var, entry in load_map(path).items():
            if var in entries:
                die("%s is mapped twice: in %s and in %s" % (var, source[var], path))
            entries[var], source[var] = entry, path
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


# -- the declared backend (ADR-0034) ---------------------------------------

def load_conf(path=CONF_FILE):
    """The declared backend, or None when the project declares none."""
    try:
        with open(path, encoding="utf-8") as fh:
            lines = fh.read().splitlines()
    except FileNotFoundError:
        return None
    conf = {}
    for n, line in enumerate(lines, 1):
        text = line.strip()
        if not text or text.startswith("#"):
            continue
        key, sep, value = text.partition("=")
        key, value = key.strip(), value.strip()
        if not sep or key not in CONF_KEYS:
            die("%s:%d: expected one of %s = <value>" % (path, n, ", ".join(CONF_KEYS)))
        if key in conf:
            die("%s:%d: %s is set twice" % (path, n, key))
        conf[key] = value
    return validate_conf(conf, path)


def validate_conf(conf, source):
    backend = conf.get("backend")
    if backend not in BACKENDS:
        die("%s: backend must be one of %s" % (source, ", ".join(BACKENDS)))
    project = conf.get("project") or ""
    if not PROJECT_NAME.match(project):
        die("%s: project must match [a-z0-9][a-z0-9-]{0,62}" % source)
    if project in RESERVED_MOUNTS:
        die("%s: project %r is a reserved Vault mount name" % (source, project))
    for key, owner in CONF_KEYS.items():
        if owner is None:
            continue
        if owner == backend and not conf.get(key):
            die("%s: backend %s needs %s" % (source, backend, key))
        if owner != backend and conf.get(key):
            die("%s: %s belongs to backend %s, not %s" % (source, key, owner, backend))
        if conf.get(key) and not REPO_PATH.match(conf[key]):
            die("%s: %s must look like group/name" % (source, key))
    return conf


def render_conf(conf):
    lines = ["# Where this project's secret values live (ADR-0034 in ai-toolbox).",
             "# Names only, never a value. Written by vault_secrets.py init; to change",
             "# backend, edit it by hand and run init again.",
             ""]
    lines += ["%s = %s" % (k, conf[k]) for k in CONF_KEYS if conf.get(k)]
    return "\n".join(lines) + "\n"


def write_text(path, text, mode=None):
    """Replace PATH atomically; with MODE, the file never exists with a looser one."""
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(path)), prefix=".%s." % os.path.basename(path))
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        os.chmod(tmp, mode if mode is not None else 0o644)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def read_lines(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return fh.read().splitlines()
    except FileNotFoundError:
        return None


def ensure_gitignore():
    """Append the .env ignores if any is missing. True if .gitignore changed."""
    lines = read_lines(".gitignore")
    present = {l.strip() for l in lines or []}
    if all(l in present for l in GITIGNORE_LINES):
        return False
    # All three, in order, even if one exists: a lone earlier `!.env.example`
    # followed by an appended `.env.*` would ignore the template.
    block = ["# Local secret values are never committed (vault_secrets.py init)"] + list(GITIGNORE_LINES)
    text = "\n".join((lines or []) + ([""] if lines else []) + block) + "\n"
    write_text(".gitignore", text)
    return True


def cmd_init(args):
    conf = {"backend": args.backend, "project": args.project,
            "gitlab_project": args.gitlab_project, "github_repo": args.github_repo}
    conf = validate_conf({k: v for k, v in conf.items() if v}, "init")
    existing, changed = load_conf(), []
    if existing is None:
        write_text(CONF_FILE, render_conf(conf))
        changed.append(CONF_FILE)
    elif existing != conf:
        die("%s already declares backend=%s project=%s: edit it by hand to change it"
            % (CONF_FILE, existing["backend"], existing["project"]))
    if ensure_gitignore():
        changed.append(".gitignore")
    if read_lines(ENV_EXAMPLE) is None:
        write_text(ENV_EXAMPLE, "# Every variable this project reads: names and placeholders, never a value.\n"
                                "# EXAMPLE_TOKEN=\n")
        changed.append(ENV_EXAMPLE)
    if conf["backend"] == "vault" and read_lines(MAP_FILE) is None:
        write_text(MAP_FILE, "# Which variable comes from which secret in this project's own KV v2\n"
                             "# mount: names and paths only, never a value. Every variable here also\n"
                             "# appears in .env.example.\n"
                             "# EXAMPLE_TOKEN=%s/example#token\n" % conf["project"])
        changed.append(MAP_FILE)
    print("init: %s" % (", ".join(changed) + " written" if changed else "nothing to change"))
    print("next: " + {
        "local": "name each variable in .env.example, then `put VAR` writes it to .env (mode 600)",
        "vault": "a Vault admin runs `provision`; then map each variable in secrets.map and `put` it",
        "gitlab": "name each variable in .env.example, then `put VAR` sets it as a GitLab CI variable",
        "github": "name each variable in .env.example, then `put VAR` sets it as a GitHub Actions secret",
    }[conf["backend"]])


# -- the local backend: a git-ignored .env --------------------------------

def example_names():
    lines = read_lines(ENV_EXAMPLE)
    if lines is None:
        die("%s not found: run `vault_secrets.py init`" % ENV_EXAMPLE)
    return list(dict.fromkeys(EXAMPLE_NAME.findall("\n".join(lines))))


def load_dotenv():
    values = {}
    for n, line in enumerate(read_lines(ENV_FILE) or [], 1):
        text = line.strip()
        if not text or text.startswith("#"):
            continue
        m = ENV_LINE.match(text)
        if not m:
            die("%s:%d: expected VAR=value" % (ENV_FILE, n))  # never echoed: it may be a value
        value = m["value"]
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[m["var"]] = value
    return values


def git_ignored(path):
    """True or False, or None outside a git work tree (or without git)."""
    try:
        rc = subprocess.run(["git", "check-ignore", "-q", "--no-index", path],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode
    except FileNotFoundError:
        return None
    return {0: True, 1: False}.get(rc)


def known_local(names):
    unknown = [n for n in names if n not in example_names()]
    if unknown:
        die("not in %s: %s" % (ENV_EXAMPLE, ", ".join(unknown)), EXIT_USAGE)


def exec_local(args, command):
    names = example_names() if args.all else args.vars
    if not names:
        die("name the variables the command needs (or pass --all)", EXIT_USAGE)
    known_local(names)
    values, env = load_dotenv(), dict(os.environ)
    for name in names:
        if os.environ.get(name):
            continue
        if not values.get(name):
            die("%s: not set in %s -- write it with `put %s`" % (name, ENV_FILE, name))
        env[name] = values[name]
    run_command(command, env)


def put_local(var):
    known_local([var])
    if git_ignored(ENV_FILE) is False:
        die("refusing to write: %s is not git-ignored -- run `vault_secrets.py init`" % ENV_FILE)
    value = read_value(var)
    if "\n" in value or "\r" in value:
        die("a %s value is one line: nothing written" % ENV_FILE)
    if value != value.strip() or value[0] in "\"'":
        value = "'%s'" % value  # the reader strips exactly one outer pair
    out, replaced = [], False
    for line in read_lines(ENV_FILE) or []:
        m = ENV_LINE.match(line.strip())
        if m and m["var"] == var:
            if not replaced:
                out.append("%s=%s" % (var, value))
            replaced = True
            continue
        out.append(line)
    if not replaced:
        out.append("%s=%s" % (var, value))
    write_text(ENV_FILE, "\n".join(out) + "\n", mode=0o600)
    print("wrote %s to %s (mode 600)" % (var, ENV_FILE))


def check_local():
    ok, ignored = True, git_ignored(ENV_FILE)
    if ignored is None:
        print("%s: not in a git work tree, ignore rule not checked" % ENV_FILE)
    elif ignored:
        print("%s: git-ignored" % ENV_FILE)
    else:
        print("%s: NOT git-ignored -- run `vault_secrets.py init`" % ENV_FILE)
        ok = False
    if os.name != "nt" and os.path.exists(ENV_FILE):
        mode = stat.S_IMODE(os.stat(ENV_FILE).st_mode)
        if mode & 0o077:
            print("%s: readable by group or others (mode %03o) -- chmod 600 it" % (ENV_FILE, mode))
            ok = False
    values = load_dotenv()
    for name in example_names():
        if os.environ.get(name):
            print("%s: set in the environment, shadows %s" % (name, ENV_FILE))
        elif values.get(name):
            print("%s: set in %s" % (name, ENV_FILE))
        else:
            print("%s: MISSING -- write it with `put %s`" % (name, name))
            ok = False
    sys.exit(0 if ok else EXIT_FAIL)


# -- provisioning a project's own mount (ADR-0034) --------------------------

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# ADR-0031's limits: tokens live 10m (at most 30m), a secret_id one year.
ROLE_LIMITS = {"token_ttl": 600, "token_max_ttl": 1800, "secret_id_ttl": 31536000}


def asset(name):
    return os.path.join(SKILL_DIR, "assets", name)


def policy_texts(mount):
    texts = {}
    for suffix, path in (("read", asset("policies/read.hcl")), ("write", asset("policies/write.hcl")),
                         ("app", asset("policies/app.hcl"))):
        with open(path, encoding="utf-8") as fh:
            texts["%s-%s" % (mount, suffix)] = fh.read().replace("@@MOUNT@@", mount)
    return texts


def vault_project(cmd):
    conf = load_conf()
    if not conf or conf["backend"] != "vault":
        die("%s needs a %s declaring backend = vault (run init)" % (cmd, CONF_FILE), EXIT_USAGE)
    return conf["project"]


def admin_get(vault, token, path, absent=(404,)):
    """GET with the admin token: the data, or None when the object is absent."""
    try:
        r = vault.call("GET", path, token)
    except VaultError as e:
        if e.status in absent:
            return None
        die("cannot read %s (%s): the token needs the secrets-provisioner policy "
            "-- see references/vault-layout.md" % (path, e))
    return r.get("data", r)


def plan_provision(vault, token, mount, policies):
    """(writes, kept). Everything is read before anything is written, so a
    refusal leaves Vault exactly as it was."""
    writes, kept, role = [], [], dict(ROLE_LIMITS, token_policies=["%s-app" % mount])
    found = admin_get(vault, token, "sys/mounts/%s" % mount, absent=(400, 404))
    if found is None:
        writes.append(("POST", "sys/mounts/%s" % mount, {"type": "kv", "options": {"version": "2"},
                       "description": "%s secrets (ADR-0034)" % mount}, "mount %s/ (KV v2)" % mount))
    elif found.get("type") != "kv" or str((found.get("options") or {}).get("version")) != "2":
        die("mount %s/ exists and is not KV v2 (type %s): refusing to touch it" % (mount, found.get("type")))
    else:
        kept.append("mount %s/ (KV v2)" % mount)
    for name, text in policies.items():
        found = admin_get(vault, token, "sys/policies/acl/%s" % name)
        if found is None:
            writes.append(("PUT", "sys/policies/acl/%s" % name, {"policy": text}, "policy %s" % name))
        elif (found.get("policy") or "").strip() != text.strip():
            die("policy %s exists with a different body: refusing to overwrite it" % name)
        else:
            kept.append("policy %s" % name)
    if "approle/" not in (admin_get(vault, token, "sys/auth") or {}):
        die("the approle auth method is not enabled: a Vault admin enables it; provision never does")
    found = admin_get(vault, token, "auth/approle/role/%s" % mount)
    if found is None:
        writes.append(("POST", "auth/approle/role/%s" % mount, role, "AppRole %s" % mount))
    elif any(found.get(k) != v for k, v in role.items()):
        die("AppRole %s exists with different settings: refusing to change it" % mount)
    else:
        kept.append("AppRole %s" % mount)
    return writes, kept


def admin_token(vault):
    """(token, minted): VAULT_TOKEN, a fresh LDAP login, or a pasted token --
    held in memory only. An application identity never provisions."""
    if os.environ.get("VAULT_TOKEN"):
        return os.environ["VAULT_TOKEN"], False
    if method() == "approle":
        die("an AppRole identity cannot provision: log in as the Vault admin (ldap or token)")
    if method() == "ldap":
        return ldap_login(vault), True
    token = getpass.getpass("Vault admin token (held in memory, never stored): ").strip()
    if not token:
        die("empty token")
    return token, False


def cmd_provision(args):
    mount = vault_project("provision")
    policies = policy_texts(mount)
    if args.dry_run:
        print("dry run: nothing read, nothing written")
        print("would ensure mount %s/ (KV v2)" % mount)
        for name, text in policies.items():
            print("would ensure policy %s:\n%s" % (name, "".join("  " + l for l in text.splitlines(True))))
        print("would ensure AppRole %s: token_policies [%s-app], ttl 10m, max 30m, secret_id_ttl 8760h"
              % (mount, mount))
    else:
        vault = Vault()
        token, minted = admin_token(vault)
        try:
            if "root" in (lookup(vault, token).get("policies") or []):
                die("refusing a root token: use one with the secrets-provisioner policy "
                    "(references/vault-layout.md)")
            writes, kept = plan_provision(vault, token, mount, policies)
            for what in kept:
                print("unchanged: %s" % what)
            for verb, path, body, what in writes:
                try:
                    vault.call(verb, path, token, body)
                except VaultError as e:
                    die("creating %s failed: %s" % (what, e))
                print("created: %s" % what)
        finally:
            if minted:
                revoke(vault, token)
    print("ldap: who may read %s/ is the estate's call -- it maps %s-read (and %s-write) to "
          "groups; provision never configures LDAP" % (mount, mount, mount))
    print("approle: one secret_id per host is a human step -- runbook, *New project secrets*")


def read_value(var):
    if sys.stdin.isatty():
        value = getpass.getpass("Value for %s (hidden): " % var)
    else:
        value = sys.stdin.read().rstrip("\r\n")
    if not value:
        die("empty value: nothing written")
    return value


# -- authentication --------------------------------------------------------

def method():
    m = os.environ.get("VAULT_AUTH_METHOD", "ldap")
    if m not in ("ldap", "approle", "token"):
        die("VAULT_AUTH_METHOD must be ldap, approle or token, not %r" % m)
    return m


def approle_login(vault):
    """A short-lived token from the AppRole credential file, held in memory only."""
    path = os.path.expanduser(os.environ.get("VAULT_APPROLE_FILE") or "")
    if not path:
        die("VAULT_AUTH_METHOD=approle needs VAULT_APPROLE_FILE (the role_id/secret_id file)")
    try:
        mode = stat.S_IMODE(os.stat(path).st_mode)
    except FileNotFoundError:
        die("AppRole credential file not found: %s" % path)
    if mode & 0o077:
        # Checked before the file is even read. On /mnt/c every file reads as
        # 0777, so a credential copied there is refused rather than trusted.
        die("%s is readable by group or others (mode %03o): chmod 600 it, on the "
            "Linux filesystem -- /mnt/c cannot hold it" % (path, mode))
    try:
        with open(path, encoding="utf-8") as fh:
            cred = json.load(fh)
        body = {"role_id": cred["role_id"], "secret_id": cred["secret_id"]}
    except (ValueError, KeyError, TypeError):
        die("%s: expected JSON with role_id and secret_id" % path)
    mount = os.environ.get("VAULT_AUTH_MOUNT") or "approle"
    try:
        return vault.call("POST", "auth/%s/login" % mount, body=body)["auth"]["client_token"]
    except VaultError as e:
        die("AppRole login failed: %s" % e, EXIT_LOGIN)


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
    if method() == "approle":
        token = approle_login(vault)
        info = lookup(vault, token)
        revoke(vault, token)
        print("approle: the credential logs in, policies %s. Nothing stored: each "
              "command logs in for itself." % info.get("policies"))
        return
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
        # admin. Only a child limited to READ_POLICY (and, for a project with
        # its own mount, that mount's read policy) is ever written to disk.
        wanted, conf = [READ_POLICY], load_conf()
        if conf and conf["backend"] == "vault":
            extra = "%s-read" % conf["project"]
            if extra in (lookup(vault, parent).get("policies") or []):
                wanted.append(extra)
            else:
                print("warning: your login does not carry %s, so the stored token cannot read %s/ "
                      "-- the estate maps it" % (extra, conf["project"]), file=sys.stderr)
        try:
            child = vault.call("POST", "auth/token/create", parent, {
                "policies": wanted,
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
    entries = load_maps(args.maps)
    names = list(entries) if args.all else args.vars
    if not names:
        die("name the variables the command needs (or pass --all): exporting "
            "every secret into every command is what this refuses", EXIT_USAGE)
    unknown = [n for n in names if n not in entries]
    if unknown:
        die("not in %s: %s" % (", ".join(args.maps), ", ".join(unknown)), EXIT_USAGE)
    env = dict(os.environ)
    needed = [n for n in names if not os.environ.get(n)]
    if needed:
        vault = Vault()
        token, minted = session_token(vault)
        if not token:
            die("not logged in: run `vault_secrets.py login`", EXIT_LOGIN)
        try:
            env.update(fetch(vault, token, entries, needed))
        except Unreadable as e:
            die(str(e))
        finally:
            # The child never needs Vault, so a token minted for this command
            # dies before the child starts.
            if minted:
                revoke(vault, token)
    run_command(command, env)


def run_command(command, env, spawn=os.name == "nt"):
    """Become COMMAND, or on Windows run it and exit with its status.

    Windows has no exec: os.execvpe there starts the command and exits at
    once, so the caller sees status 0 before the command has finished, and
    an MSYS program started that way can crash (TASK-0149).
    """
    try:
        if spawn:
            sys.exit(subprocess.run(command, env=env).returncode)
        os.execvpe(command[0], command, env)
    except FileNotFoundError:
        die("command not found: %s" % command[0], 127)


def cmd_check(args):
    entries = load_maps(args.maps)
    conf = load_conf()
    if conf and conf["backend"] == "vault":
        for name, entry in entries.items():
            if entry[0] != conf["project"]:
                print("%s: on mount %s, outside this project's own %s/" % (name, entry[0], conf["project"]))
    vault = Vault()
    try:
        vault.call("GET", "sys/health")
        print("vault: reachable, certificate verified")
    except VaultError as e:
        print("vault: reachable but not healthy (%s)" % e)
    (token, minted), ok = session_token(vault), True
    if token:
        try:
            info = vault.call("GET", "auth/token/lookup-self", token)["data"]
            ttl = info.get("ttl", 0)
            print("token: policies %s, %dh%02dm left%s" % (info.get("policies"), ttl // 3600, ttl % 3600 // 60,
                                                          " (AppRole, revoked after this check)" if minted else ""))
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
    if minted and token:
        revoke(vault, token)
    sys.exit(0 if ok else EXIT_FAIL)


def cmd_put(args):
    entries = load_maps(args.maps)
    if args.var not in entries:
        die("not in %s: %s" % (", ".join(args.maps), args.var), EXIT_USAGE)
    vault = Vault()
    # A write never uses the stored read-only token: it takes VAULT_TOKEN or a
    # fresh login, held in memory only and revoked once the write is done.
    minted = False
    if os.environ.get("VAULT_TOKEN"):
        token = os.environ["VAULT_TOKEN"]
    elif method() == "approle":
        token, minted = approle_login(vault), True
    elif method() == "ldap":
        token, minted = ldap_login(vault), True
    else:
        token = getpass.getpass("Vault token with write access: ").strip()
    try:
        write_value(vault, token, entries, args.var)
    finally:
        if minted:
            revoke(vault, token)


def write_value(vault, token, entries, var):
    mount, path, field = entries[var]
    value = read_value(var)
    try:
        found = read_secret(vault, token, mount, path)
    except VaultError as e:
        die("cannot read %s before writing: %s" % (where(entries[var]), e))
    data, version = found if found is not None else ({}, 0)
    data[field] = value
    try:
        r = vault.call("POST", "%s/data/%s" % (mount, path), token,
                       {"options": {"cas": version}, "data": data})
    except VaultError as e:
        die("write to %s failed: %s" % (where(entries[var]), e))
    print("wrote %s to %s (version %s)" % (var, where(entries[var]),
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
    p = sub.add_parser("init")
    p.add_argument("--backend", required=True, choices=BACKENDS)
    p.add_argument("--project", required=True)
    p.add_argument("--gitlab-project", metavar="GROUP/NAME")
    p.add_argument("--github-repo", metavar="OWNER/NAME")
    sub.add_parser("login")
    p = sub.add_parser("exec")
    p.add_argument("--map", action="append", metavar="FILE")
    p.add_argument("--all", action="store_true")
    p.add_argument("vars", nargs="*", metavar="VAR")
    p = sub.add_parser("check")
    p.add_argument("--map", action="append", metavar="FILE")
    p = sub.add_parser("put")
    p.add_argument("--map", action="append", metavar="FILE")
    p.add_argument("var", metavar="VAR")
    sub.add_parser("logout")
    p = sub.add_parser("provision")
    p.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)
    args.maps = map_paths(args) if hasattr(args, "map") else []
    if args.cmd != "exec" and command:
        die("`--` is only for exec", EXIT_USAGE)
    backend = (load_conf() or {}).get("backend", "vault") if args.cmd in ("exec", "check", "put") else None
    if backend not in (None, "vault") and args.map:
        die("--map is for the vault backend; %s declares %s" % (CONF_FILE, backend), EXIT_USAGE)
    if backend == "local":
        if args.cmd == "exec":
            if not command:
                die("nothing to run: exec [VAR ...|--all] -- CMD [ARG ...]", EXIT_USAGE)
            exec_local(args, command)
        elif args.cmd == "check":
            check_local()
        else:
            put_local(args.var)
    elif backend in ("gitlab", "github"):
        if args.cmd == "exec":
            # GitHub secrets cannot be read back at all; GitLab's would need a
            # GitLab token over the network for every command. CI owns them.
            die("backend %s: values live in CI and are not readable here -- a local run "
                "exports the variable itself (it wins over any store)" % backend, EXIT_USAGE)
        die("backend %s: %s is not implemented yet -- use the platform's settings page"
            % (backend, args.cmd), EXIT_USAGE)
    elif args.cmd == "exec":
        cmd_exec(args, command)
    else:
        {"init": cmd_init, "login": cmd_login, "check": cmd_check, "put": cmd_put,
         "logout": cmd_logout, "provision": cmd_provision}[args.cmd](args)


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except KeyboardInterrupt:
        die("interrupted", 130)
