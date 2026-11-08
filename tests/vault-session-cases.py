# Executed by test-vault-secrets.sh inside its fake Vault / temporary HOME.
# This file is not a production backend selector and never opens a real keychain.
import base64
import hashlib
from unittest import mock

session_dir = os.path.join(WORK, "session-project")
os.mkdir(session_dir)
with open(os.path.join(session_dir, "secrets.conf"), "w", encoding="utf-8") as fh:
    fh.write("backend = vault\nproject = display-project\nvault_role = demo-session\n")
with open(os.path.join(session_dir, "secrets.map"), "w", encoding="utf-8") as fh:
    fh.write("SESSION_TOKEN=${VAULT_PROJECTS_MOUNT}/demo-session/one#token\n"
             "OTHER_TOKEN=${VAULT_PROJECTS_MOUNT}/demo-session/two#token\n")
state["store"]["projects-test:demo-session/one"] = ({"token": SESSION_VALUE}, 1)
state["store"]["projects-test:demo-session/two"] = ({"token": PRIVATE_VALUE}, 1)
session_key = "vault-secrets-session-" + hashlib.sha256((BASE_ENV["VAULT_ADDR"] + "\nldap").encode()).hexdigest()

class FakeKeychain:
    def __init__(self): self.items, self.writes = {}, 0
    def get(self, key): return self.items.get(key)
    def set(self, key, payload):
        self.items[key] = payload
        self.writes += 1
    def delete(self, key): self.items.pop(key, None)

fake_keychain = FakeKeychain()
def seed_session():
    fake_keychain.items[session_key] = base64.b64encode(json.dumps({"token": DAILY,
        "policies": ["default", "developer"], "expires_at": time.time() + 1000}).encode()).decode()

command_calls = []
def aligned(args, stdin="", env=None, command_status=0):
    m = script_mod()
    e = dict(BASE_ENV, VAULT_PROJECTS_MOUNT="projects-test", VAULT_AUTH_METHOD="not-a-method",
             VAULT_APPROLE_FILE="must-not-be-read.approle", VAULT_SECRETS_MAPS="must-not-be-read.map",
             VAULT_TOKEN=PARENT, VAULT_ROLE="wrong-project")
    e.update(env or {})
    out, err, stream = io.StringIO(), io.StringIO(), io.StringIO(stdin)
    code, previous_cwd = 0, os.getcwd()
    def command(argv, child_env):
        command_calls.append((argv, child_env, time.time(), PROJECT_TOKEN in state.get("session_revoked", set())))
        raise SystemExit(command_status)
    os.chdir(session_dir)
    try:
        with mock.patch.dict(os.environ, e, clear=True), mock.patch.object(m, "keychain_backend", return_value=fake_keychain), \
                mock.patch.object(sys, "stdin", stream), \
                mock.patch.object(m, "prompt_secret", side_effect=lambda prompt: stream.readline().rstrip("\r\n")), \
                mock.patch.object(m, "run_command", side_effect=command), \
                contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            try: m.main(args)
            except SystemExit as exc: code = exc.code
    finally:
        os.chdir(previous_cwd)
    p = subprocess.CompletedProcess(args, code, out.getvalue(), err.getvalue())
    outputs.append(p.stdout + p.stderr)
    return p

seed_session(); set_tok(CHILD)
original_file = tok()
before_files = sorted(os.listdir(session_dir)), sorted(os.listdir(HOME))
taken(); command_calls.clear()
p = aligned(["exec", "SESSION_TOKEN", "--", "probe"])
calls = taken()
reads = [x for x in calls if "/data/" in x[1]]
revocations = [x for x in calls if x[1] == "auth/token/revoke-self" and x[2] == PROJECT_TOKEN]
check("T62 vault_role overrides shell identity/maps and only the requested mapping is fetched",
      p.returncode == 0 and len(command_calls) == 1 and len(reads) == 1
      and reads[0][1] == "projects-test/data/demo-session/one"
      and command_calls[0][1].get("SESSION_TOKEN") == SESSION_VALUE
      and "OTHER_TOKEN" not in command_calls[0][1]
      and not any(x[1] == "auth/approle/login" for x in calls))
