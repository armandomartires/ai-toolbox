"""gates over Streamable HTTP, behind OAuth 2.1 (TASK-0285; ADR-0063, proposed).

OFF BY DEFAULT. server.main() imports this module only when the operator sets
GATES_TRANSPORT=streamable-http; stdio is unchanged and never imports it.

When on:
- authentication is mandatory, there is no anonymous mode: every request to the
  MCP endpoint needs a bearer access token (RFC 9068, `typ: at+jwt`) that this
  resource server validates itself: signature against the issuer's JWKS (by
  `kid`; the key set is re-read when its cache expires, so a removed key stops
  validating), `iss`, a single `aud` equal to GATES_HTTP_RESOURCE_URL,
  `exp`/`iat`/`sub` with a lifetime cap and no future `iat`, an allowlisted
  client id and the read scope. Failure is 401 (403 for a missing scope)
  before the MCP layer sees the request;
- start_gate and kill_gate also need the run scope, checked per call;
- a gate belongs to the client that started it: wait_gate, gate_status and
  kill_gate refuse another client's handle;
- at most GATES_HTTP_MAX_RUNNING gates run at once from this process, and
  uvicorn caps concurrent connections;
- tool error messages lose absolute paths and SHA-256 values;
- the listener is loopback only, checked at config time and again just before
  binding; gates run under bwrap (server.main() refuses GATES_SANDBOX=none);
  sessions are stateless; Host must be the bind address and no browser Origin
  is allowed.
"""
from __future__ import annotations

import functools
import inspect
import ipaddress
import os
import re
import time
import typing
from dataclasses import dataclass
from typing import Any, Callable
from urllib.parse import urlsplit

import anyio
import jwt
from mcp.server.auth.middleware.bearer_auth import AuthenticatedUser
from mcp.server.auth.provider import AccessToken
from mcp.server.auth.settings import AuthSettings
from mcp.server.fastmcp import Context, FastMCP
from mcp.server.fastmcp.exceptions import ToolError
from mcp.server.transport_security import TransportSecuritySettings

from gates import server
from gates.server import ConfigError

DEFAULT_PORT = 8765
DEFAULT_READ_SCOPES = ("gates:read",)
DEFAULT_RUN_SCOPES = ("gates:run",)
DEFAULT_MAX_TOKEN_SECONDS = 900
DEFAULT_JWKS_CACHE_SECONDS = 300
DEFAULT_MAX_RUNNING = 2
DEFAULT_MAX_CONNECTIONS = 16
# Asymmetric only: a symmetric (HS*) key would be a shared secret in this
# process's environment, and `none` is no signature at all.
ALGORITHMS = {"RS256", "RS384", "RS512", "PS256", "PS384", "PS512",
              "ES256", "ES384", "ES512", "EdDSA"}
AT_JWT = {"at+jwt", "application/at+jwt"}
LEEWAY_SECONDS = 30
DESTRUCTIVE_TOOLS = {"start_gate", "kill_gate"}
OWNED_TOOLS = {"wait_gate", "gate_status", "kill_gate"}
CLIENT_FILE = "client"
_SHA = re.compile(r"\b[0-9a-fA-F]{64}\b")
_PATH = re.compile(r"(?<![\w.])(?:[A-Za-z]:[\\/]|\\\\|/)[^\s'\"]*")


@dataclass(frozen=True)
class HttpConfig:
    host: str
    port: int
    resource_url: str
    issuer: str
    jwks_url: str
    clients: frozenset[str]
    scopes: tuple[str, ...]
    run_scopes: tuple[str, ...]
    algorithms: tuple[str, ...]
    max_token_seconds: int
    jwks_cache_seconds: int = DEFAULT_JWKS_CACHE_SECONDS
    require_at_jwt: bool = True
    multi_audience: bool = False
    max_running: int = DEFAULT_MAX_RUNNING
    max_connections: int = DEFAULT_MAX_CONNECTIONS


def _required(var: str) -> str:
    value = os.environ.get(var, "").strip()
    if not value:
        raise ConfigError("%s is not set: GATES_TRANSPORT=streamable-http has no "
                          "anonymous mode (ADR-0063)" % var)
    return value


def _https(var: str) -> str:
    value = _required(var)
    parts = urlsplit(value)
    if parts.scheme != "https" or not parts.netloc:
        raise ConfigError("%s must be an https:// URL (OAuth 2.1), not %r" % (var, value))
    return value


def _list(var: str, default: tuple[str, ...] | None = None) -> tuple[str, ...]:
    raw = os.environ.get(var)
    if raw is None and default is not None:
        return default
    items = tuple(x.strip() for x in (raw or "").split(",") if x.strip())
    if not items:
        raise ConfigError("%s is empty" % var)
    return items


def _positive(var: str, default: int, top: int | None = None) -> int:
    raw = os.environ.get(var, "").strip() or str(default)
    if not raw.isdigit() or int(raw) < 1 or (top is not None and int(raw) > top):
        raise ConfigError("%s must be an integer from 1%s, not %r"
                          % (var, " to %d" % top if top else "", raw))
    return int(raw)


