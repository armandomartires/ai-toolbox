#!/usr/bin/env python3
"""Emit client-native agent files from agents/<role>/agent.md.

ADR-0018's mechanism. One client-agnostic source per role; one generated
file per (role, client) pair. Never a symlink: an emitted file's content
differs per client by definition, so there is no `link` or `copy` mode for
agents (ADR-0018 clause 3).

WHY THERE IS NO FRESHNESS CHECK, AND WHY ONE MUST NOT BE ADDED
--------------------------------------------------------------
Emission creates a copy outside the repo whose currency nothing verifies.
That is a real, accepted weakness. It is NOT to be fixed by having
tests/validate.sh inspect the emitted copy.

ADR-0018 clause 4: "anyone who later 'fixes' this by checking the deployed
copy breaks every fresh clone and CI." ADR-0009 states the underlying rule:
"a gate that cannot pass on a clean checkout stops being run, and a gate
that is not run is worse than no gate, because it is still trusted."

The control is that emission is cheap and idempotent, and install.sh is
re-run. If you are here to add a staleness check, read those two ADRs
first.

`model` IS EMITTED UNRESOLVED, AND NOTHING HERE RESOLVES IT
-----------------------------------------------------------
A role's optional `model` is a tier name, emitted verbatim as
`model: "{tier:<name>}"`. ADR-0018 clause 7 keeps the tier->model mapping in
one place rather than duplicating it here — but that place,
`agent-tiers`' models.jsonc, stays in opencode-customization (ADR-0017,
rejected 2026-09-15). So the placeholder currently resolves nowhere.

Roles should omit `model`; every role authored so far does. Do NOT add a
tier->model table to this file to "fix" it: two owners of one fact is
exactly what clause 7 forbids, and worse than the gap. See
docs/development/authoring-guide.md "Known gap: `model` has no resolver in
this repo".

REFUSE, NEVER DEGRADE
---------------------
ADR-0018 clause 8. Five of the nine capability terms cannot be enforced
per-agent in Claude Code, because `tools`/`disallowedTools` gate whole
tools and have no third `ask` state. Asked to emit such a role for Claude
Code, this script FAILS LOUDLY rather than emitting a file with the term
dropped.

That is the whole point. A dropped boundary is invisible: TASK-0036
observed a role declaring read-only in OpenCode's syntax loading in Claude
Code with Write, Edit and Bash still in its tool pool, because the
`permission:` block was parsed as an unknown key and discarded without a
warning. A file that claims `deny` over an agent that can write is worse
than a file that refused to emit.
"""
import os
import re
import sys

