#!/usr/bin/env python3
"""Emit client-native agent files from agents/<role>/agent.md.

ADR-0018's mechanism. One client-agnostic source per role; one generated
file per (role, client) pair.

CLAUDE CODE IS THE REFERENCE PROFILE (ADR-0065, TASK-0280)
----------------------------------------------------------
A term's meaning is what Claude Code enforces for it: the tools withheld,
the role guard's rules (ADR-0062), the isolation. Each port (OpenCode,
Codex) maps the term to its own mechanism or REFUSES the role; a term is no
longer held back to what the weakest client can express. `--parity` prints
the term and role matrix that docs/registry.md carries, and
tests/test-emit-parity.sh checks it against what this file emits. Never a symlink: an emitted file's content
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

`model` FOR CLAUDE CODE COMES FROM ONE TABLE, .ai/context/model-tiers.md
-----------------------------------------------------------------------
ADR-0059 supersedes ADR-0018 clause 7 for Claude Code emission only: this
repo owns the role->alias table (opus, sonnet, haiku) that Claude Code agents
are emitted from, and emit_claude_code writes `model: <alias>` from it. A role
the table does not list gets `model: inherit`. This file holds no table of its
own, and a role's own `model` key does not override the table: change a
role's tier by editing its line in .ai/context/model-tiers.md.

OpenCode is unchanged: emit_opencode still writes `model: "{tier:<name>}"`,
resolved by agent-tiers' models.jsonc, which stays in opencode-customization
(ADR-0017, rejected 2026-09-15; clause 7 still applies there). See
docs/development/authoring-guide.md "`model` and the tier table".

`maxTurns` AND `autoCompactWindow` FOR CLAUDE CODE: .ai/context/turn-limits.md
------------------------------------------------------------------------------
TASK-0282. emit_claude_code writes both keys from that table's row for the
role; a `-` cell, or a role the table does not list, emits no key. Like the
tier table, it is the only copy: a role's own frontmatter does not override
it. OpenCode emission is unchanged (its cap is `steps`; TASK-0280).

REFUSE, NEVER DEGRADE
---------------------
ADR-0018 clause 8. **Seven of the thirteen** capability terms cannot be enforced
per-agent in Claude Code, because `tools`/`disallowedTools` gate whole
tools and have no third `ask` state. Asked to emit such a role for Claude
Code, this script FAILS LOUDLY rather than emitting a file with the term
dropped.

THE ROLE GUARD (TASK-0271, ADR-0062) now enforces those seven out of
the agent file: their `claude_code` is `GUARD`/`GUARD_SHELL`, not None. A role
carrying one is emitted for Claude Code only with `--with-guard` (the plugin
build, which ships configs/claude-code/hooks/role-guard.py and the
`--guard-json=` rules beside it); a plain emission skips it and says so. So
the REFUSAL set below is empty today; the refusal path stays for any term
added without a mapping.

TWO DIFFERENT COUNTS, AND THEY ARE BOTH RIGHT. This docstring counts the
REFUSAL set — terms whose `claude_code` was None (seven until TASK-0271). The authoring guide
counts terms NOT enforceable in both clients (eight). The difference is
`worktree-only`, which is PARTIAL: it emits `isolation: worktree` rather
than refusing. Read either as the other and you will be wrong; TASK-0063
flagged exactly that risk. If you add a term, correct both numbers, in both
files.

(The count read "five of the nine" until TASK-0071, over a table of ten,
then "six of the eleven" (TASK-0078, `no-bash`) and "six of the twelve"
until TASK-0083 added `no-bypass`. A count in a
docstring is the second-hand claim class TASK-0069 swept across four files.)

That is the whole point. A dropped boundary is invisible: TASK-0036
observed a role declaring read-only in OpenCode's syntax loading in Claude
Code with Write, Edit and Bash still in its tool pool, because the
`permission:` block was parsed as an unknown key and discarded without a
warning. A file that claims `deny` over an agent that can write is worse
than a file that refused to emit.
"""
import fnmatch
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
#
# Tools besides Bash that run a shell command in Claude Code 2.1.321 (its
# claude-code-tools declarations: `PowerShell.command`, `Monitor.command`).
# A role whose shell is shaped or denied has these withheld outright: the
# guard's allowlists name Bash commands only.
OTHER_SHELLS = ["PowerShell", "Monitor"]

# The seven terms ADR-0018 clause 8.3 refused for Claude Code, admitted by
# ADR-0062 through the role guard: configs/claude-code/hooks/
# role-guard.py, a PreToolUse hook keyed on `agent_type` that only the
# ai-toolbox-agents plugin carries. `"guard": True` means "enforced by the
# guard": emit_claude_code writes such a role only when told the guard ships
# beside it (`--with-guard`, which scripts/build-plugin.py passes); a plain
# emission (scripts/install.sh into ~/.claude/agents, where no guard runs)
# skips the role instead of shipping it unguarded.
GUARD = {"guard": True}
GUARD_SHELL = {"guard": True, "deny_tools": OTHER_SHELLS}

