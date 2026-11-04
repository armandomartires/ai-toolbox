#!/usr/bin/env python3
"""vault-fetch.py - exchange the job's GitLab ID token for a short-lived Vault
token, read the KV v2 secrets listed in UNATTENDED_SECRETS, export them as
shell assignments on stdout, and revoke the token. Issue #11, Level 1.

UNATTENDED_SECRETS format, space separated:  VAR=<path-under-ai-toolbox>#<field>
Only paths under sigmarecon-projects/ai-toolbox/ are accepted; the Vault
policy enforces the same, this is a second, local refusal.

Standard library only. Never prints a value to stderr or logs.
"""
import json, os, re, shlex, sys, urllib.request

MOUNT = "sigmarecon-projects"
PREFIX = "ai-toolbox/"
ENTRY = re.compile(r"^([A-Z_][A-Z0-9_]*)=([A-Za-z0-9_./-]+)#([A-Za-z0-9_-]+)$")


def parse(spec):
    out = []
    for item in spec.split():
        m = ENTRY.match(item)
        if not m:
            raise ValueError(f"bad UNATTENDED_SECRETS entry: {item.split('=')[0]}")
        var, path, field = m.groups()
        path = path.lstrip("/")
        if not path.startswith(PREFIX) or ".." in path.split("/") or "/operator/" in "/" + path:
            raise ValueError(f"{var}: path outside {MOUNT}/{PREFIX} refused")
        out.append((var, path, field))
    return out


def call(addr, method, path, token=None, body=None):
    req = urllib.request.Request(addr.rstrip("/") + "/v1/" + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("X-Vault-Token", token)
    with urllib.request.urlopen(req, timeout=20) as r:
        raw = r.read()
        return json.loads(raw) if raw else {}


def self_test():
    ok = [("A", "ai-toolbox/x", "f")]
    assert parse("A=ai-toolbox/x#f") == ok
    for bad in ["A=operator/x#f", "A=ai-toolbox/../operator/x#f", "A=ai-toolbox/operator/k#f",
                "a=ai-toolbox/x#f", "A=other/x#f", "A=ai-toolbox/x"]:
        try:
            parse(bad)
        except ValueError:
            continue
        raise AssertionError(f"accepted {bad}")
    print("vault-fetch self-test: OK")


def main():
    if sys.argv[1:] == ["--self-test"]:
        return self_test()
    addr = os.environ["VAULT_ADDR"]
    jwt = os.environ["VAULT_ID_TOKEN"]
    role = os.environ.get("VAULT_ROLE", "ai-toolbox-unattended")
    auth = os.environ.get("VAULT_AUTH_PATH", "jwt-gitlab")
    entries = parse(os.environ.get("UNATTENDED_SECRETS", ""))
    tok = call(addr, "POST", f"auth/{auth}/login", body={"role": role, "jwt": jwt})["auth"]["client_token"]
    try:
        for var, path, field in entries:
            data = call(addr, "GET", f"{MOUNT}/data/{path}", token=tok)["data"]["data"]
            print(f"export {var}={shlex.quote(str(data[field]))}")
    finally:
        try:
            call(addr, "POST", "auth/token/revoke-self", token=tok)
        except Exception:
            print("vault-fetch: token revoke failed (it expires within its TTL)", file=sys.stderr)


if __name__ == "__main__":
    main()