# --- capability vocabulary -------------------------------------------------
# Mirrors docs/development/authoring-guide.md "Agents". A closed set: an
# unknown term is one this emitter has no mapping for, and tests/validate.sh
# rejects it at commit time so it cannot reach here.
#
# Each entry maps a term to its per-client expression. `None` means the
# client CANNOT enforce the term per-agent — emission for that client is
# refused, not degraded.
#
# opencode: a list of (permission_key, value) or (key, {glob: action}) pairs.
# claude_code: a set of tool names to withhold, or None if unexpressible.
VOCAB = {
    "read-only": {
        "opencode": [("edit", "deny"), ("write", "deny")],
        "claude_code": {"deny_tools": ["Write", "Edit", "NotebookEdit"]},
    },
    "no-delegation": {
        "opencode": [("task", "deny")],
        "claude_code": {"deny_tools": ["Agent"]},
    },
    # The one PARAMETERISED term: its output depends on the role's
    # `delegates_to` list, so both emitters special-case it rather than
    # reading a static value from this table. Marked here so the table stays
    # the single index of what the vocabulary contains.
    #
    # Valid only with mode: primary, enforced by validate.sh. Claude Code
    # honours Agent(...) only for a main-thread agent and IGNORES the type
    # list in a subagent definition, so emitting it for a subagent would
    # silently widen the boundary.
    "delegation-allowlist": {
        "opencode": "PARAMETERISED",
        "claude_code": "PARAMETERISED",
    },
    "no-webfetch": {
        "opencode": [("webfetch", "deny"), ("websearch", "deny")],
        "claude_code": {"deny_tools": ["WebFetch", "WebSearch"]},
    },
    # Semantically PARTIAL, not equivalent. OpenCode refuses tool calls
    # touching paths outside the worktree; Claude Code's `isolation:
    # worktree` redirects the agent into an isolated *copy* of the repo.
    # Confinement by refusal vs confinement by redirection. Decided in
    # TASK-0040: emit the nearest mechanism and record the difference,
    # because refusing would make every existing role OpenCode-only.
    "worktree-only": {
        "opencode": [("external_directory", "deny")],
        "claude_code": {"isolation": "worktree", "partial": True},
    },
    "test-files-only": {
        "opencode": [("edit", {
            "*": "deny",
            "**/test/**": "allow",
            "**/tests/**": "allow",
            "**/__tests__/**": "allow",
            "**/*.test.*": "allow",
            "**/*_test.*": "allow",
            "**/*.spec.*": "allow",
            "**/spec/**": "allow",
        })],
        "claude_code": None,
    },
    "bash-allowlist": {
        "opencode": [("bash", {"*": "ask"})],
        "claude_code": None,
    },
    "no-force-push": {
        "opencode": [("bash", {
            "git push --force*": "deny",
            "git push -f*": "deny",
            "git reset --hard*": "deny",
            "git rebase*": "deny",
            "git filter-branch*": "deny",
        })],
        "claude_code": None,
    },
    "push-requires-confirmation": {
        "opencode": [("bash", {"git push*": "ask"})],
        "claude_code": None,
    },
    "webfetch-requires-confirmation": {
        "opencode": [("webfetch", "ask")],
        "claude_code": None,
    },
}

CLIENT_KEYS = {"claude-code": "claude_code", "opencode": "opencode"}


class Refused(Exception):
    """Emission refused: a declared term the target cannot enforce."""


def parse(path):
    """Parse a role file into (frontmatter dict-ish, body).

    Deliberately a narrow parser rather than PyYAML: this repo's gate has no
    third-party dependency and must stay hermetic. validate.sh has already
    enforced the schema by the time this runs, so the shapes are known.
    """
    with open(path, encoding="utf-8") as fh:
        lines = fh.read().split("\n")
    if not lines or lines[0].strip() != "---":
        raise Refused("%s: no frontmatter" % path)
    end = next(i for i, l in enumerate(lines[1:], 1) if l.strip() == "---")
    fm, body = lines[1:end], "\n".join(lines[end + 1:]).strip()

    out = {}
    for i, line in enumerate(fm):
        m = re.match(r"^([a-zA-Z_][a-zA-Z0-9_]*):(.*)$", line)
        if not m:
            continue
        key, val = m.group(1), m.group(2).strip()
        if val:
            out[key] = val.strip("\"'")
            continue
        items = []
        for cont in fm[i + 1:]:
            if not cont.strip() or not cont[0] in " \t":
                break
            im = re.match(r"^\s+-\s+(.*)$", cont)
            if not im:
                break
            items.append(im.group(1).strip().strip("\"'"))
        out[key] = items
    return out, body


def emit_opencode(role, fm, body):
    perms = {}
    for term in fm["capabilities"]:
        if term == "delegation-allowlist":
            # Deny-first, then the allowed names. OpenCode's rules are
            # last-match-wins, so "*" MUST come first — emitting the names
            # first would leave a blanket deny winning and block everything.
            perms["task"] = {"*": "deny"}
            for name in fm.get("delegates_to", []):
                perms["task"][name] = "allow"
            continue
        for key, value in VOCAB[term]["opencode"]:
            if isinstance(value, dict):
                merged = perms.get(key)
                if not isinstance(merged, dict):
                    merged = {}
                # Glob order matters: OpenCode's last matching rule wins, so
                # the broad rule must be written before the specific ones.
                merged.update(value)
                perms[key] = merged
            else:
                if key not in perms:
                    perms[key] = value
    out = ["---", "description: %s" % fm["description"], "mode: %s" % fm["mode"]]
    if fm.get("model"):
        out.append("model: \"{tier:%s}\"" % fm["model"])
    if perms:
        out.append("permission:")
        for key in sorted(perms):
            v = perms[key]
            if isinstance(v, dict):
                out.append("  %s:" % key)
                for glob in sorted(v, key=lambda g: (g != "*", g)):
                    out.append("    \"%s\": %s" % (glob, v[glob]))
            else:
                out.append("  %s: %s" % (key, v))
    out += ["---", "", body, ""]
    return "\n".join(out)


