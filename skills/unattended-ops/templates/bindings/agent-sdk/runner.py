"""runner.py — the Claude Agent SDK runner for loops/unattended-run/loop.md.

Usage:
    python3 runner.py --binding <binding.md> --run-id <id> [--dry-run]

THIS IS A TEMPLATE, and a trial (TASK-0284, decision D5=B): a second
Claude-side runner beside the Claude Code Workflow binding, to be compared on
the golden unattended run before a human picks one. It carries NO RULE OF ITS
OWN (ADR-0022 clause 1.2), and it holds no control flow of its own either: the
queue, the bounds, the verdict dispatch, the gate calls through run-gate.sh,
the hash-chained journal, the evidence file, the lock checks, the park and the
handover are the OpenCode driver's (bindings/opencode/driver.py), imported, not
copied. This file replaces only what is client-specific:

  - how a role is run: one `claude_agent_sdk.query()` per role call, with the
    role's Claude Code definition as emitted by
    `scripts/emit-agents.py claude-code <dir> --with-guard` (system prompt,
    model, tools, `maxTurns` from the turn table);
  - the role guard (ADR-0062) as a PreToolUse hook callback in
    `ClaudeAgentOptions(hooks=...)`, calling role-guard.py's own `decide()`
    with the role's `agent_type` and role-guard.json
    (`scripts/emit-agents.py --guard-json=`). It answers deny, never allow;
  - the sandbox and permission settings (configs/claude-code/
    settings.sandbox.json + settings.permissions.json), merged and passed as
    the SDK's settings, and the OTel env (configs/claude-code/
    settings.otel.json, as tests/otel/ drives it), tagged with the run id;
  - step 1's client check: the SDK imports, every role's definition exists
    with a turn limit, and the guard loads.

The SDK is OPTIONAL and imported lazily: this module imports, and its tests
run, with no SDK installed (they inject tests/stub_sdk/). A run without it
halts at step 1, naming the package (`pip install claude-agent-sdk`).

Python >= 3.11, run as `python3 runner.py` (no shebang, so no executable bit
to keep). NOT run from tests/validate.sh; in ai-toolbox, CI's
`bindings` job runs its tests (ADR-0032).
"""
from __future__ import annotations

import argparse
import asyncio
import datetime
import importlib
import importlib.util
import json
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))


def _load_base():
    """The OpenCode driver, whose control flow this runner reuses.

    Beside this file when a consumer copies both directories' files into one
    (driver.py and decision-standard.md travel together), else the sibling
    binding in this repository's layout.
    """
    for cand in (os.environ.get("UNATTENDED_BASE_DRIVER"),
                 os.path.join(HERE, "driver.py"),
                 os.path.join(os.path.dirname(HERE), "opencode", "driver.py")):
        if cand and os.path.isfile(cand):
            spec = importlib.util.spec_from_file_location("unattended_base_driver", cand)
            mod = importlib.util.module_from_spec(spec)
            sys.modules[spec.name] = mod
            spec.loader.exec_module(mod)
            return mod
    raise SystemExit("REFUSED: the OpenCode driver (driver.py) this runner builds on "
                     "was not found beside it or at ../opencode/driver.py")


base = _load_base()
Halt, Park, Mechanical, Stopped = base.Halt, base.Park, base.Mechanical, base.Stopped

SDK_MODULE = "claude_agent_sdk"
SDK_PACKAGE = "claude-agent-sdk"

# The slots this runner adds to templates/binding.md's (check-binding.sh
# allows extra slots and checks them like every other).
SLOTS = tuple(s for s in base.REQUIRED_SLOTS) + (
    "agents_dir", "role_guard", "role_guard_json", "sdk_settings", "otel_settings",
    "permission_mode")

MODEL = re.compile(r"^(per-role|sonnet|opus|haiku|fable|claude-[A-Za-z0-9.-]+)$")
# The SDK's permission modes in which tools run without a person; `default`
# would prompt on every edit, and no person is there to answer.
PERMISSION_MODES = ("acceptEdits", "default", "plan")
# role-guard.py's own vocabulary: it answers deny or ask, never allow.
GUARD_ANSWERS = ("deny", "ask")


