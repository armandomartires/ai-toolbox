"""The opt-in Streamable HTTP transport (TASK-0285, ADR-0063, proposed).

Hermetic: nothing listens on a socket. The app is driven in-process through
Starlette's TestClient, tokens are signed with keys generated per run, and the
JWKS is either replaced by a key or read from a local file:// JWKS fixture.
Run: cd mcp-servers/gates && uv run pytest tests/test_http.py
"""
import asyncio
import dataclasses
import importlib.util
import io
import itertools
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm
from starlette.testclient import TestClient

from gates import server

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
FIXTURE = HERE / "fixtures" / "gates.json"
ISSUER = "https://idp.invalid/realms/gates"
RESOURCE = "https://gates.invalid/mcp"
CLIENT = "remote-harness"
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
TOOLS = {"list_gates", "start_gate", "wait_gate", "gate_status", "kill_gate"}
HTTP_ENV = {
    "GATES_TRANSPORT": "streamable-http",
    "GATES_HTTP_RESOURCE_URL": RESOURCE,
    "GATES_OAUTH_ISSUER": ISSUER,
    "GATES_OAUTH_JWKS_URL": "https://idp.invalid/realms/gates/certs",
    "GATES_OAUTH_CLIENTS": CLIENT + ",other-harness",
}
OPTIONAL = ["GATES_HTTP_HOST", "GATES_HTTP_PORT", "GATES_OAUTH_REQUIRED_SCOPES", "GATES_OAUTH_RUN_SCOPES",
            "GATES_OAUTH_ALGORITHMS", "GATES_OAUTH_MAX_TOKEN_SECONDS", "GATES_OAUTH_JWKS_CACHE_SECONDS",
            "GATES_OAUTH_REQUIRE_AT_JWT", "GATES_OAUTH_ALLOW_MULTI_AUDIENCE", "GATES_HTTP_MAX_RUNNING",
            "GATES_HTTP_MAX_CONNECTIONS"]


@pytest.fixture
def http_env(monkeypatch, tmp_path):
    for k in list(HTTP_ENV) + OPTIONAL:
        monkeypatch.delenv(k, raising=False)
    for k, v in HTTP_ENV.items():
        monkeypatch.setenv(k, v)
    # A valid gate configuration, so tool calls reach the HTTP guards.
    monkeypatch.setenv("GATES_MAP", str(FIXTURE))
    monkeypatch.setenv("GATES_MAP_SHA256", server.sha256_file(str(FIXTURE)))
    monkeypatch.setenv("GATES_RUN_ROOT", str(tmp_path / "run"))
    monkeypatch.setenv("GATES_REPO_ROOT", str(tmp_path))
    monkeypatch.setenv("GATES_ALLOWED_EXECUTABLES", "sh,false,sleep,printf")
    monkeypatch.setenv("GATES_ALLOWED_LAUNCHERS", "sh")
    monkeypatch.setenv("GATES_SANDBOX", "none")
    return monkeypatch


def remote():
    from gates import remote as r
    return r


def token(key=KEY, alg="RS256", lifetime=300, kid="k1", typ="at+jwt", **over):
    now = int(time.time())
    claims = {"iss": ISSUER, "aud": RESOURCE, "sub": "harness", "client_id": CLIENT,
              "scope": "gates:read gates:run", "iat": now, "exp": now + lifetime}
    claims.update(over)
    claims = {k: v for k, v in claims.items() if v is not None}
    headers = {k: v for k, v in (("kid", kid), ("typ", typ)) if v is not None}
    return jwt.encode(claims, key, algorithm=alg, headers=headers)


def client(http_env):
    r = remote()
    app = r.build_app(r.http_config(), key_for=lambda _t: KEY.public_key())
    return TestClient(app, base_url="http://127.0.0.1:8765")


def rpc(c, method, tok=None, params=None, host=None):
    headers = {"Accept": "application/json, text/event-stream",
               "Content-Type": "application/json", "MCP-Protocol-Version": "2025-06-18"}
    if tok is not None:
        headers["Authorization"] = "Bearer " + tok
    if host:
        headers["Host"] = host
    return c.post("/mcp", headers=headers,
                  json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}})