check("T62 project token is revoked before the child and no shell Vault token is inherited",
      len(revocations) == 1 and revocations[0][4] <= command_calls[0][2] and command_calls[0][3] and "VAULT_TOKEN" not in command_calls[0][1])
check("T62 exec writes no file and leaves .vault-token untouched",
      tok() == original_file and before_files == (sorted(os.listdir(session_dir)), sorted(os.listdir(HOME))))
p = aligned(["exec", "SESSION_TOKEN", "--", "failing-command"], command_status=17)
calls = taken()
check("T63 failing command preserves its status after token revocation",
      p.returncode == 17 and any(x[1] == "auth/token/revoke-self" and x[2] == PROJECT_TOKEN for x in calls))
command_calls.clear(); state["session_read_error"] = True
p = aligned(["exec", "SESSION_TOKEN", "--", "probe"])
check("T64 failed fetch still revokes and starts no command", p.returncode == 1 and not command_calls
      and any(x[1] == "auth/token/revoke-self" and x[2] == PROJECT_TOKEN for x in taken()))
state["session_read_error"] = False; state["session_revoke_allowed"] = False
p = aligned(["exec", "SESSION_TOKEN", "--", "probe"])
check("T64 denied self-revocation stops exec", p.returncode == 3 and not command_calls and "cannot confirm revocation" in p.stderr)
state["session_revoke_allowed"] = True
p = aligned(["check"]); calls = taken()
check("T65 check reports readability and session time without issued-token lookup-self",
      p.returncode == 0 and "SESSION_TOKEN: readable" in p.stdout and "left" in p.stdout
      and not any(x[1] == "auth/token/lookup-self" and x[2] in (PROJECT_TOKEN, AGENT_TOKEN) for x in calls))

for forbidden in (PARENT, ROOT):
    fake_keychain.items.clear(); previous_writes = fake_keychain.writes
    state["session_login_token"] = forbidden
    p = aligned(["login"], stdin=PASSWORD + "\n")
    check("T66 aligned login refuses %s storage" % ("admin" if forbidden == PARENT else "root"),
          p.returncode == 3 and fake_keychain.writes == previous_writes and not fake_keychain.items and tok() == original_file)
p = run(["login"], stdin=PARENT + "\n", env={"VAULT_AUTH_METHOD": "token"})
check("T66 legacy pasted admin token cannot overwrite token file", p.returncode != 0 and tok() == original_file and "admin token" in p.stderr)
state["session_login_token"] = DAILY; state["mfa"] = "totp"; fake_keychain.items.clear(); taken()
p = aligned(["exec", "SESSION_TOKEN", "--", "probe"], stdin=PASSWORD + "\n" + MFA_CODE + "\n")
check("T67 missing session prompts LDAP/TOTP, stores in fake keychain and never touches .vault-token",
      p.returncode == 0 and session_key in fake_keychain.items and tok() == original_file
      and any(x[1] == "sys/mfa/validate" for x in taken()))
state["mfa"] = None

seed_session(); taken()
rfd, wfd = os.pipe()
try:
    p = aligned(["issue", "--agent", "demo-session", "--token-fd", str(wfd)])
    os.close(wfd); wfd = None
    received = os.read(rfd, 8192); calls = taken()
    check("T68 issue writes only a framed agent token to its pipe, transferring lifecycle ownership",
          p.returncode == 0 and received == (AGENT_TOKEN + "\n").encode() and not p.stdout and not p.stderr
          and any(x[1] == "auth/token/create/demo-session-agent" for x in calls)
          and not any(x[1] == "auth/token/revoke-self" and x[2] == AGENT_TOKEN for x in calls))
finally:
    os.close(rfd)
    if wfd is not None: os.close(wfd)
taken()
p = aligned(["issue", "--agent", "another-project", "--token-fd", "1"])
check("T68 issue cannot select another project", p.returncode == 2 and not taken())
regular = os.open(os.path.join(session_dir, "not-a-token-file"), os.O_CREAT | os.O_WRONLY, 0o600)
try:
    p = aligned(["issue", "--agent", "demo-session", "--token-fd", str(regular)])
    check("T68 issue refuses regular files before minting", p.returncode == 2 and not taken())