class SdkBinding(base.Binding):
    SLOTS = SLOTS

    def check_client(self, fm):
        if fm["client"] != "claude-agent-sdk":
            raise Halt("binding client is %r; this runner is the Claude Agent SDK one"
                       % fm["client"])
        if not MODEL.match(fm["model"]):
            raise Halt("model %r is neither per-role nor a Claude alias or id" % fm["model"])
        if fm["permission_mode"] not in PERMISSION_MODES:
            raise Halt("permission_mode %r is not one of %s"
                       % (fm["permission_mode"], ", ".join(PERMISSION_MODES)))

    def __init__(self, path, run_id):
        super().__init__(path, run_id)
        fm = self.fm
        self.agents_dir = os.path.abspath(fm["agents_dir"])
        self.role_guard = os.path.abspath(fm["role_guard"])
        self.role_guard_json = os.path.abspath(fm["role_guard_json"])
        files = fm["sdk_settings"].strip("[]")
        self.sdk_settings = [os.path.abspath(f.strip()) for f in files.split(",") if f.strip()]
        self.otel_settings = (None if fm["otel_settings"] == "not-applicable"
                              else os.path.abspath(fm["otel_settings"]))
        self.permission_mode = fm["permission_mode"]


# --- Emitted agent definitions ------------------------------------------------

def read_definition(path):
    """(frontmatter dict, body) of one emitted Claude Code agent file."""
    with open(path, encoding="utf-8") as fh:
        text = fh.read().replace("\r\n", "\n")
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.S)
    if not m:
        raise Halt("agent definition %s has no frontmatter" % path)
    fm = {}
    for line in m.group(1).split("\n"):
        k, sep, v = line.partition(":")
        if sep and not line.startswith((" ", "\t", "#")):
            fm[k.strip()] = v.strip()
    return fm, m.group(2)


def tool_list(value):
    return [t.strip() for t in (value or "").split(",") if t.strip()]


# --- The role guard, called as a hook callback --------------------------------