def _flag(var: str, default: bool) -> bool:
    raw = os.environ.get(var, "").strip().lower()
    if not raw:
        return default
    if raw not in ("true", "false"):
        raise ConfigError("%s must be true or false, not %r" % (var, raw))
    return raw == "true"


def require_loopback(host: str) -> str:
    """The bind address, refused unless it is a loopback IP literal.

    A name (even `localhost`) is refused: what it resolves to is not this
    process's to decide. Exposure beyond loopback is a deployment step that
    needs the human and an accepted ADR-0063, never a setting.
    """
    try:
        ok = ipaddress.ip_address(host).is_loopback
    except ValueError:
        ok = False
    if not ok:
        raise ConfigError("GATES_HTTP_HOST %r is not a loopback IP literal (127.0.0.1 or ::1); "
                          "the gates HTTP listener never binds a network address" % host)
    return host


def http_config() -> HttpConfig:
    """Read and validate the HTTP transport's settings; refuse anything weak."""
    host = require_loopback(os.environ.get("GATES_HTTP_HOST", "127.0.0.1").strip())
    algorithms = _list("GATES_OAUTH_ALGORITHMS", ("RS256",))
    weak = sorted(set(algorithms) - ALGORITHMS)
    if weak:
        raise ConfigError("GATES_OAUTH_ALGORITHMS names %s; only asymmetric signatures "
                          "are accepted (%s)" % (", ".join(weak), ", ".join(sorted(ALGORITHMS))))
    return HttpConfig(
        host=host,
        port=_positive("GATES_HTTP_PORT", DEFAULT_PORT, 65535),
        resource_url=_https("GATES_HTTP_RESOURCE_URL"),
        issuer=_https("GATES_OAUTH_ISSUER"),
        jwks_url=_https("GATES_OAUTH_JWKS_URL"),
        clients=frozenset(_list("GATES_OAUTH_CLIENTS")),
        scopes=_list("GATES_OAUTH_REQUIRED_SCOPES", DEFAULT_READ_SCOPES),
        run_scopes=_list("GATES_OAUTH_RUN_SCOPES", DEFAULT_RUN_SCOPES),
        algorithms=algorithms,
        max_token_seconds=_positive("GATES_OAUTH_MAX_TOKEN_SECONDS", DEFAULT_MAX_TOKEN_SECONDS),
        jwks_cache_seconds=_positive("GATES_OAUTH_JWKS_CACHE_SECONDS", DEFAULT_JWKS_CACHE_SECONDS),
        require_at_jwt=_flag("GATES_OAUTH_REQUIRE_AT_JWT", True),
        multi_audience=_flag("GATES_OAUTH_ALLOW_MULTI_AUDIENCE", False),
        max_running=_positive("GATES_HTTP_MAX_RUNNING", DEFAULT_MAX_RUNNING),
        max_connections=_positive("GATES_HTTP_MAX_CONNECTIONS", DEFAULT_MAX_CONNECTIONS),
    )


def jwks_resolver(url: str, lifespan: float, cooldown: float = 30.0) -> Callable[[str], Any]:
    """token -> verification key, looked up by `kid` in the issuer's JWKS.

    Only the key SET is cached, for `lifespan` seconds; there is no per-key
    cache, so a key the issuer removes stops validating once the set expires.
    An unknown `kid` forces one refetch (after PyJWT's cooldown), so a rotated-in
    key works at once. A token without a `kid` is refused.
    """
    client = jwt.PyJWKClient(url, cache_keys=False, cache_jwk_set=True, lifespan=lifespan,
                             cooldown_duration=cooldown)

    def key_for(token: str) -> Any:
        kid = jwt.get_unverified_header(token).get("kid")
        if not isinstance(kid, str) or not kid:
            raise jwt.InvalidTokenError("token has no kid")
        return client.get_signing_key(kid).key
    return key_for


class JwtVerifier:
    """An OAuth 2.1 resource server's access-token check (RFC 9068 JWTs).

    Any failure returns None, which the SDK's bearer middleware turns into 401.
    `key_for` maps a token to its verification key; by default jwks_resolver().
    """

    def __init__(self, cfg: HttpConfig, key_for: Callable[[str], Any] | None = None):
        self.cfg = cfg
        self.key_for = key_for or jwks_resolver(cfg.jwks_url, cfg.jwks_cache_seconds)

    def check(self, token: str) -> AccessToken | None:
        cfg = self.cfg
        try:
            header = jwt.get_unverified_header(token)
            if cfg.require_at_jwt and str(header.get("typ", "")).lower() not in AT_JWT:
                return None
            key = self.key_for(token)
            claims = jwt.decode(token, key, algorithms=list(cfg.algorithms),
                                audience=cfg.resource_url, issuer=cfg.issuer,
                                leeway=LEEWAY_SECONDS,
                                options={"require": ["exp", "iat", "iss", "aud", "sub"]})
        except (jwt.PyJWTError, ValueError, TypeError, KeyError):
            return None
        aud = claims["aud"]
        if isinstance(aud, list) and len(aud) != 1 and not cfg.multi_audience:
            return None
        client = claims.get("client_id") or claims.get("azp")
        if not isinstance(client, str) or client not in cfg.clients:
            return None
        exp, iat = claims["exp"], claims["iat"]
        if not (isinstance(exp, int) and isinstance(iat, int)):
            return None
        if iat > time.time() + LEEWAY_SECONDS or exp - iat > cfg.max_token_seconds:
            return None
        scope = claims.get("scope")
        scopes = scope.split() if isinstance(scope, str) else claims.get("scp") or []
        if not (isinstance(scopes, list) and all(isinstance(s, str) for s in scopes)):
            return None
        return AccessToken(token=token, client_id=client, scopes=scopes, expires_at=exp,
                           resource=cfg.resource_url, subject=str(claims["sub"]),
                           claims={"iss": claims["iss"]})

    async def verify_token(self, token: str) -> AccessToken | None:
        # The JWKS fetch is blocking I/O; keep it off the event loop.
        return await anyio.to_thread.run_sync(self.check, token)