finally: os.close(regular)
rfd, wfd = os.pipe(); os.close(rfd)
try:
    p = aligned(["issue", "--agent", "demo-session", "--token-fd", str(wfd)])
    check("T68 failed pipe handoff revokes the token without output", p.returncode == 1
          and any(x[1] == "auth/token/revoke-self" and x[2] == AGENT_TOKEN for x in taken()))
finally: os.close(wfd)

keymod = sys.modules["vault_keychain"]
payload = fake_keychain.items[session_key]
for backend in (keymod.MacOSKeychain(), keymod.SecretServiceKeychain()):
    seen = []
    def transport(argv, **kwargs):
        seen.append((argv, kwargs.get("input")))
        return subprocess.CompletedProcess(argv, 0, b"", b"")
    with mock.patch.object(keymod.subprocess, "run", side_effect=transport), mock.patch.object(keymod.shutil, "which", return_value="secret-tool"):
        backend.set(session_key, payload)
    check("T69 %s uses stdin, never argv" % type(backend).__name__, len(seen) == 1 and payload.encode() in seen[0][1]
          and all(payload not in arg and DAILY not in arg for arg in seen[0][0]))
    def failed(argv, **kwargs): return subprocess.CompletedProcess(argv, 1, b"", payload.encode())
    with mock.patch.object(keymod.subprocess, "run", side_effect=failed), mock.patch.object(keymod.shutil, "which", return_value="secret-tool"):
        try:
            backend.set(session_key, payload)
            safe_error = False
        except keymod.KeychainError as exc: safe_error = payload not in str(exc) and DAILY not in str(exc)
    check("T69 %s error excludes stderr and payload" % type(backend).__name__, safe_error)
with mock.patch.object(keymod.shutil, "which", return_value=None):
    try:
        keymod.SecretServiceKeychain().set(session_key, payload)
        no_fallback = False
    except keymod.KeychainError as exc: no_fallback = "no file fallback" in str(exc)
check("T69 missing Secret Service has no file fallback", no_fallback)

init_session = os.path.join(WORK, "init-session"); os.mkdir(init_session)
p = run(["init", "--backend", "vault", "--role", "demo-session"], cwd=init_session, env={"VAULT_PROJECTS_MOUNT": "must-never-be-written"})
with open(os.path.join(init_session, "secrets.map"), encoding="utf-8") as fh: rendered = fh.read()
with open(os.path.join(init_session, "secrets.conf"), encoding="utf-8") as fh: declared = fh.read()
check("T70 init --role keeps the mount symbolic", p.returncode == 0 and "vault_role = demo-session" in declared
      and "project = demo-session" in declared and "${VAULT_PROJECTS_MOUNT}/demo-session/" in rendered
      and "must-never-be-written" not in rendered + declared)
p = run(["init", "--backend", "vault", "--role", "demo-session"], cwd=init_session)
check("T70 session init is idempotent", p.returncode == 0 and "nothing to change" in p.stdout)
p = aligned(["logout"])
check("T71 logout revokes daily session and clears keychain only", p.returncode == 0 and not fake_keychain.items and tok() == original_file
      and any(x[1] == "auth/token/revoke-self" and x[2] == DAILY for x in taken()))

# Security boundary cases: transition narrowing, keychain failure and unsafe
# role responses must not become broad stored tokens or launched commands.
fake_keychain.items.clear(); state["session_login_token"] = TRANSITION; taken()
p = aligned(["login"], stdin=PASSWORD + "\n")
record = json.loads(base64.b64decode(fake_keychain.items.get(session_key, "e30=")))
calls = taken()
check("T72 transitional workstation-read is removed from the stored session",
      p.returncode == 0 and record.get("token") == DAILY and set(record.get("policies", [])) == {"default", "developer"}
      and any(x[1] == "auth/token/create" and x[3].get("policies") == ["developer"] and x[3].get("no_parent") is False for x in calls)
      and not any(x[1] == "auth/token/revoke-self" and x[2] == TRANSITION for x in calls))
state["session_login_token"] = DAILY; fake_keychain.items.clear(); taken()
with mock.patch.object(fake_keychain, "set", side_effect=keymod.KeychainError("fake keychain unavailable; no file fallback")):
    p = aligned(["login"], stdin=PASSWORD + "\n")
