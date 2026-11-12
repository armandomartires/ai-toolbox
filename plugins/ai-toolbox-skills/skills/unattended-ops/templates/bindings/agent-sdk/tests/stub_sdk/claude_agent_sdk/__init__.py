"""A stand-in for `claude_agent_sdk`, for the runner's tests. It is a MODEL of
the SDK, not the SDK: the names and shapes are those of the Claude Agent SDK
for Python as documented (query(), ClaudeAgentOptions, HookMatcher, the
PreToolUse hook callback and its hookSpecificOutput, AssistantMessage,
TextBlock, ResultMessage), and it proves nothing about a real release.

What it does with a query(): it names the role from the prompt ("You are the
<role> role"), takes that role's next scripted response, and replays it:

  sh          shell commands run first, outside any hook (like the OpenCode
              stub's `sh`: the role's own work, not a tool call under test)
  tool_calls  [{"tool": "Bash", "input": {"command": "..."}}, ...] - each is
              put to every PreToolUse hook callback in options.hooks whose
              matcher fits; a "deny" answer means the call is not run and its
              result is an error, as the SDK does; otherwise a Bash call runs
  text        the assistant's text; {TASK} and {HEAD} as in the OpenCode stub
  auto        "gate-runner" or "stash", as in the OpenCode stub
  result      overrides for the ResultMessage (subtype, is_error, num_turns)

Environment: STUB_SCENARIO (JSON {"agents": {role: [response, ...]}}),
STUB_LOG (JSONL, one line per query with the options it was given),
STUB_STATE (a directory of per-role counters).
"""
import json
import os
import re
import subprocess
from dataclasses import dataclass, field
from typing import Any


@dataclass
class TextBlock:
    text: str


@dataclass
class ToolUseBlock:
    id: str
    name: str
    input: dict


@dataclass
class ToolResultBlock:
    tool_use_id: str
    content: Any = None
    is_error: bool = False


@dataclass
class AssistantMessage:
    content: list
    model: str = "stub"


@dataclass
class UserMessage:
    content: Any


@dataclass
class ResultMessage:
    subtype: str
    duration_ms: int
    duration_api_ms: int
    is_error: bool
    num_turns: int
    session_id: str
    total_cost_usd: float = 0.0
    usage: dict = None
    result: str = None


class ResultError(Exception):
    """A single-shot query() that ends in an error result raises this (with
    the result's `subtype`) instead of yielding the ResultMessage; the SDK's
    python.md, "ResultError", read 2026-11-12."""

    def __init__(self, subtype, num_turns=None):
        super().__init__("query ended in %s" % subtype)
        self.subtype = subtype
        self.num_turns = num_turns


@dataclass
class HookMatcher:
    matcher: str = None
    hooks: list = field(default_factory=list)
    timeout: float = None


@dataclass
class ClaudeAgentOptions:
    allowed_tools: list = field(default_factory=list)
    system_prompt: Any = None
    permission_mode: str = None
    max_turns: int = None
    disallowed_tools: list = field(default_factory=list)
    model: str = None
    cwd: Any = None
    settings: str = None
    env: dict = field(default_factory=dict)
    hooks: dict = None
    setting_sources: list = None


def _inputs(prompt):
    m = re.search(r"Inputs:\n```json\n(.*?)\n```", prompt, re.S)
    return json.loads(m.group(1)) if m else {}


def _run(cmd, cwd):
    env = dict(os.environ, GIT_CALLER="stub")
    return subprocess.run(cmd, shell=True, cwd=cwd, env=env, capture_output=True, text=True)


def _log(row):
    with open(os.environ["STUB_LOG"], "a", encoding="utf-8") as fh:
        fh.write(json.dumps(row) + "\n")


async def _decide(options, tool, tool_input, n):
    """Every matching PreToolUse callback; the strictest answer wins."""
    hooks = (options.hooks or {}).get("PreToolUse") or []
    answers = []
    for matcher in hooks:
        if matcher.matcher and not re.fullmatch(matcher.matcher, tool):
            continue
        for cb in matcher.hooks:
            out = await cb({"hook_event_name": "PreToolUse", "tool_name": tool,
                            "tool_input": tool_input, "session_id": "stub",
                            "cwd": str(options.cwd)}, "toolu_%d" % n, {"signal": None})
            spec = (out or {}).get("hookSpecificOutput") or {}
            if spec.get("permissionDecision"):
                answers.append((spec["permissionDecision"],
                                spec.get("permissionDecisionReason", "")))
    for wanted in ("deny", "ask", "allow"):
        for got in answers:
            if got[0] == wanted:
                return got
    return None, ""