def call(c, tok, tool, **arguments):
    resp = rpc(c, "tools/call", tok, {"name": tool, "arguments": arguments})
    assert resp.status_code == 200, resp.text
    result = resp.json()["result"]
    return result.get("isError", False), result["content"][0]["text"] if result["content"] else ""


INIT = {"protocolVersion": "2025-06-18", "capabilities": {},
        "clientInfo": {"name": "test", "version": "0"}}


# --- Off by default: stdio unchanged ---------------------------------------------

def test_default_transport_is_stdio_and_never_imports_http(tmp_path):
    # A fresh interpreter, so modules imported by other tests cannot hide an import.
    code = ("import sys\nfrom gates import server\n"
            "assert server.transport() == 'stdio'\n"
            "server.config = lambda: {'sandbox': 'none'}\nran = []\n"
            "server.mcp.run = lambda *a, **k: ran.append((a, k))\nserver.main()\n"
            "assert ran == [((), {})], ran\n"
            "assert 'gates.remote' not in sys.modules\nprint('stdio-ok')\n")
    env = {k: v for k, v in os.environ.items() if not k.startswith("GATES_")}
    out = subprocess.run([sys.executable, "-c", code], env=env, capture_output=True, text=True,
                         timeout=120)
    assert out.returncode == 0 and "stdio-ok" in out.stdout, out.stderr


def test_unknown_transport_is_refused(monkeypatch, capsys):
    monkeypatch.setenv("GATES_TRANSPORT", "sse")
    monkeypatch.setattr(server, "config", lambda: {"sandbox": "bwrap"})
    monkeypatch.setattr(server.mcp, "run", lambda *a, **k: pytest.fail("ran"))
    with pytest.raises(SystemExit) as exc:
        server.main()
    assert exc.value.code == 2 and "GATES_TRANSPORT" in capsys.readouterr().err


def test_http_without_the_gate_sandbox_is_refused(http_env, capsys):
    http_env.setattr(server, "config", lambda: {"sandbox": "none"})
    http_env.setattr(server.mcp, "run", lambda *a, **k: pytest.fail("ran"))
    with pytest.raises(SystemExit) as exc:
        server.main()
    assert exc.value.code == 2 and "GATES_SANDBOX" in capsys.readouterr().err


def test_plugin_wiring_pins_stdio():
    wiring = json.loads((REPO / "plugins/ai-toolbox-gates/.mcp.json").read_text())
    assert wiring["mcpServers"]["gates"]["env"]["GATES_TRANSPORT"] == "stdio"


# --- Authentication is mandatory: no anonymous mode -------------------------------

@pytest.mark.parametrize("var", list(HTTP_ENV)[1:])
def test_http_refuses_to_start_without_its_oauth_settings(http_env, var):
    http_env.delenv(var)
    with pytest.raises(server.ConfigError, match=var):
        remote().http_config()


@pytest.mark.parametrize("var,value", [
    ("GATES_HTTP_RESOURCE_URL", "http://gates.invalid/mcp"),
    ("GATES_OAUTH_ISSUER", "http://idp.invalid"),
    ("GATES_OAUTH_JWKS_URL", "http://idp.invalid/certs"),
    ("GATES_OAUTH_ALGORITHMS", "HS256"),
    ("GATES_OAUTH_ALGORITHMS", "none"),
    ("GATES_OAUTH_REQUIRED_SCOPES", " , "),
    ("GATES_OAUTH_RUN_SCOPES", ""),
    ("GATES_OAUTH_CLIENTS", " , "),
    ("GATES_OAUTH_MAX_TOKEN_SECONDS", "0"),
    ("GATES_OAUTH_JWKS_CACHE_SECONDS", "-1"),
    ("GATES_OAUTH_REQUIRE_AT_JWT", "maybe"),
    ("GATES_HTTP_MAX_RUNNING", "0"),
    ("GATES_HTTP_PORT", "70000"),
])
def test_weak_oauth_settings_are_refused(http_env, var, value):
    http_env.setenv(var, value)
    with pytest.raises(server.ConfigError, match=var):
        remote().http_config()


# --- Never a non-loopback listener ------------------------------------------------

@pytest.mark.parametrize("host", ["0.0.0.0", "::", "192.168.1.10", "10.0.0.1",
                                  "gates.example.com", "localhost", ""])