def scrub(message: str) -> str:
    """A tool error without absolute paths or SHA-256 values (host details)."""
    return _PATH.sub("<path>", _SHA.sub("<sha256>", message))


def _caller(ctx: Context) -> AccessToken:
    request = ctx.request_context.request
    user = getattr(request, "user", None) if request is not None else None
    if not isinstance(user, AuthenticatedUser):
        raise ToolError("unauthenticated")  # the bearer middleware already refused this
    return user.access_token


def _guard(cfg: HttpConfig, fn: Callable[..., Any], running: set[str]) -> Callable[..., Any]:
    """Wrap one stdio tool for HTTP: same name, schema and annotations, plus the
    run scope, gate ownership, the running cap and scrubbed errors."""
    name = fn.__name__
    sig = inspect.signature(fn, eval_str=True)
    hints = typing.get_type_hints(fn, include_extras=True)

    async def guarded(**kwargs: Any) -> Any:
        token = _caller(kwargs.pop("ctx"))
        try:
            if name in DESTRUCTIVE_TOOLS:
                missing = [s for s in cfg.run_scopes if s not in token.scopes]
                if missing:
                    raise ToolError("%s needs scope %s" % (name, " ".join(missing)))
            if name in OWNED_TOOLS:
                d = server._dir(server.config(), kwargs["handle"])
                if d.is_dir() and server._read(d, CLIENT_FILE, "") != token.client_id:
                    raise ToolError("gate %s was not started by this client" % kwargs["handle"])
            if name == "start_gate":
                root = server.config()
                live = {h for h in running if not server._terminal(server._dir(root, h))}
                running.intersection_update(live)
                if len(live) >= cfg.max_running:
                    raise ToolError("%d gates are running; GATES_HTTP_MAX_RUNNING is %d"
                                    % (len(live), cfg.max_running))
            out = fn(**kwargs)
            if inspect.isawaitable(out):
                out = await out
            if name == "start_gate":
                d = server._dir(server.config(), out["handle"])
                (d / CLIENT_FILE).write_text(token.client_id, encoding="utf-8")
                running.add(out["handle"])
            return out
        except Exception as exc:
            raise ToolError(scrub(str(exc))) from None

    functools.update_wrapper(guarded, fn)
    ctx_param = inspect.Parameter("ctx", inspect.Parameter.KEYWORD_ONLY, annotation=Context)
    guarded.__signature__ = sig.replace(parameters=[*sig.parameters.values(), ctx_param])
    guarded.__annotations__ = {**hints, "ctx": Context}
    return guarded


def _hosts(host: str, port: int) -> list[str]:
    shown = "[%s]" % host if ":" in host else host
    return ["%s:%d" % (shown, port)]


def build_app(cfg: HttpConfig, key_for: Callable[[str], Any] | None = None):
    """The authenticated Streamable HTTP ASGI app, with exactly the stdio tools."""
    app = FastMCP(
        "gates",
        token_verifier=JwtVerifier(cfg, key_for),
        auth=AuthSettings(issuer_url=cfg.issuer, resource_server_url=cfg.resource_url,
                          required_scopes=list(cfg.scopes), validate_token_resource=True),
        host=cfg.host,
        port=cfg.port,
        stateless_http=True,
        json_response=True,
        transport_security=TransportSecuritySettings(
            enable_dns_rebinding_protection=True,
            allowed_hosts=_hosts(cfg.host, cfg.port), allowed_origins=[]),
    )
    running: set[str] = set()
    for fn, annotations in server.TOOLS:
        app.add_tool(_guard(cfg, fn, running), annotations=annotations)
    return app.streamable_http_app()


def serve(cfg: HttpConfig) -> None:
    """Listen on the loopback address only; checked again right before binding."""
    require_loopback(cfg.host)
    import uvicorn
    uvicorn.run(build_app(cfg), host=cfg.host, port=cfg.port, proxy_headers=False,
                server_header=False, log_level="info", limit_concurrency=cfg.max_connections)