def emit_claude_code(role, fm, body):
    deny, extra, allow_tools = [], {}, []
    for term in fm["capabilities"]:
        if term == "delegation-allowlist":
            # Agent(a, b) is an ALLOWLIST, so it goes in `tools` rather than
            # `disallowedTools`. Honoured only for a main-thread agent, which
            # is why validate.sh requires mode: primary.
            names = ", ".join(fm.get("delegates_to", []))
            allow_tools.append("Agent(%s)" % names)
            continue
        spec = VOCAB[term]["claude_code"]
        if spec is None:
            raise Refused(
                "role '%s' declares '%s', which Claude Code cannot enforce "
                "per-agent (tools/disallowedTools gate whole tools and have "
                "no 'ask' state). Narrow its 'clients' list to opencode, or "
                "see ADR-0018 clause 8.4 before adding a workaround."
                % (role, term))
        deny += spec.get("deny_tools", [])
        for k, v in spec.items():
            if k not in ("deny_tools", "partial"):
                extra[k] = v
    out = ["---", "name: %s" % role,
           "description: %s" % fm["description"]]
    if deny:
        seen, uniq = set(), []
        for t in deny:
            if t not in seen:
                seen.add(t)
                uniq.append(t)
        out.append("disallowedTools: %s" % ", ".join(uniq))
    if allow_tools:
        # `tools` here carries ONLY Agent(...) entries, never concrete tool
        # names: `tools` is an allowlist, so naming a tool would silently
        # remove every tool NOT named — a far wider change than the
        # capability asked for. Claude Code applies disallowedTools first,
        # then resolves tools against what remains.
        out.append("tools: %s" % ", ".join(allow_tools))
    for k in sorted(extra):
        out.append("%s: %s" % (k, extra[k]))
    if fm.get("model"):
        out.append("model: \"{tier:%s}\"" % fm["model"])
    out += ["---", "", body, ""]
    return "\n".join(out)


EMITTERS = {"opencode": emit_opencode, "claude-code": emit_claude_code}


def main():
    if len(sys.argv) != 3:
        print("usage: emit-agents.py <client> <agents-target-dir>",
              file=sys.stderr)
        return 2
    client, target = sys.argv[1], sys.argv[2]
    if client not in CLIENT_KEYS:
        print("unknown client: %s" % client, file=sys.stderr)
        return 2

    if not os.path.isdir("agents"):
        return 0
    rc = 0
    for role in sorted(os.listdir("agents")):
        d = os.path.join("agents", role)
        # Same skip as the registry generator and the skills loop.
        if role.startswith("_template") or not os.path.isdir(d):
            continue
        src = os.path.join(d, "agent.md")
        if not os.path.isfile(src):
            continue
        fm, body = parse(src)
        if client not in fm.get("clients", []):
            print("  agent skipped: %s -> %s (not in its clients list)"
                  % (role, client))
            continue
        try:
            text = EMITTERS[client](role, fm, body)
        except Refused as e:
            print("  EMISSION REFUSED: %s" % e, file=sys.stderr)
            rc = 1
            continue
        os.makedirs(target, exist_ok=True)
        dest = os.path.join(target, "%s.md" % role)
        with open(dest, "w", encoding="utf-8") as fh:
            fh.write(text)
        print("  agent emitted: %s -> %s (%s)" % (role, client, dest))
    return rc


if __name__ == "__main__":
    sys.exit(main())