def test_non_loopback_host_is_refused(http_env, host):
    http_env.setenv("GATES_HTTP_HOST", host)
    with pytest.raises(server.ConfigError, match="GATES_HTTP_HOST"):
        remote().http_config()


def test_loopback_is_the_default_bind(http_env):
    cfg = remote().http_config()
    assert cfg.host == "127.0.0.1" and cfg.port == 8765


def test_serve_refuses_a_hand_built_non_loopback_config(http_env, monkeypatch):
    # serve() rechecks the host itself, so a config built without http_config()
    # still cannot bind a network address.
    r = remote()
    cfg = dataclasses.replace(r.http_config(), host="0.0.0.0")
    import uvicorn
    monkeypatch.setattr(uvicorn, "run", lambda *a, **k: pytest.fail("listened"))
    with pytest.raises(server.ConfigError, match="loopback"):
        r.serve(cfg)


def test_serve_caps_concurrent_connections(http_env, monkeypatch):
    http_env.setenv("GATES_HTTP_MAX_CONNECTIONS", "5")
    r = remote()
    seen = {}
    import uvicorn
    monkeypatch.setattr(uvicorn, "run", lambda app, **k: seen.update(k))
    r.serve(r.http_config())
    assert seen["limit_concurrency"] == 5 and seen["host"] == "127.0.0.1"


# --- The HTTP endpoint ------------------------------------------------------------

def test_unauthenticated_request_is_refused(http_env):
    with client(http_env) as c:
        for method, params in (("initialize", INIT), ("tools/list", {})):
            resp = rpc(c, method, params=params)
            assert resp.status_code == 401, resp.text
            www = resp.headers["www-authenticate"]
            assert www.startswith("Bearer") and "resource_metadata=" in www
            assert "tools" not in resp.text


def _hs256():
    now = int(time.time())
    return jwt.encode({"iss": ISSUER, "aud": RESOURCE, "sub": "x", "client_id": CLIENT,
                       "scope": "gates:read", "iat": now, "exp": now + 300},
                      b"a-shared-secret-the-server-never-accepts-0123456789", algorithm="HS256",
                      headers={"typ": "at+jwt"})


def _alg_none():
    now = int(time.time())
    return jwt.encode({"iss": ISSUER, "aud": RESOURCE, "sub": "x", "client_id": CLIENT,
                       "scope": "gates:read", "iat": now, "exp": now + 300},
                      None, algorithm="none", headers={"typ": "at+jwt"})


@pytest.mark.parametrize("why,tok", [
    ("garbage", "not-a-jwt"),
    ("wrong audience", lambda: token(aud="https://other.invalid/mcp")),
    ("two audiences", lambda: token(aud=[RESOURCE, "https://other.invalid/mcp"])),
    ("wrong issuer", lambda: token(iss="https://evil.invalid")),
    ("issuer with a trailing slash", lambda: token(iss=ISSUER + "/")),
    ("expired", lambda: token(iat=int(time.time()) - 600, exp=int(time.time()) - 60)),
    ("other key", lambda: token(key=OTHER_KEY)),
    ("client not allowed", lambda: token(client_id="someone-else")),
    ("no client id", lambda: token(client_id=None)),
    ("no exp", lambda: token(exp=None)),
    ("no iat", lambda: token(iat=None)),
    ("no sub", lambda: token(sub=None)),
    ("iat in the future", lambda: token(iat=int(time.time()) + 600, exp=int(time.time()) + 800)),
    ("lifetime above the cap", lambda: token(lifetime=7200)),
    ("no typ", lambda: token(typ=None)),
    ("typ JWT, not at+jwt", lambda: token(typ="JWT")),
    ("symmetric HS256", _hs256),
    ("alg none", _alg_none),
])
def test_invalid_tokens_are_refused(http_env, why, tok):
    tok = tok() if callable(tok) else tok
    with client(http_env) as c:
        resp = rpc(c, "tools/list", tok)
        assert resp.status_code == 401, (why, resp.status_code, resp.text)


def test_a_single_audience_list_is_accepted(http_env):
    with client(http_env) as c:
        assert rpc(c, "tools/list", token(aud=[RESOURCE])).status_code == 200