check("T72 keychain storage failure revokes the fresh login and writes no token file",
      p.returncode == 3 and not fake_keychain.items and tok() == original_file
      and any(x[1] == "auth/token/revoke-self" and x[2] == DAILY for x in taken()))
seed_session(); command_calls.clear(); taken()
p = aligned(["exec", "SESSION_TOKEN", "--", "probe"], env={"SESSION_TOKEN": PRIVATE_VALUE, "OTHER_TOKEN": APP_VALUE})
check("T73 aligned mode fetches named values afresh and removes unnamed mapped exports",
      p.returncode == 0 and command_calls[-1][1].get("SESSION_TOKEN") == SESSION_VALUE and "OTHER_TOKEN" not in command_calls[-1][1])
for key, value in (("session_issued_policies", ["admin"]), ("session_issued_orphan", True), ("session_issued_ttl", 28801)):
    state[key] = value; command_calls.clear(); taken()
    p = aligned(["exec", "SESSION_TOKEN", "--", "probe"])
    check("T73 unsafe role response %s is revoked and never launched" % key,
          p.returncode == 3 and not command_calls
          and any(x[1] == "auth/token/revoke-self" and x[2] == PROJECT_TOKEN for x in taken()))
    state.pop(key)
fake_keychain.items[session_key] = "not-a-session-record"; taken()
p = aligned(["check"])
check("T73 invalid keychain record fails without contacting Vault", p.returncode == 3 and not taken())
seed_session()

# Mock the entire WinCred boundary: ctypes carries the bytes in memory and
# never invokes a command, writes a file, or touches the real credential store.
class WinFunction:
    def __init__(self, callback): self.callback = callback
    def __call__(self, *args): return self.callback(*args)
class FakeWinCred:
    def __init__(self):
        self.saved, self.references = None, []
        self.CredWriteW = WinFunction(self.write)
        self.CredReadW = WinFunction(self.read)
        self.CredDeleteW = WinFunction(lambda *a: 1)
        self.CredFree = WinFunction(lambda *a: None)
    def write(self, pointer, flags):
        credential = keymod.ctypes.cast(pointer, keymod.ctypes.POINTER(native.Credential)).contents
        self.saved = keymod.ctypes.string_at(credential.CredentialBlob, credential.CredentialBlobSize)
        self.persist = credential.Persist
        return 1
    def read(self, key, kind, flags, pointer):
        blob = (keymod.ctypes.c_ubyte * len(self.saved)).from_buffer_copy(self.saved)
        credential = native.Credential(CredentialBlobSize=len(self.saved), CredentialBlob=blob)
        self.references.extend([credential, blob])
        keymod.ctypes.cast(pointer, keymod.ctypes.POINTER(keymod.ctypes.POINTER(native.Credential)))[0] = keymod.ctypes.pointer(credential)
        return 1
fake_win = FakeWinCred()
with mock.patch.object(keymod.os, "name", "nt"), mock.patch.object(keymod.ctypes, "WinDLL", return_value=fake_win, create=True), \
        mock.patch.object(keymod.subprocess, "run", side_effect=AssertionError("WinCred must not spawn a process")):
    native = keymod.WindowsKeychain()
    native.set(session_key, payload)
    fetched = native.get(session_key)
    native.delete(session_key)
check("T74 WinCred round-trip stays in memory and uses logon-session persistence",
      fake_win.saved == payload.encode() and fetched == payload and fake_win.persist == 1)
if os.name == "nt":
    import msvcrt
    rfd, wfd = os.pipe(); taken()
    try:
        p = aligned(["issue", "--agent", "demo-session", "--token-handle", str(msvcrt.get_osfhandle(wfd))])
        os.close(wfd); wfd = None
        check("T74 Windows inherited pipe HANDLE receives only the framed agent token",
              p.returncode == 0 and os.read(rfd, 8192) == (AGENT_TOKEN + "\n").encode() and not p.stdout and not p.stderr)
    finally:
        os.close(rfd)
        if wfd is not None: os.close(wfd)