# The trial (Q10=A): out-of-allowlist calls are asked until this date and
# denied from it, two weeks from 2026-11-12, the day it landed. Recorded in ADR-0062; move it
# there and here together.
GUARD_DENY_FROM = "2026-11-26"

# Force-push forms the OpenCode map misses because the flag TRAILS
# (`git push origin x --force` matches only `git push*`). TASK-0276's
# session-wide permission rules deny them, but the plugin does not ship those
# rules, so the guard denies them itself for a `no-force-push` role. Guard
# only: OpenCode's emitted map is unchanged (the same hole there is a finding
# for a later task, not silently changed here).
GUARD_PUSH_DENY = ["git push*--force*", "git push* -f", "git push* -f *",
                   "git push* +*",
                   # M5: clustered short flags, -d, :branch (a delete), and a
                   # hard reset with its flag after the commit.
                   "git push* -*f", "git push* -*f *", "git push* -d", "git push* -d *",
                   "git push* :*", "git checkout* -f*", "git restore*", "git branch* -D*",
                   "git push*--mirror*", "git push*--delete*", "git reset*--hard*",
                   "git reset*--merge*", "git reset*--keep*", "git checkout*--force*",
                   "git branch*--force*"]
# The same terms as PARSED git options (second risk review, H-A/H-B/M-B). The
# guard tokenizes the command, unwraps `env`, `command`, `exec`, `nice`,
# `timeout`, `xargs`, `sh -c` and kin, expands short-flag clusters (`-an` is
# `-a -n`, `-uf` is `-u -f`) and denies a long option when it is the named
# option or ANY abbreviation of it (git takes a unique prefix, gitcli(7)), so
# `--amen`, `--no-verif`, `--mirr` and `--ha` are caught without one glob per
# prefix. "*" applies to every subcommand; `+`/`:` are push refspec arguments.
GUARD_GIT_OPTS_ALL = {"*": ["--output", "--output-directory", "--ext-diff", "--exec-path",
                            "--upload-pack", "--receive-pack", "--exec", "-o"],
                      "grep": ["--open-files-in-pager", "-O"]}
GUARD_GIT_OPTS_FORCE = {"push": ["--force", "-f", "--force-with-lease", "--force-if-includes",
                                 "--mirror", "--delete", "-d", "--prune", "+", ":"],
                        "reset": ["--hard", "--merge", "--keep"],
                        "checkout": ["--force", "-f"],
                        "switch": ["--force", "-f", "--discard-changes"],
                        "branch": ["--force", "-f", "-D", "-M", "-C"],
                        "commit": ["--amend"]}
GUARD_GIT_SUBS_FORCE = ["rebase", "filter-branch", "restore", "clean", "update-ref"]
GUARD_GIT_OPTS_BYPASS = {"commit": ["--no-verify", "-n", "--amend"],
                         "push": ["--no-verify"]}
GUARD_GIT_SUBS_ALL = ["config"]
# Tools every guarded role is denied in its agent file (review H4); the guard
# denies them too, and every MCP tool.
GUARD_WITHHELD = ["Workflow", "CronCreate", "CronDelete", "SendMessage", "EnterWorktree",
                  "ExitWorktree", "TaskStop", "RemoteTrigger", "SendFile", "ScheduleWakeup",
                  "Skill", "SendToProject", "PublishPlugin", "Artifact", "AppifactRepl",
                  "request_computer"]

# Risk review of TASK-0271 (H1, H3), guard only, as text globs: `git -*` is
# any option BEFORE the subcommand (`-c`, `-C <dir>`, `--git-dir`,
# `--exec-path`; `git -C . push --force` slipped past every `git push*` rule,
# M5). The option rules (`-o`, `--output`, `--ext-diff`, `-n`, `--amend`, ...)
# are parsed, not globbed: GUARD_GIT_OPTS_* above.
GUARD_GIT_DENY = ["git -*", "git config*", "git *core.*"]
GUARD_BYPASS_DENY = ["git commit* -n", "git commit* -n *", "git commit*--no-v*",
                     "git commit*--am*"]

