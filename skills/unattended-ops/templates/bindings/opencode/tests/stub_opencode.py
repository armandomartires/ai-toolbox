#!/usr/bin/env python3
"""A stand-in for `opencode`, for the driver's tests. It is a MODEL of the
client, not the client: it replays the event shapes TASK-0055 observed
(opencode 1.18.31) and proves nothing about a later version.

Environment:
  STUB_SCENARIO  JSON: {"agent_list": "<text>", "agents": {name: [response]}}
  STUB_LOG       JSONL file; one line per invocation, with the full argv
  STUB_STATE     directory holding each agent's response counter

A response is {"text": str|null, "raw": str, "stderr": str, "exit": int,
"sh": [shell commands run first, with GIT_CALLER=stub], "auto": name}.
Responses are consumed in order; the last one repeats. `sh` and `text` may
contain {TASK} (the first `task TASK-nnnn` in the prompt); `text` may contain
{HEAD} (resolved after `sh` runs). `auto` builds a dynamic reply:
  gate-runner  -> report every handle's line from the evidence file
  stash        -> run `git stash push -u -m <stash_message>` from the prompt
"""
import json
import os
import re
import subprocess
import sys


def inputs_of(prompt):
    m = re.search(r"Inputs:\n```json\n(.*?)\n```", prompt, re.S)
    return json.loads(m.group(1)) if m else {}


def main():
    argv = sys.argv[1:]
    with open(os.environ["STUB_LOG"], "a", encoding="utf-8") as fh:
        fh.write(json.dumps({"argv": argv}) + "\n")
    with open(os.environ["STUB_SCENARIO"], encoding="utf-8") as fh:
        scenario = json.load(fh)
    if argv[:2] == ["agent", "list"]:
        sys.stdout.write(scenario["agent_list"])
        return 0
    agent = argv[argv.index("--agent") + 1]
    prompt = argv[-1]
    queue = scenario["agents"].get(agent) or [{"text": None}]
    counter = os.path.join(os.environ["STUB_STATE"], agent)
    n = int(open(counter).read()) if os.path.exists(counter) else 0
    with open(counter, "w") as fh:
        fh.write(str(n + 1))
    resp = queue[min(n, len(queue) - 1)]
    env = dict(os.environ, GIT_CALLER="stub")
    m = re.search(r"\btask (TASK-\d+)", prompt)
    task = m.group(1) if m else ""
    for cmd in resp.get("sh", []):
        subprocess.run(cmd.replace("{TASK}", task), shell=True, check=True, env=env)
    text = resp.get("text")
    if text is not None:
        text = text.replace("{TASK}", task)
    if resp.get("auto") == "gate-runner":
        got = inputs_of(prompt)
        lines = open(got["evidence_file"]).read().splitlines()
        rows = []
        for h in got["gates"]:
            line = next(l for l in lines if l.startswith("GATE %s " % h))
            rows.append({"handle": h, "evidence_line": line, "figures": []})
        text = "```json\n%s\n```" % json.dumps({"gates": rows})
    if resp.get("auto") == "stash":
        msg = inputs_of(prompt)["stash_message"]
        subprocess.run(["git", "stash", "push", "-u", "-m", msg], check=True,
                       env=env, capture_output=True)
        text = "```json\n%s\n```" % json.dumps({"porcelain": "", "stash_entry": msg, "paths": []})
    if text is not None and "{HEAD}" in text:
        head = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True,
                              text=True, env=env).stdout.strip()
        text = text.replace("{HEAD}", head)
    if "raw" in resp:
        sys.stdout.write(resp["raw"])
    else:
        events = [{"type": "step_start", "part": {}}]
        if text is not None:
            events.append({"type": "text", "part": {"text": text}})
        events.append({"type": "step_finish", "part": {}})
        sys.stdout.write("".join(json.dumps(e) + "\n" for e in events))
    sys.stderr.write(resp.get("stderr", ""))
    return resp.get("exit", 0)


if __name__ == "__main__":
    sys.exit(main())