# The issue interface stays silent even if the host needs a new daily login.
fake_keychain.items.clear(); state["session_login_token"] = DAILY; taken()
rfd, wfd = os.pipe()
try:
    p = aligned(["issue", "--agent", "demo-session", "--token-fd", str(wfd)], stdin=PASSWORD + "\n")
    os.close(wfd); wfd = None
    check("T75 issue with a fresh login keeps stdout empty and emits only its pipe frame",
          p.returncode == 0 and not p.stdout and os.read(rfd, 8192) == (AGENT_TOKEN + "\n").encode())
finally:
    os.close(rfd)
    if wfd is not None: os.close(wfd)
p = aligned(["put", "SESSION_TOKEN"], stdin=APP_VALUE + "\n")
calls = taken()
check("T75 aligned put uses only the scoped child, CAS, and revokes it",
      p.returncode == 0 and any(x[0] == "POST" and x[1] == "projects-test/data/demo-session/one"
      and x[2] == PROJECT_TOKEN and "cas" in x[3].get("options", {}) for x in calls)
      and any(x[1] == "auth/token/revoke-self" and x[2] == PROJECT_TOKEN for x in calls) and tok() == original_file)
with open(os.path.join(session_dir, ".env.example"), "w", encoding="utf-8") as fh: fh.write("SESSION_TOKEN=\n")
source_name = os.path.join(session_dir, "migrate.env")
with open(source_name, "w", encoding="utf-8") as fh: fh.write("SESSION_TOKEN=" + SESSION_VALUE + "\n")
p = aligned(["import", "--from", source_name, "--dry-run"])
check("T75 aligned import dry-run contacts nothing", p.returncode == 0 and not taken())
p = aligned(["import", "--from", source_name])
calls = taken()
check("T75 aligned import uses the issued child and revokes it", p.returncode == 0
      and any(x[0] == "POST" and "/data/" in x[1] and x[2] == PROJECT_TOKEN for x in calls)
      and any(x[1] == "auth/token/revoke-self" and x[2] == PROJECT_TOKEN for x in calls))

# A fresh interpreter must not write helper bytecode or a legacy token file.
# Only a mismatched role is requested, so it never mints or reads a real token.
no_cache = os.path.join(WORK, "no-cache-session"); os.mkdir(no_cache)
for filename in ("vault_secrets.py", "vault_sessions.py", "vault_keychain.py"):
    shutil.copyfile(os.path.join(os.path.dirname(SCRIPT), filename), os.path.join(no_cache, filename))
shutil.copyfile(os.path.join(session_dir, "secrets.conf"), os.path.join(no_cache, "secrets.conf"))
bootstrap = ("import sys;sys.path.insert(0,sys.argv[1]);sys.dont_write_bytecode=True;"
             "import vault_secrets as m;sys.dont_write_bytecode=False;"
             "m.keychain_backend=lambda:object();"
             "m.main(['issue','--agent','wrong-project','--token-fd','3'])")
no_cache_env = dict(BASE_ENV, PYTHONDONTWRITEBYTECODE="")
probe_cache = subprocess.run([sys.executable, "-c", bootstrap, no_cache], cwd=no_cache, env=no_cache_env,
                             capture_output=True, text=True, timeout=10)
outputs.append(probe_cache.stdout + probe_cache.stderr)
check("T76 aligned helper loading creates no bytecode cache or token file", probe_cache.returncode == 2
      and not os.path.exists(os.path.join(no_cache, "__pycache__")) and tok() == original_file)

taken()
p = aligned(["provision", "--dry-run"])
check("T77 aligned provision refuses the legacy identity path without any Vault request",
      p.returncode == 2 and "superseded" in p.stderr and not taken())

map_name = os.path.join(session_dir, "secrets.map")
with open(map_name, encoding="utf-8") as fh: saved_map = fh.read()
with open(map_name, "w", encoding="utf-8") as fh:
    fh.write("SESSION_TOKEN=${VAULT_PROJECTS_MOUNT}/demo-session/../another-project/one#token\n")
taken(); command_calls.clear()
p = aligned(["exec", "SESSION_TOKEN", "--", "probe"])
check("T78 dot-segment traversal cannot escape the declared project prefix",
      p.returncode == 2 and not command_calls and not taken())
with open(map_name, "w", encoding="utf-8") as fh: fh.write(saved_map)

state.pop("session_login_token", None); clear_tok()