VOCAB = {
    # `edit` is the key that actually gates writes: OpenCode documents it as
    # gating `write`, `edit` AND `apply_patch`. `write` is NOT a documented
    # permission key — it is emitted as belt-and-braces because the
    # long-standing agent-tiers roles carry it, OpenCode accepts it, and the
    # resolver keeps it. It is defence in depth against a future key rename,
    # not the operative rule. `edit: deny` is what enforces read-only;
    # removing `write` would change nothing, and removing `edit` would
    # silently unlock writing (verified in TASK-0045 against the live key
    # table).
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
    # The FIFTH term enforceable in both clients, and the reason it earns a
    # place rather than being a third OpenCode-only term: `read-only` binds
    # at the TOOL layer only, so a role declaring it can still write a file
    # through a shell. TASK-0063 shipped two such roles before TASK-0078
    # closed it.
    #
    # Claude Code's mapping is sound on evidence, not analogy: TASK-0056
    # observed `disallowedTools: Bash(git push *)` removing the ENTIRE Bash
    # tool against a control that retained it, so the unqualified form
    # certainly does.
    #
    # validate.sh rejects `no-bash` beside any term that shapes bash
    # (bash-allowlist, test-allowlist, no-force-push,
    # push-requires-confirmation) — denying everything and then shaping what
    # is denied is a contradiction, and emitted order would decide it.
    #
    # `PowerShell` and `Monitor` beside `Bash` (TASK-0271): the Claude Code
    # 2.1.321 tool declarations list both, each taking a shell `command`, so
    # withholding Bash alone left a Windows host a shell.
    "no-bash": {
        "opencode": [("bash", "deny")],
        "claude_code": {"deny_tools": ["Bash"] + OTHER_SHELLS},
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
        "claude_code": GUARD,
    },
    # The SECOND parameterised term: its permitted set comes from the role's
    # `bash_allow` list, so the emit path special-cases it like
    # `delegation-allowlist`. Marked here so the table stays the single index
    # of the vocabulary.
    #
    # Deny-first, never ask-first. An earlier version emitted {"*": "ask"},
    # which permits any command behind a prompt — for a role whose purpose is
    # "git operations only" that means a human could approve `rm -rf` at a
    # prompt the role was designed never to reach. A boundary that degrades
    # to a prompt is not the boundary that was declared.
    "bash-allowlist": {
        "opencode": "PARAMETERISED",
        "claude_code": GUARD_SHELL,
    },
    # The THIRD parameterised term (TASK-0071, closing B-021). Its permitted
    # set comes from `test_allow`, and it merges into the SAME `bash` map as
    # bash-allowlist rather than owning a key of its own — the two terms
    # describe one underlying mechanism, and qa-test carries both.
    #
    # Claude Code is None for the same structural reason bash-allowlist is:
    # naming commands is intra-Bash granularity, and tools/disallowedTools
    # gate whole tools. A Claude Code qa-test would ship with unrestricted
    # Bash, which is WIDER than the boundary its description implies, so
    # refusing is the only honest outcome (clause 8).
    "test-allowlist": {
        "opencode": "PARAMETERISED",
        "claude_code": GUARD_SHELL,
    },
    # "no-force-push" is shorthand: it denies the whole family of git
    # operations that destroy work rather than adding to it. `git clean -f`
    # belongs here even though it pushes nothing — it deletes untracked
    # files irrecoverably, and it was missing from an earlier version of this
    # list, which left it ALLOWED via a `git *` allowlist entry (caught in
    # TASK-0045 by diffing emitted output against the reference role).
    "no-force-push": {
        "opencode": [("bash", {
            "git push --force*": "deny",
            "git push --force-with-lease*": "deny",
            "git push -f*": "deny",
            "git reset --hard*": "deny",
            "git rebase*": "deny",
            "git filter-branch*": "deny",
            "git clean -f*": "deny",
            # `--amend` reached by a TRAILING flag. `git commit --amend -m x`
            # already fell through to "*": deny for want of a matching allow,
            # but `git commit -m x --amend` slipped past `git commit -m *` and
            # was OBSERVED rewriting a commit (TASK-0082, opencode 1.18.31).
            # This pattern is longer than that allow, so last-match-wins gives
            # deny -- the ordering property TASK-0045 lost a boundary to.
            "git commit*--amend*": "deny",
        })],
        "claude_code": GUARD_SHELL,
    },
    # THIRTEENTH term. Denies defeating a repo control while using a
    # PERMITTED command form -- which is a different failure from destroying
    # work, and is why these are not folded into no-force-push (TASK-0083,
    # human decision). A role can need one boundary and not the other.
    #
    # Both were OBSERVED escaping, not computed (TASK-0082):
    #   - `git commit -m x --no-verify` passed the permission layer, skipping
    #     the mandatory commit gate AGENTS.md forbids bypassing.
    #   - `git add -- .` ran and staged 17 paths including two directories,
    #     straight through the `git add -- *` pattern meant to prevent bulk
    #     staging.
    #
    # ORDERING IS SEMANTIC HERE. A deny beats an allow only if it is LONGER,
    # because the emitter writes "*" first then shortest-to-longest and
    # OpenCode resolves last-match-wins. `git add -- .` is the same length as
    # `git add -- *`, so it is NOT safe to assume; TASK-0083 verified the
    # resolution against the client rather than reasoning about the tiebreak.
    # WHAT IS NOT HERE, AND WHY -- `git add -- .` (TASK-0083).
    # It was added as a deny and REMOVED after verification, because it did
    # not fire. Observed against opencode 1.18.31: with `"git add -- .":
    # deny` emitted AFTER `"git add -- *": allow`, `git add -- .` was still
    # ALLOWED and staged the tree.
    #
    # The two denies that DO fire are longer than the allow they must beat
    # (`git commit*--amend*` is 20 against `git commit -m *` at 15). The
    # bulk-stage one is exactly as long as `git add -- *` -- 12 each -- and an
    # equal-length deny did not win despite being emitted later. Any pattern
    # long enough to win (`git add -- .*`, 13) also matches legitimate dotfile
    # paths such as `git add -- .ai/tasks/x.md`, which is most of what these
    # roles commit in THIS repo.
    #
    # So it is left to the roles' bodies and recorded as a stated limitation.
    # A deny that does not fire is worse than no deny: a reader of the emitted
    # map would believe the boundary holds. That is the false-boundary defect
    # class this sprint found four times.
    "no-bypass": {
        "opencode": [("bash", {
            "git commit*--no-verify*": "deny",
        })],
        "claude_code": GUARD_SHELL,
    },
    "push-requires-confirmation": {
        "opencode": [("bash", {"git push*": "ask"})],
        "claude_code": GUARD_SHELL,
    },
    "webfetch-requires-confirmation": {
        "opencode": [("webfetch", "ask")],
        "claude_code": GUARD,
    },
}