def test_audience_lists_and_plain_jwt_only_when_configured(http_env):
    http_env.setenv("GATES_OAUTH_ALLOW_MULTI_AUDIENCE", "true")
    http_env.setenv("GATES_OAUTH_REQUIRE_AT_JWT", "false")
    with client(http_env) as c:
        assert rpc(c, "tools/list", token(aud=[RESOURCE, "https://other.invalid"])).status_code == 200
        assert rpc(c, "tools/list", token(typ="JWT")).status_code == 200


def test_token_without_the_read_scope_is_forbidden(http_env):
    with client(http_env) as c:
        resp = rpc(c, "tools/list", token(scope="openid profile"))
        assert resp.status_code == 403 and "insufficient_scope" in resp.text


def test_authenticated_request_lists_the_tools(http_env):
    with client(http_env) as c:
        assert rpc(c, "initialize", token(), INIT).status_code == 200
        resp = rpc(c, "tools/list", token(scp=["gates:read"], scope=None, client_id=None, azp=CLIENT))
        assert resp.status_code == 200, resp.text
        assert {t["name"] for t in resp.json()["result"]["tools"]} == TOOLS


def test_dns_rebinding_host_is_refused(http_env):
    with client(http_env) as c:
        resp = rpc(c, "tools/list", token(), host="evil.example:8765")
        assert resp.status_code in (400, 421), resp.status_code


def test_protected_resource_metadata_names_the_issuer(http_env):
    with client(http_env) as c:
        resp = c.get("/.well-known/oauth-protected-resource/mcp")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["resource"].rstrip("/") == RESOURCE
        assert [s.rstrip("/") for s in body["authorization_servers"]] == [ISSUER]


# --- Per-tool authorization: run scope, ownership, running cap, scrubbed errors ---

_fake = itertools.count(1)


@pytest.fixture
def fake_start(http_env):
    """start_gate leaves a RUNNING gate without launching anything."""
    def start(name):
        d = server._dir(server.config(), "%s.fake-%d" % (name, next(_fake)))
        d.mkdir(parents=True)
        for f, v in (("name", name), ("owner", server.OWNER), ("state", "RUNNING"),
                     ("started", str(int(time.time())))):
            (d / f).write_text(v, encoding="utf-8")
        return server.summary(d)
    http_env.setattr(server, "_start_gate", start)


def test_destructive_tools_need_the_run_scope(http_env, fake_start):
    read_only = token(scope="gates:read")
    with client(http_env) as c:
        err, text = call(c, read_only, "list_gates")
        assert not err, text
        for name, args in (("start_gate", {"name": "ok"}), ("kill_gate", {"handle": "ok.x"})):
            err, text = call(c, read_only, name, **args)
            assert err and "gates:run" in text, (name, text)
        err, text = call(c, token(), "start_gate", name="ok")
        assert not err and json.loads(text)["state"] == "RUNNING", text


def test_a_gate_belongs_to_the_client_that_started_it(http_env, fake_start):
    with client(http_env) as c:
        err, text = call(c, token(), "start_gate", name="ok")
        handle = json.loads(text)["handle"]
        other = token(client_id="other-harness")
        for name, args in (("gate_status", {}), ("wait_gate", {"max_wait_seconds": 0}),
                           ("kill_gate", {})):
            err, text = call(c, other, name, handle=handle, **args)
            assert err and "not started by this client" in text, (name, text)
        err, text = call(c, token(), "gate_status", handle=handle)
        assert not err and json.loads(text)["state"] == "RUNNING", text


def test_running_gates_are_capped(http_env, fake_start):
    http_env.setenv("GATES_HTTP_MAX_RUNNING", "1")
    with client(http_env) as c:
        err, text = call(c, token(), "start_gate", name="ok")
        assert not err, text
        err, text = call(c, token(), "start_gate", name="ok")
        assert err and "GATES_HTTP_MAX_RUNNING" in text, text
        # Once the first gate finishes, a new one may start.
        run = Path(os.environ["GATES_RUN_ROOT"]) / "gates"
        for g in run.iterdir():
            (g / "state").write_text("PASSED", encoding="utf-8")
        err, text = call(c, token(), "start_gate", name="ok")
        assert not err, text