def load_guard(path):
    """role-guard.py as a module, for its decide(); never run as a process here."""
    spec = importlib.util.spec_from_file_location("role_guard", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    if not callable(getattr(mod, "decide", None)):
        raise Halt("role guard %s has no decide()" % path)
    return mod


def guard_verdict(guard, cfg, agent_type, data, today):
    """role-guard.py main()'s decision, without its stdin and stdout.

    The same filter (only `<plugin>:<role>` of the plugin role-guard.json
    names), the same fail-closed rule (anything unexpected is a deny), and the
    same two answers. Returns (verdict, reason) with verdict in deny, ask or
    pass.
    """
    try:
        prefix, _, role = agent_type.partition(":")
        if prefix != cfg.get("plugin") or role not in cfg.get("roles", {}):
            return "pass", ""
        verdict, why = guard.decide(cfg, role, data, today)
    except Exception as exc:  # fail closed, as role-guard.py does
        return "deny", "the guard could not decide (%s: %s); failing closed" % (
            type(exc).__name__, exc)
    return (verdict, why) if verdict in GUARD_ANSWERS else ("pass", "")


# --- The runner ---------------------------------------------------------------

class SdkDriver(base.Driver):
    """The OpenCode driver's steps, with each role run through the Agent SDK."""

    def __init__(self, binding, dry_run=False):
        super().__init__(binding, dry_run)
        self.sdk = None
        self.definitions = {}
        self.guard = None
        self.guard_cfg = None
        self.settings_path = None
        self.env = {}
        self.denials = []

    # -- step 1, the client half --------------------------------------------

    def check_client_ready(self):
        """Step 1 — the SDK imports; a missing optional dependency is a stop."""
        try:
            self.sdk = importlib.import_module(SDK_MODULE)
        except ImportError as exc:
            raise Halt("%s is not importable (%s); install %s to run this binding"
                       % (SDK_MODULE, exc, SDK_PACKAGE))
        for name in ("query", "ClaudeAgentOptions", "HookMatcher", "ResultMessage",
                     "AssistantMessage"):
            if not hasattr(self.sdk, name):
                raise Halt("%s has no %s; this runner was written against its "
                           "documented API" % (SDK_MODULE, name))

    def check_roles(self):
        """Step 1 — every role's emitted definition, its turn limit, the guard.

        The SDK analogue of the OpenCode driver's `opencode agent list` check
        (ADR-0022 clause 5.1): a role whose definition is absent would run as
        a bare model with no boundary, so it halts the run.
        """
        for role, name in self.b.roles.items():
            path = os.path.join(self.b.agents_dir, name + ".md")
            if not os.path.isfile(path):
                raise Halt("no emitted definition for role %s at %s (scripts/emit-agents.py "
                           "claude-code <dir> --with-guard)" % (role, path))
            fm, body = read_definition(path)
            if fm.get("name") != name:
                raise Halt("definition %s names %r, not %r" % (path, fm.get("name"), name))
            if not re.fullmatch(r"[1-9][0-9]*", fm.get("maxTurns", "")):
                # The turn table (docs/development/turn-limits.md) reaches a role
                # through the emitter; a role without one is unknown, a stop.
                raise Halt("definition %s carries no maxTurns" % path)
            model = self.b.model if self.b.model != "per-role" else fm.get("model", "")
            if not MODEL.match(model) or model == "per-role":
                raise Halt("role %s has no usable model (binding %r, definition %r)"
                           % (role, self.b.model, fm.get("model")))
            self.definitions[role] = {
                "path": path, "body": body.strip(), "model": model,
                "max_turns": int(fm["maxTurns"]), "tools": tool_list(fm.get("tools")),
                "disallowed": tool_list(fm.get("disallowedTools"))}
            self.agent_lines[role] = "%s (%s, maxTurns %s)" % (path, model, fm["maxTurns"])
        try:
            self.guard = load_guard(self.b.role_guard)
            with open(self.b.role_guard_json, encoding="utf-8") as fh:
                self.guard_cfg = json.load(fh)
        except (OSError, ValueError, ImportError, SyntaxError) as exc:
            raise Halt("role guard did not load (%s: %s)" % (type(exc).__name__, exc))
        if not self.guard_cfg.get("plugin") or not isinstance(self.guard_cfg.get("roles"), dict):
            raise Halt("role-guard.json %s names no plugin or roles" % self.b.role_guard_json)
        self.settings_path = self.write_settings()
        self.env = self.otel_env()
        for role in self.b.roles:
            # Fail here, not mid-run, if this SDK does not take an option.
            self.options(role)

    def driver_checks(self):
        return {"model": self.b.model,
                "model_passed_as": "ClaudeAgentOptions.model on every query() this run makes",
                "agent_list": self.agent_lines,
                "agent_list_source": "the emitted definitions in %s, read by the runner at "
                                     "step 1" % self.b.agents_dir,
                "role_guard": "%s with %s, as a PreToolUse hook callback"
                              % (self.b.role_guard, self.b.role_guard_json)}

    # -- options ------------------------------------------------------------

    def write_settings(self):
        """The sandbox and permission settings, merged, beside the evidence."""
        merged = {}
        for path in self.b.sdk_settings:
            try:
                with open(path, encoding="utf-8") as fh:
                    part = json.load(fh)
            except (OSError, ValueError) as exc:
                raise Halt("settings file %s did not load (%s)" % (path, exc))
            for key, value in part.items():
                if isinstance(value, dict) and isinstance(merged.get(key), dict):
                    merged[key] = dict(merged[key], **value)
                else:
                    merged[key] = value
        out = os.path.join(os.path.dirname(self.b.evidence), "sdk-settings.json")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, "w", encoding="utf-8") as fh:
            json.dump(merged, fh, indent=2, sort_keys=True)
        return out

    def otel_env(self):
        """settings.otel.json's env, the run id as a resource attribute, and
        any OTEL_* the operator exported on top (as tests/otel/ drives it)."""
        if not self.b.otel_settings:
            return {}
        try:
            with open(self.b.otel_settings, encoding="utf-8") as fh:
                env = dict(json.load(fh).get("env") or {})
        except (OSError, ValueError) as exc:
            raise Halt("otel settings %s did not load (%s)" % (self.b.otel_settings, exc))
        env["OTEL_RESOURCE_ATTRIBUTES"] = "run.id=%s" % self.b.run_id
        env.update({k: v for k, v in os.environ.items() if k.startswith("OTEL_")})
        return {k: str(v) for k, v in env.items()}

    def hooks_for(self, role):
        """The role guard as a PreToolUse hook callback (ADR-0062).

        Bound to this role's agent_type, since a top-level query() has none of
        its own. A guard `ask` is answered deny: no person answers a prompt in
        an unattended run (templates/binding.md, rule 2 of the inherited four),
        which is role-guard.py's own rule for a mode with nobody present.
        """
        agent_type = "%s:%s" % (self.guard_cfg["plugin"], self.b.roles[role])
        driver = self

        async def pre_tool_use(input_data, tool_use_id, context):
            data = dict(input_data or {})
            data["agent_type"] = agent_type
            data.setdefault("permission_mode", driver.b.permission_mode)
            data.setdefault("cwd", driver.repo)
            today = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
            verdict, why = guard_verdict(driver.guard, driver.guard_cfg, agent_type, data, today)
            if verdict == "pass":
                return {}
            if verdict == "ask":
                why += "; asked, and no person is present in an unattended run"
            driver.denials.append({"tool": data.get("tool_name", "?"), "guard": verdict,
                                   "reason": why})
            return {"hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": "role-guard (ADR-0062): " + why}}

        return {"PreToolUse": [self.sdk.HookMatcher(matcher=None, hooks=[pre_tool_use])]}

    def options(self, role):
        d = self.definitions[role]
        kwargs = dict(system_prompt=d["body"], model=d["model"], max_turns=d["max_turns"],
                      disallowed_tools=d["disallowed"], permission_mode=self.b.permission_mode,
                      cwd=self.repo, settings=self.settings_path, env=self.env,
                      hooks=self.hooks_for(role))
        if d["tools"]:
            kwargs["allowed_tools"] = d["tools"]
        try:
            return self.sdk.ClaudeAgentOptions(**kwargs)
        except TypeError as exc:
            raise Halt("%s.ClaudeAgentOptions refused the runner's options: %s"
                       % (SDK_MODULE, exc))

    # -- a role call ----------------------------------------------------------

    def invoke(self, role, prompt):
        """Run one role through query(), returning its final message text.

        The texts of every assistant message, then the result's own text, so
        extract_json() finds the role's last JSON block as on OpenCode. A
        result past the role's turn limit or marked as an error is a
        mechanical failure (loop.md, "A step fails mechanically").
        """
        if self.sdk is None or role not in self.definitions or self.guard_cfg is None:
            # Step 1 halted before this role's definition and guard loaded; a
            # role is never run without them.
            raise Mechanical("%s cannot run: the SDK, its definition or the guard "
                             "did not load at step 1" % role)
        self.denials = []
        limit = self.b.role_timeouts.get(role, self.b.role_timeout)
        started = time.time()
        try:
            texts, result = asyncio.run(asyncio.wait_for(
                self._query(prompt, self.options(role)), limit))
        except asyncio.TimeoutError:
            raise Mechanical("%s did not return within %ss" % (role, limit))
        except Exception as exc:
            # A single-shot query() that ends in an error result raises
            # ResultError (carrying `subtype`) rather than yielding it (the
            # SDK's python.md, "ResultError"); it is read as that result.
            err = getattr(self.sdk, "ResultError", None)
            if err is None or not isinstance(exc, err):
                raise
            texts, result = [], exc
            result.is_error = True
        finally:
            if self.denials:
                self.journal("tool-denied", role=role,
                             tools=[d["tool"] for d in self.denials],
                             reasons=[d["reason"] for d in self.denials])
        self.journal("role-result", role=role,
                     subtype=getattr(result, "subtype", None),
                     turns=getattr(result, "num_turns", None),
                     cost_usd=getattr(result, "total_cost_usd", None),
                     duration_ms=getattr(result, "duration_ms", int((time.time() - started) * 1000)))
        if result is None:
            raise Mechanical("%s returned no result message" % role)
        if getattr(result, "subtype", "") == "error_max_turns":
            raise Mechanical("%s stopped at its maxTurns %d"
                             % (role, self.definitions[role]["max_turns"]))
        if getattr(result, "is_error", False):
            raise Mechanical("%s ended in error: %s" % (role, getattr(result, "subtype", "?")))
        final = getattr(result, "result", None)
        if isinstance(final, str) and final and final not in texts:
            texts.append(final)
        return "\n".join(texts)

    async def _query(self, prompt, options):
        texts, result = [], None
        async for msg in self.sdk.query(prompt=prompt, options=options):
            if isinstance(msg, self.sdk.AssistantMessage):
                for block in getattr(msg, "content", None) or []:
                    text = getattr(block, "text", None)
                    if isinstance(text, str):
                        texts.append(text)
            elif isinstance(msg, self.sdk.ResultMessage):
                result = msg
        return texts, result


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--binding", required=True)
    ap.add_argument("--run-id", required=True)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)
    if not re.fullmatch(r"[A-Za-z0-9._-]+", args.run_id):
        print("REFUSED: run id %r is not [A-Za-z0-9._-]+" % args.run_id, file=sys.stderr)
        return 2
    try:
        base.decision_standard()
        binding = SdkBinding(args.binding, args.run_id)
    except (Halt, OSError, ValueError) as exc:
        print("REFUSED: %s" % exc, file=sys.stderr)
        return 2
    driver = SdkDriver(binding, dry_run=args.dry_run)
    code = driver.run()
    print("handover: %s" % binding.handover)
    if getattr(driver, "journal_head", None):
        print("journal-head: %s" % driver.journal_head)
    return code


if __name__ == "__main__":
    sys.exit(main())