# --- Codex (TASK-0280, ADR-0065) -------------------------------------------
# A Codex custom agent (`.codex/agents/<role>.toml`) can switch features off
# and nothing more: its sandbox, approval policy, MCP servers and command
# rules are the parent session's ("don't override the parent", Codex's
# subagent docs, read 2026-11-12), and its PreToolUse hook input carries no
# agent identity, so no hook can stand in the way the role guard does in
# Claude Code. A term not listed here is one Codex cannot enforce per agent,
# and a role carrying it is refused for Codex, never degraded (ADR-0018
# clause 8). Today that is every role: each carries read-only or
# no-delegation. ADR-0065 puts the alternative (instruction-only roles,
# best-effort) to the human.
CODEX = {
    "no-bash": {"features": {"shell_tool": False}},
}
CODEX_WHY = ("a Codex agent file only switches features off; its sandbox, approval "
             "policy and command rules are the parent session's (ADR-0065)")

CLIENT_KEYS = {"claude-code": "claude_code", "opencode": "opencode", "codex": "codex"}
# The file each client loads an agent from: <target>/<role><ext>.
EXT = {"claude-code": ".md", "opencode": ".md", "codex": ".toml"}


class Refused(Exception):
    """Emission refused: a declared term the target cannot enforce."""


class NeedsGuard(Refused):
    """A role whose terms only the role guard enforces, emitted without it."""


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
        if term in ("bash-allowlist", "test-allowlist"):
            # Same deny-first shape, merged rather than assigned: a role can
            # carry bash-allowlist AND test-allowlist AND no-force-push AND
            # push-requires-confirmation, all of which write `bash` keys.
            # qa-test is the first role to hold two of these allowlists at
            # once, and they must land in ONE map — assigning would make the
            # second term silently discard the first.
            term_key = "bash_allow" if term == "bash-allowlist" else "test_allow"
            merged = perms.get("bash")
            if not isinstance(merged, dict):
                merged = {}
            merged["*"] = "deny"
            for pattern in fm.get(term_key, []):
                merged[pattern] = "allow"
            perms["bash"] = merged
            continue
        if VOCAB[term]["opencode"] is None:
            raise Refused("role '%s' declares '%s', which OpenCode cannot enforce "
                          "per agent" % (role, term))
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
                # OpenCode resolves LAST MATCH WINS, so emission order is
                # semantic, not cosmetic. Two rules follow:
                #
                #   1. "*" first, or the blanket rule would override every
                #      specific one and the role would permit (or deny)
                #      everything.
                #   2. SHORTER patterns before longer ones. A longer pattern
                #      is the more specific rule, so it must come later to
                #      win.
                #
                # Rule 2 was a real defect caught in TASK-0045: plain
                # alphabetical order put `git push*: ask` AFTER
                # `git push --force*: deny`, so a force-push resolved to
                # *ask* instead of *deny* — silently weakening the one
                # boundary `git-ops` exists to enforce. Length first, then
                # alphabetical for a stable diff.
                for glob in sorted(v, key=lambda g: (g != "*", len(g), g)):
                    out.append("    \"%s\": %s" % (glob, v[glob]))
            else:
                out.append("  %s: %s" % (key, v))
    out += ["---", "", body, ""]
    allowed = [p for term, key in (("bash-allowlist", "bash_allow"),
                                   ("test-allowlist", "test_allow"))
               if term in fm["capabilities"] for p in fm.get(key, [])]
    if allowed:
        out += allowlist_note(allowed)
    return "\n".join(out)