def test_tool_errors_carry_no_paths_or_hashes(http_env, tmp_path):
    with client(http_env) as c:
        http_env.setenv("GATES_MAP_SHA256", "0" * 64)
        err, text = call(c, token(), "list_gates")
        assert err and "GATES_MAP" in text, text
        assert server.sha256_file(str(FIXTURE)) not in text and "0" * 64 not in text, text
        missing = tmp_path / "nowhere" / "map.json"
        http_env.setenv("GATES_MAP", str(missing))
        err, text = call(c, token(), "list_gates")
        assert err and "<path>" in text and str(tmp_path) not in text and "nowhere" not in text, text


# --- The issuer's JWKS: kid lookup and rotation (a local file:// fixture) ---------

def _jwks(path, keys):
    body = {"keys": []}
    for kid, k in keys.items():
        jwk = RSAAlgorithm.to_jwk(k.public_key(), as_dict=True)
        jwk.update(kid=kid, use="sig", alg="RS256")
        body["keys"].append(jwk)
    path.write_text(json.dumps(body), encoding="utf-8")


class _LocalJwks:
    """Stands in for urllib's opener inside PyJWKClient, so its real caching and
    refetch logic runs against a local file and nothing goes on the network."""

    def __init__(self, path):
        self.path, self.fetches = path, 0

    def open(self, request, timeout=None):
        assert request.full_url == HTTP_ENV["GATES_OAUTH_JWKS_URL"]
        self.fetches += 1
        return io.BytesIO(self.path.read_bytes())


def _verifier(http_env, path, lifespan, cooldown=30.0):
    import jwt.jwks_client
    opener = _LocalJwks(path)
    http_env.setattr(jwt.jwks_client.urllib.request, "build_opener", lambda *h: opener)
    r = remote()
    cfg = r.http_config()
    return r.JwtVerifier(cfg, r.jwks_resolver(cfg.jwks_url, lifespan, cooldown))


def test_the_key_is_chosen_by_kid(http_env, tmp_path):
    path = tmp_path / "jwks.json"
    _jwks(path, {"k1": KEY, "k2": OTHER_KEY})
    v = _verifier(http_env, path, 300)
    assert v.check(token(key=OTHER_KEY, kid="k2")) is not None
    assert v.check(token(key=KEY, kid="k1")) is not None
    assert v.check(token(key=KEY, kid="k2")) is None, "k2's key must not verify k1's signature"
    assert v.check(token(kid=None)) is None, "a token without a kid is refused"


def test_an_unknown_kid_refetches_the_set(http_env, tmp_path):
    path = tmp_path / "jwks.json"
    _jwks(path, {"k1": KEY})
    v = _verifier(http_env, path, 300, cooldown=0)
    assert v.check(token()) is not None
    assert v.check(token(key=OTHER_KEY, kid="k2")) is None
    _jwks(path, {"k1": KEY, "k2": OTHER_KEY})
    assert v.check(token(key=OTHER_KEY, kid="k2")) is not None, "a rotated-in key works at once"


def test_a_removed_kid_stops_validating_when_the_set_expires(http_env, tmp_path):
    path = tmp_path / "jwks.json"
    _jwks(path, {"k1": KEY})
    v = _verifier(http_env, path, lifespan=0.5)
    assert v.check(token()) is not None
    _jwks(path, {"k2": OTHER_KEY})
    time.sleep(0.8)
    assert v.check(token()) is None, "k1 left the JWKS; no per-key cache may keep it alive"
    assert v.check(token(key=OTHER_KEY, kid="k2")) is not None


# --- The tool lock still matches, over either transport ---------------------------

def _lock_hashes(tools):
    spec = importlib.util.spec_from_file_location("mcp_tool_lock", REPO / "scripts" / "mcp-tool-lock.py")
    lock = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(lock)
    return {t["name"]: lock.tool_hash(t) for t in tools}


def test_stdio_tools_still_match_the_lock():
    locked = json.loads((HERE.parent / "tools.lock.json").read_text())["tools"]
    tools = [t.model_dump(by_alias=True, exclude_none=True, mode="json")
             for t in asyncio.run(server.mcp.list_tools())]
    assert _lock_hashes(tools) == locked


def test_http_tools_match_the_lock(http_env):
    locked = json.loads((HERE.parent / "tools.lock.json").read_text())["tools"]
    with client(http_env) as c:
        resp = rpc(c, "tools/list", token())
        assert resp.status_code == 200, resp.text
        assert _lock_hashes(resp.json()["result"]["tools"]) == locked
