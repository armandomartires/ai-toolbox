"""Repository-selected session tokens (ADR-0057; sigma-infrastructure ADR 0036).

The caller supplies the legacy loader API and a keychain implementation. No
keychain backend or Vault is selected by a shell project identity. Project
operations deliberately do not use lookup-self on no-default-policy tokens.
"""
import base64
import binascii
from contextlib import contextmanager
import ctypes
import hashlib
import json
import math
import os
import re
import stat
import time

MAX_TTL = 8 * 3600
DAILY_POLICIES = {"developer", "default"}


class SessionVault:
    session_mode = True

    def __init__(self, api):
        self.api, self.base = api, api["Vault"]()
        self.addr = self.base.addr

    def call(self, method, path, token=None, body=None):
        try:
            return self.base.call(method, path, token, body)
        except self.api["VaultError"] as exc:
            # Do not trust a server error body to exclude submitted credentials.
            raise self.api["VaultError"](exc.status, ["request rejected"]) from None


class SessionModel:
    def __init__(self, api, conf, store):
        self.api, self.conf, self.store = api, conf, store
        self.role = conf["vault_role"]
        self.vault = SessionVault(api)
        self.mount = os.environ.get("VAULT_LDAP_MOUNT") or "ldap"
        if not re.fullmatch(r"[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*", self.mount):
            self.die("VAULT_LDAP_MOUNT is not a safe LDAP mount path", 2)
        identity = self.vault.addr + "\n" + self.mount
        self.key = "vault-secrets-session-" + hashlib.sha256(identity.encode()).hexdigest()

    def die(self, message, code=1):
        self.api["die"](message, code)

    def policies(self, data):
        result = set()
        for key in ("policies", "token_policies", "identity_policies"):
            values = data.get(key) or []
            if not isinstance(values, list) or not all(isinstance(v, str) for v in values):
                self.die("Vault returned invalid token policy metadata", 3)
            result.update(values)
        return result

    def token(self, value):
        if not isinstance(value, str) or len(value) > 4096 or not re.fullmatch(r"[A-Za-z0-9._-]+", value):
            self.die("Vault returned no safely transferable service token", 3)
        return value

    def revoke(self, token, kind="project token"):
        try:
            self.vault.call("POST", "auth/token/revoke-self", token)
        except self.api["VaultError"] as exc:
            self.die("cannot confirm revocation of %s (HTTP %d); refusing to continue. "
                     "The project app policy needs explicit update on auth/token/revoke-self" % (kind, exc.status), 3)

    def encode(self, record):
        return base64.b64encode(json.dumps(record, separators=(",", ":"), ensure_ascii=True).encode()).decode("ascii")

    def load_session(self, prompt=False, quiet=False):
        raw = self.store.get(self.key)
        if raw is not None:
            try:
                data = json.loads(base64.b64decode(raw, validate=True))
                if not isinstance(data, dict) or set(data["policies"]) != DAILY_POLICIES:
                    raise ValueError()
                self.token(data["token"])
                expiry = float(data["expires_at"])
                if not math.isfinite(expiry) or expiry > time.time() + MAX_TTL + 5:
                    raise ValueError()
            except (ValueError, TypeError, KeyError, binascii.Error):
                self.die("invalid daily-session keychain record; run login", 3)
            if expiry > time.time():
                return data
            self.store.delete(self.key)
        if prompt:
            return self.login(announce=not quiet)
        return None

    def login(self, announce=True):
        parent = self.api["ldap_login"](self.vault, mount=self.mount)
        retained = False
        try:
            info = self.api["lookup"](self.vault, parent)
            policies = self.policies(info)
            if policies & {"admin", "root"}:
                self.die("refusing an admin or root daily session; use the daily LDAP identity", 3)
            if "developer" not in policies or not policies <= DAILY_POLICIES | {"workstation-read"}:
                self.die("daily login must carry developer and only the required self-service policies", 3)
            ttl = info.get("ttl", 0)
            if not isinstance(ttl, (int, float)) or not 0 < ttl <= MAX_TTL:
                self.die("daily LDAP session must have a positive lifetime of at most 8h", 3)
            token = parent
            if policies != DAILY_POLICIES:
                # During the transition workstation-read permits generic create.
                # Its secret-reading rights are never retained in the keychain.
                try:
                    auth = self.vault.call("POST", "auth/token/create", parent, {
                        "policies": ["developer"], "no_default_policy": False,
                        "no_parent": False, "ttl": "8h", "explicit_max_ttl": "8h",
                        "renewable": False, "display_name": "daily-project-session",
                    })["auth"]
                except (self.api["VaultError"], KeyError, TypeError):
                    self.die("cannot narrow the daily session to developer plus default; no broad token stored", 3)
                token = self.token(auth.get("client_token"))
                policies = self.policies(auth)
                if policies != DAILY_POLICIES or auth.get("orphan") is not False:
                    self.die("refusing a daily session with broader policies or no parent", 3)
                ttl = min(ttl, auth.get("lease_duration", 0))
                if ttl <= 0:
                    self.die("daily session has no positive lifetime", 3)
            record = {"token": self.token(token), "policies": sorted(policies),
                      "expires_at": time.time() + ttl}
            self.store.set(self.key, self.encode(record))
            retained = True
            if announce:
                print("logged in: daily project session, valid %dh%02dm, stored in OS keychain" % (ttl // 3600, ttl % 3600 // 60))
            return record
        finally:
            # Failure (including a keychain refusal) keeps no fresh login alive.
            # On successful narrowing, revoking parent would revoke the retained
            # child too; its parent remains unstored and expires normally.
            if not retained:
                self.revoke(parent, "new daily login")

    def entries(self, args):
        entries = self.api["load_maps"](args.maps)
        self.validate_entries(entries)
        return entries

    def validate_entries(self, entries):
        mount = os.environ.get("VAULT_PROJECTS_MOUNT") or ""
        if not re.fullmatch(r"[A-Za-z0-9_-]+", mount):
            self.die("VAULT_PROJECTS_MOUNT must name the shared projects mount; no private name is written by init", 2)
        if any(entry[0] != mount or not entry[1].startswith(self.role + "/")
               or any(part in (".", "..") for part in entry[1].split("/")) for entry in entries.values()):
            self.die("session map entries must stay under the configured mount and vault_role prefix", 2)

    def issue(self, session, agent=False):
        token = None
        try:
            role = self.role + ("-agent" if agent else "")
            try:
                auth = self.vault.call("POST", "auth/token/create/" + role, session["token"], {
                    "policies": [self.role + "-app"], "no_default_policy": True,
                    "no_parent": False, "type": "service", "ttl": "8h", "explicit_max_ttl": "8h",
                }).get("auth") or {}
            except self.api["VaultError"] as exc:
                self.die("cannot issue the configured project token (HTTP %d); run login or ask the owner to check the role" % exc.status, 3)
            token = self.token(auth.get("client_token"))
            ttl = auth.get("lease_duration", 0)
            if self.policies(auth) != {self.role + "-app"} or auth.get("orphan") is not False \
                    or auth.get("token_type") != "service" or not isinstance(ttl, (int, float)) or not 0 < ttl <= MAX_TTL:
                self.die("refusing a project token whose policies, parent, type or lifetime differ from its role", 3)
            return token
        except BaseException:
            if token:
                self.revoke(token)
            raise

    @contextmanager
    def issued(self, prompt=True):
        session = self.load_session(prompt)
        if session is None:
            self.die("no daily session in the OS keychain; run login", 3)
        token = self.issue(session)
        try:
            yield token
        finally:
            self.revoke(token)

    def exec(self, args, command):
        if not command:
            self.die("nothing to run: exec VAR... -- CMD...", 2)
        entries = self.entries(args)
        names = list(entries) if args.all else args.vars
        if not names or any(n not in entries for n in names):
            self.die("name only the mapped variables the command needs", 2)
        # No shell token or AppRole identity is passed implicitly to the child.
        env = {k: v for k, v in os.environ.items() if k not in {
            "VAULT_TOKEN", "VAULT_APPROLE_FILE", "VAULT_SECRETS_MAPS", "VAULT_AUTH_METHOD"} and k not in entries}
        with self.issued() as token:
            try:
                env.update(self.api["fetch"](self.vault, token, entries, names))
            except self.api["Unreadable"] as exc:
                self.die(str(exc))
        # The token has already been revoked, including when the child fails or
        # POSIX exec replaces this process. No token is handed to this command.
        self.api["run_command"](command, env)

    def check(self, args):
        entries = self.entries(args)
        session = self.load_session()
        if session is None:
            print("session: none in OS keychain; run login")
            for name in entries:
                print(name + ": not checked, no daily session")
            self.die("no daily session", 3)
        seconds = max(0, int(session["expires_at"] - time.time()))
        print("session: %dh%02dm left (keychain expiry); project tokens have no default policy" % (seconds // 3600, seconds % 3600 // 60))
        ok = True
        with self.issued(prompt=False) as token:
            for name in entries:
                try:
                    self.api["fetch"](self.vault, token, entries, [name])
                    print(name + ": readable")
                except self.api["Unreadable"]:
                    print(name + ": MISSING or unreadable")
                    ok = False
        if not ok:
            self.die("one or more mapped variables are unreadable")

    def put(self, args):
        entries = self.entries(args)
        if args.var not in entries:
            self.die("variable is not in the project map", 2)
        with self.issued() as token:
            self.api["write_value"](self.vault, token, entries, args.var)

    def write_import(self, entries, plan, source):
        self.validate_entries(entries)
        with self.issued() as token:
            for name in plan:
                self.api["write_value"](self.vault, token, entries, name, source[name])

    def logout(self):
        record = self.load_session()
        if record:
            self.revoke(record["token"], "daily session")
        self.store.delete(self.key)
        print("logged out of OS keychain session")

    def handoff(self, args):
        if args.agent != self.role:
            self.die("--agent must match this repository's vault_role", 2)
        # Validate the transport before minting anything. Regular files,
        # terminals and stdout/stderr are never valid destinations.
        if args.token_fd is not None:
            fd = args.token_fd
            try:
                valid = fd > 2 and (stat.S_ISFIFO(os.fstat(fd).st_mode) or stat.S_ISSOCK(os.fstat(fd).st_mode))
            except OSError:
                valid = False
            if not valid:
                self.die("--token-fd must be an inherited pipe or socket descriptor above 2", 2)
            def send(data):
                while data:
                    count = os.write(fd, data)
                    if count <= 0:
                        raise OSError()
                    data = data[count:]
        else:
            if os.name != "nt":
                self.die("--token-handle is only for an inherited Windows pipe handle", 2)
            from ctypes import wintypes
            kernel = ctypes.WinDLL("kernel32", use_last_error=True)
            kernel.GetFileType.argtypes = [wintypes.HANDLE]
            kernel.GetFileType.restype = wintypes.DWORD
            kernel.GetStdHandle.argtypes = [wintypes.DWORD]
            kernel.GetStdHandle.restype = wintypes.HANDLE
            handle = args.token_handle
            standard = {kernel.GetStdHandle(n & 0xffffffff) for n in (-10, -11, -12)}
            if handle in standard or kernel.GetFileType(handle) != 3:  # FILE_TYPE_PIPE
                self.die("--token-handle must be an inherited non-standard Windows pipe handle", 2)
            kernel.WriteFile.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD), ctypes.c_void_p]
            kernel.WriteFile.restype = wintypes.BOOL
            def send(data):
                while data:
                    count = wintypes.DWORD()
                    buffer = ctypes.create_string_buffer(data)
                    if not kernel.WriteFile(handle, buffer, len(data), ctypes.byref(count), None) or not count.value:
                        raise OSError()
                    data = data[count.value:]
        session = self.load_session(prompt=True, quiet=True)
        token = self.issue(session, agent=True)
        try:
            send(token.encode("ascii") + b"\n")
        except BaseException:
            self.revoke(token, "agent token after failed handoff")
            self.die("agent token handoff failed; token revoked")
        # Successful handoff transfers revocation responsibility to T005's
        # launcher. Closing the daily session still revokes this descendant.