def allowlist_note(patterns):
    """The body section naming a role's allowed shell commands (B-034).

    GENERATED, never hand-written into agents/: the patterns' one owner is
    the role's frontmatter, and a copy in the body would drift from it.
    TASK-0092 finding 16: every role kept reaching for denied utilities, each
    a wasted round. Finding 12: OpenCode 1.18.31 denied `git add -- .ai/x`
    and allowed `git add -- ".ai/x"` — quoting removes a denial of a
    legitimate command and opens nothing, because the bulk-stage forms pass
    either way (finding 18) and the driver checks a commit's paths.
    """
    # Named only if no pattern allows it, so the sentence cannot contradict
    # the list above it.
    denied = [u for u in ("cat", "ls", "grep", "sed", "find", "echo")
              if not any(fnmatch.fnmatch(u + " x", p) for p in patterns)]
    return ["## Shell commands you may run", "",
            "*Generated by `scripts/emit-agents.py` from this role's allowlist "
            "(`TASK-0102`); the `permission` block above is what enforces it.*", "",
            "Every shell command that does not match one of these is **denied**:", ""
            ] + ["- `%s`" % p for p in patterns] + [""] + ([
            "So do not reach for %s: each is denied and costs a round. Read files with "
            "your read tool." % ", ".join("`%s`" % u for u in denied), ""] if denied else []) + [
            "**Run one command per call** — no `;`, `&&`, `||`, `|` or commands on "
            "separate lines in one call, and no `echo` between them as a label. OpenCode "
            "checks every part of a compound command and denies the whole call if one part "
            "is not listed (`TASK-0209`: `echo \"---NAME-ONLY---\"; git diff --name-only` "
            "was denied, so the diff never reached the adjudicator).", "",
            "**Write path arguments in double quotes** — `git add -- \".ai/tasks/x.md\"`. "
            "OpenCode 1.18.31 was observed denying the unquoted form of a path starting "
            "with a dot and allowing the quoted one (`TASK-0092` finding 12).", ""]


def _table(old_name, new_name):
    """Where a role table lives: ADR-0066's docs/development/ once the repo
    has the numbered layout (`.ai/00.CONVENTIONS.md` exists), else the old
    `.ai/context/`. Detected by what exists, never by a flag."""
    if os.path.isfile(os.path.join(".ai", "00.CONVENTIONS.md")):
        return os.path.join("docs", "development", new_name)
    return os.path.join(".ai", "context", old_name)


TIER_TABLE = _table("model-tiers.md", "model-tiers.md")


def model_alias(role):
    """The Claude Code `model` value for `role`: its table tier, else `inherit`.

    Reads the rows of TIER_TABLE, .ai/context/model-tiers.md or, in the
    ADR-0066 layout, docs/development/model-tiers.md (`| opus | a, b |`).
    ADR-0059.
    """
    try:
        with open(TIER_TABLE, encoding="utf-8") as fh:
            lines = fh.read().split("\n")
    except OSError:
        return "inherit"
    for line in lines:
        m = re.match(r"^\|\s*(opus|sonnet|haiku)\s*\|(.*)\|\s*$", line)
        if m and role in [r.strip() for r in m.group(2).split(",")]:
            return m.group(1)
    return "inherit"


TURN_TABLE = _table("turn-limits.md", "turn-limits.md")
COMPACT_RANGE = (100000, 1000000)


def turn_limits(role):
    """[(key, value)] for `role` from .ai/context/turn-limits.md (TASK-0282).

    Rows read `| role | maxTurns | autoCompactWindow |`; `-` omits a key. A
    malformed value fails loudly rather than emitting a key Claude Code would
    ignore (an out-of-range autoCompactWindow is dropped silently by it).
    """
    try:
        with open(TURN_TABLE, encoding="utf-8") as fh:
            lines = fh.read().split("\n")
    except OSError:
        return []
    for line in lines:
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) != 3 or cells[0] != role:
            continue
        out = []
        turns, window = cells[1], cells[2]
        if turns != "-":
            if not re.fullmatch(r"[1-9][0-9]*", turns):
                raise ValueError("%s: maxTurns %r for %s is not a positive integer"
                                 % (TURN_TABLE, turns, role))
            out.append(("maxTurns", turns))
        if window != "-":
            if (not re.fullmatch(r"[1-9][0-9]*", window)
                    or not COMPACT_RANGE[0] <= int(window) <= COMPACT_RANGE[1]):
                raise ValueError("%s: autoCompactWindow %r for %s is not an integer "
                                 "from %d to %d" % ((TURN_TABLE, window, role) + COMPACT_RANGE))
            out.append(("autoCompactWindow", window))
        return out
    return []