async def query(*, prompt, options=None, transport=None):
    options = options or ClaudeAgentOptions()
    m = re.match(r"You are the (\S+) role", prompt)
    role = m.group(1) if m else "?"
    with open(os.environ["STUB_SCENARIO"], encoding="utf-8") as fh:
        scenario = json.load(fh)
    queue = scenario["agents"].get(role) or [{"text": None}]
    counter = os.path.join(os.environ["STUB_STATE"], role)
    n = int(open(counter).read()) if os.path.exists(counter) else 0
    with open(counter, "w") as fh:
        fh.write(str(n + 1))
    resp = queue[min(n, len(queue) - 1)]
    cwd = str(options.cwd or os.getcwd())
    t = re.search(r"\btask (TASK-\d+|[1-9][0-9]*)\b", prompt)
    task = t.group(1) if t else ""
    calls = []
    for cmd in resp.get("sh", []):
        subprocess.run(cmd.replace("{TASK}", task), shell=True, check=True, cwd=cwd,
                       env=dict(os.environ, GIT_CALLER="stub"))
    for i, call in enumerate(resp.get("tool_calls", [])):
        tool_input = json.loads(json.dumps(call.get("input", {})).replace("{TASK}", task))
        yield AssistantMessage(content=[ToolUseBlock("toolu_%d" % i, call["tool"], tool_input)])
        decision, reason = await _decide(options, call["tool"], tool_input, i)
        row = {"tool": call["tool"], "input": tool_input, "decision": decision,
               "reason": reason, "ran": False}
        if decision == "deny":
            content, is_error = "Permission denied by PreToolUse hook: %s" % reason, True
        elif call["tool"] == "Bash":
            proc = _run(tool_input["command"], cwd)
            row.update(ran=True, exit=proc.returncode)
            content, is_error = proc.stdout + proc.stderr, proc.returncode != 0
        else:
            content, is_error = "stub: %s not modelled" % call["tool"], True
        calls.append(row)
        yield UserMessage(content=[ToolResultBlock("toolu_%d" % i, content, is_error)])
    text = resp.get("text")
    if text is not None:
        text = text.replace("{TASK}", task)
    if resp.get("auto") == "gate-runner":
        got = _inputs(prompt)
        lines = open(got["evidence_file"]).read().splitlines()
        rows = [{"handle": h, "evidence_line": next(l for l in lines if l.startswith("GATE %s " % h)),
                 "figures": resp.get("figures", [])} for h in got["gates"]]
        text = "```json\n%s\n```" % json.dumps({"gates": rows})
    if resp.get("auto") == "stash":
        msg = _inputs(prompt)["stash_message"]
        subprocess.run(["git", "stash", "push", "-u", "-m", msg], check=True, cwd=cwd,
                       env=dict(os.environ, GIT_CALLER="stub"), capture_output=True)
        text = "```json\n%s\n```" % json.dumps({"porcelain": "", "stash_entry": msg, "paths": []})
    if text is not None and "{HEAD}" in text:
        head = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True,
                              cwd=cwd, env=dict(os.environ, GIT_CALLER="stub")).stdout.strip()
        text = text.replace("{HEAD}", head)
    _log({"role": role, "prompt": prompt, "calls": calls, "options": {
        "model": options.model, "max_turns": options.max_turns,
        "system_prompt": options.system_prompt, "permission_mode": options.permission_mode,
        "allowed_tools": options.allowed_tools, "disallowed_tools": options.disallowed_tools,
        "settings": options.settings, "env": options.env,
        "hooks": sorted((options.hooks or {}).keys())}})
    if text is not None:
        yield AssistantMessage(content=[TextBlock(text)])
    result = dict({"subtype": "success", "is_error": False, "num_turns": 1 + len(calls)},
                  **resp.get("result", {}))
    if result["is_error"]:
        raise ResultError(result["subtype"], result["num_turns"])
    yield ResultMessage(subtype=result["subtype"], duration_ms=1, duration_api_ms=1,
                        is_error=result["is_error"], num_turns=result["num_turns"],
                        session_id="stub", total_cost_usd=0.0, usage={}, result=text)