def emit_claude_code(role, fm, body, guarded=False):
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
        if spec.get("guard") and not guarded:
            raise NeedsGuard(
                "role '%s' declares '%s', which only the role guard enforces "
                "in Claude Code (ADR-0062); it ships in the ai-toolbox-agents "
                "plugin, not in a plain emission" % (role, term))
        deny += spec.get("deny_tools", [])
        if spec.get("guard"):
            deny += GUARD_WITHHELD
        for k, v in spec.items():
            if k not in ("deny_tools", "partial", "guard"):
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
    out.append("model: %s" % model_alias(role))
    out += ["%s: %s" % kv for kv in turn_limits(role)]
    out += ["---", "", body, ""]
    return "\n".join(out)


def toml_string(s):
    """A TOML basic string. JSON's escapes are TOML's for the characters JSON
    escapes (quote, backslash, controls); non-ASCII is written as itself, since
    JSON's surrogate-pair escapes are not valid TOML."""
    import json
    return json.dumps(s, ensure_ascii=False)


def emit_codex(role, fm, body):
    features = {}
    for term in fm["capabilities"]:
        spec = CODEX.get(term)
        if spec is None:
            raise Refused("role '%s' declares '%s', which Codex cannot enforce per "
                          "agent: %s" % (role, term, CODEX_WHY))
        features.update(spec.get("features", {}))
    out = ["# Generated by scripts/emit-agents.py from agents/%s/agent.md "
           "(ADR-0065); edit that file, never this one." % role,
           "name = %s" % toml_string(role),
           "description = %s" % toml_string(fm["description"]),
           "developer_instructions = %s" % toml_string(body + "\n")]
    if features:
        out += ["", "[features]"] + ["%s = %s" % (k, "true" if v else "false")
                                     for k, v in sorted(features.items())]
    return "\n".join(out) + "\n"


def term_cell(term, client):
    """How `client` expresses `term`, for the parity matrix."""
    if client == "codex":
        spec = CODEX.get(term)
        if spec is None:
            return "refused"
        return ", ".join("features.%s = %s" % (k, str(v).lower())
                         for k, v in sorted(spec.get("features", {}).items()))
    spec = VOCAB[term][CLIENT_KEYS[client]]
    if spec == "PARAMETERISED":
        if client == "claude-code":
            return ("tools: Agent(<delegates_to>)" if term == "delegation-allowlist"
                    else "role guard; withholds %s" % ", ".join(OTHER_SHELLS))
        return {"delegation-allowlist": "task: deny-first map",
                "bash-allowlist": "bash: deny-first map",
                "test-allowlist": "bash: deny-first map"}[term]
    if spec is None:
        return "refused"
    if client == "opencode":
        return ", ".join("%s: %s" % (k, v if isinstance(v, str) else "%d glob%s" % (len(v), "" if len(v) == 1 else "s"))
                         for k, v in spec)
    parts = []
    if spec.get("guard"):
        parts.append("role guard")
    if spec.get("deny_tools"):
        parts.append("withholds " + ", ".join(spec["deny_tools"]))
    if spec.get("isolation"):
        parts.append("isolation: %s%s" % (spec["isolation"], " (partial)" if spec.get("partial") else ""))
    return "; ".join(parts)


def role_cell(role, fm, body, client):
    """Whether `role` reaches `client`, for the parity matrix: what main() does."""
    try:
        if client == "claude-code":
            emit_claude_code(role, fm, body, guarded=False)
        else:
            EMITTERS[client](role, fm, body)
        state = "emitted"
    except NeedsGuard:
        state = "plugin only (role guard)"
    except Refused:
        bad = [t for t in fm["capabilities"]
               if (CODEX.get(t) is None if client == "codex"
                   else VOCAB[t][CLIENT_KEYS[client]] is None)]
        state = "refused: " + ", ".join(bad)
    if client not in fm.get("clients", []):
        return "not declared; would be " + state
    return state


def parity_markdown():
    """The port parity matrix in docs/registry.md (ADR-0065)."""
    clients = ["claude-code", "opencode", "codex"]
    out = ["Generated by `scripts/emit-agents.py --parity` (ADR-0065): Claude Code is the "
           "reference profile; each port maps a term or refuses the role. Bionic and LM "
           "Studio take no agents (best-effort, untested; ADR-0018 clause 6).", "",
           "| Term | Claude Code | OpenCode | Codex |", "|------|-------------|----------|-------|"]
    for term in VOCAB:
        out.append("| %s | %s |" % (term, " | ".join(term_cell(term, c) for c in clients)))
    out += ["", "| Role | Claude Code | OpenCode | Codex |", "|------|-------------|----------|-------|"]
    for role in known_roles():
        fm, body = parse(os.path.join("agents", role, "agent.md"))
        out.append("| %s | %s |" % (role, " | ".join(role_cell(role, fm, body, c) for c in clients)))
    return "\n".join(out) + "\n"


def guard_spec(fm):
    """The role guard's rules for one role, or None when it declares no term
    only the guard enforces. Read from the same VOCAB rows and frontmatter
    lists emit_opencode reads, so the two clients cannot drift apart.

    bash:     allow (bash_allow + test_allow), deny and ask patterns, and
              `allowlist`: whether an unmatched command is out of the
              allowlist (asked during the trial, denied after) or passed on.
    edit:     the path globs Edit, Write and NotebookEdit may touch.
    webfetch: "ask" when every fetch needs a person's confirmation.
    """
    caps = fm.get("capabilities", [])
    if not any((VOCAB[t]["claude_code"] or {}).get("guard") for t in caps
               if isinstance(VOCAB[t]["claude_code"], dict)):
        return None
    spec = {}
    if any(t in caps for t in ("bash-allowlist", "test-allowlist", "no-force-push",
                               "no-bypass", "push-requires-confirmation")):
        bash = {"allowlist": False, "allow": [], "deny": [], "ask": []}
        for term, key in (("bash-allowlist", "bash_allow"), ("test-allowlist", "test_allow")):
            if term in caps:
                bash["allowlist"] = True
                bash["allow"] += [p for p in fm.get(key, []) if p not in bash["allow"]]
        for term in ("no-force-push", "no-bypass", "push-requires-confirmation"):
            if term in caps:
                for key, value in VOCAB[term]["opencode"]:
                    for glob, action in value.items():
                        bash[action].append(glob)
        if "no-force-push" in caps:
            bash["deny"] += GUARD_PUSH_DENY
        if "no-bypass" in caps:
            bash["deny"] += GUARD_BYPASS_DENY
        bash["deny"] += GUARD_GIT_DENY
        opts = {k: list(v) for k, v in GUARD_GIT_OPTS_ALL.items()}
        subs = list(GUARD_GIT_SUBS_ALL)
        for term, table, whole in (("no-force-push", GUARD_GIT_OPTS_FORCE, GUARD_GIT_SUBS_FORCE),
                                   ("no-bypass", GUARD_GIT_OPTS_BYPASS, [])):
            if term in caps:
                for sub, names in table.items():
                    opts.setdefault(sub, [])
                    opts[sub] += [n for n in names if n not in opts[sub]]
                subs += [w for w in whole if w not in subs]
        bash["git"] = {"options": opts, "subcommands": subs}
        spec["bash"] = bash
    if "test-files-only" in caps:
        (_, globs), = VOCAB["test-files-only"]["opencode"]
        spec["edit"] = sorted(g for g, a in globs.items() if a == "allow")
    if "webfetch-requires-confirmation" in caps:
        spec["webfetch"] = "ask"
    return spec


def guard_config():
    """role-guard.json: the rules for every role emitted for claude-code."""
    roles = {}
    for role in known_roles():
        fm, _ = parse(os.path.join("agents", role, "agent.md"))
        if "claude-code" not in fm.get("clients", []):
            continue
        spec = guard_spec(fm)
        if spec is not None:
            roles[role] = spec
    return {"generated_by": "scripts/emit-agents.py (ADR-0062)",
            "deny_from": GUARD_DENY_FROM,
            "plugin": "ai-toolbox-agents",
            "roles": roles}


EMITTERS = {"opencode": emit_opencode, "claude-code": emit_claude_code, "codex": emit_codex}


def emitted_by_us(path, role, client=None, fm=None, body=None):
    """True only for a file this emitter would have written for `role`.

    ADR-0026, the human's decision of 2026-09-24: a role that stops declaring
    a client has its old emission pruned from that client, so a session
    cannot keep loading a role the repo no longer emits for it. Deliberately
    narrow — a regular file (never a symlink), whose frontmatter names this
    role. Anything else in the directory is not ours to delete. Two limits,
    stated: a REFUSED role's existing file is left in place, and a role
    DELETED from agents/ is never pruned, because its name is no longer
    known here.

    An OpenCode emission has no `name:` (OpenCode names an agent by its
    file), so the frontmatter test alone never matched one: ADR-0026's prune
    silently did nothing on OpenCode until TASK-0164 found it. A file without
    `name:` is ours only if it is exactly what this emitter writes for the
    role today; a role edited since is left, and the caller says so.
    """
    if os.path.islink(path) or not os.path.isfile(path):
        return False
    try:
        with open(path, encoding="utf-8") as fh:
            text = fh.read(1 << 20)
    except (OSError, UnicodeDecodeError):
        return False
    lines = text.split("\n")
    if path.endswith(".toml"):
        # A Codex emission: the header comment and a `name = "<role>"` line.
        return (bool(lines) and lines[0].startswith("# Generated by scripts/emit-agents.py")
                and ('name = "%s"' % role) in lines[:3])
    if not lines or lines[0].strip() != "---":
        return False
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if line.startswith("name:"):
            return line.split(":", 1)[1].strip().strip("\"'") == role
    if client is None or fm is None:
        return False
    try:
        return text == EMITTERS[client](role, fm, body)
    except Exception:  # a refusal, or anything else: not provably ours
        return False


def known_roles():
    """Every role in agents/, with the same skip as the registry generator."""
    if not os.path.isdir("agents"):
        return []
    return [r for r in sorted(os.listdir("agents"))
            if not r.startswith("_template")
            and os.path.isfile(os.path.join("agents", r, "agent.md"))]


def main():
    # --only ROLE,... (TASK-0164): emit only these roles. An empty list means
    # none. Absent means every role, as before.
    #
    # --with-guard (TASK-0271): the role guard ships beside these files, so a
    # role whose terms only the guard enforces is emitted. scripts/
    # build-plugin.py passes it for the ai-toolbox-agents plugin, which
    # carries the guard; scripts/install.sh does not, so such a role is
    # skipped there (and a stale copy of it pruned) rather than run unguarded.
    #
    # --guard-json=PATH: write role-guard.json, the guard's rules, and stop.
    args, only, guarded = sys.argv[1:], None, False
    if args == ["--parity"]:
        # Bytes, so a Windows Python writes LF like every other generated file.
        sys.stdout.flush()
        sys.stdout.buffer.write(parity_markdown().encode("utf-8"))
        return 0
    for a in list(args):
        if a.startswith("--guard-json="):
            path = a[len("--guard-json="):]
            import json
            with open(path, "w", encoding="utf-8", newline="\n") as fh:
                json.dump(guard_config(), fh, indent=2, sort_keys=True)
                fh.write("\n")
            return 0
        if a == "--with-guard":
            guarded = True
            args.remove(a)
    if len(args) == 3 and args[2].startswith("--only="):
        only = {r for r in args[2][len("--only="):].split(",") if r}
        args = args[:2]
    if len(args) != 2:
        print("usage: emit-agents.py <client> <agents-target-dir> "
              "[--only=ROLE,...] [--with-guard] | --guard-json=PATH | --parity",
              file=sys.stderr)
        return 2
    client, target = args
    if client not in CLIENT_KEYS:
        print("unknown client: %s" % client, file=sys.stderr)
        return 2

    roles = known_roles()
    if only is not None and only - set(roles):
        print("unknown role(s) in --only: %s" % ", ".join(sorted(only - set(roles))),
              file=sys.stderr)
        return 2
    rc = 0
    for role in roles:
        src = os.path.join("agents", role, "agent.md")
        stale = os.path.join(target, "%s%s" % (role, EXT[client]))
        fm, body = parse(src)
        # A deselected role leaves the client, under the same guard as a role
        # that stopped declaring it (ADR-0026, amended by TASK-0164).
        if only is not None and role not in only:
            if emitted_by_us(stale, role, client, fm, body):
                os.remove(stale)
                print("  agent pruned: %s -> %s (%s; not selected, ADR-0026)"
                      % (role, client, stale))
            elif os.path.lexists(stale):
                print("  agent left: %s -> %s (%s is not provably this repo's "
                      "emission; remove it by hand if it is)" % (role, client, stale))
            continue
        if client not in fm.get("clients", []):
            if emitted_by_us(stale, role, client, fm, body):
                os.remove(stale)
                print("  agent pruned: %s -> %s (%s; the role no longer "
                      "declares this client, ADR-0026)" % (role, client, stale))
            else:
                print("  agent skipped: %s -> %s (not in its clients list)"
                      % (role, client))
            continue
        try:
            if client == "claude-code":
                text = emit_claude_code(role, fm, body, guarded=guarded)
            else:
                text = EMITTERS[client](role, fm, body)
        except NeedsGuard as e:
            if emitted_by_us(stale, role):
                os.remove(stale)
                print("  agent pruned: %s -> %s (%s; it needs the role guard)"
                      % (role, client, stale))
            print("  agent skipped: %s -> %s (%s)" % (role, client, e))
            continue
        except Refused as e:
            print("  EMISSION REFUSED: %s" % e, file=sys.stderr)
            rc = 1
            continue
        os.makedirs(target, exist_ok=True)
        dest = os.path.join(target, "%s%s" % (role, EXT[client]))
        with open(dest, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        print("  agent emitted: %s -> %s (%s)" % (role, client, dest))
    return rc


if __name__ == "__main__":
    sys.exit(main())
