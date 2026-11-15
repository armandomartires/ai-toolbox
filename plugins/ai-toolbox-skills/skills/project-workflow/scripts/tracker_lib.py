#!/usr/bin/env python3
"""Read, check and declare a project's work tracker: files, gitlab or github.

Driven by tracker.sh; see that file for usage. Standard library only.

WHY THIS EXISTS (TASK-0171, ADR-0037 in ai-toolbox). A project tracks its work
either in the `.ai/` layer this skill scaffolds (`files`), or on its forge:
GitLab issues, milestones, boards and wiki, or GitHub's. The choice is asked
once, at scaffolding, and declared in a tracked `tracker.conf` at the
repository root. Everything that only makes sense for `files` - the delivery
dashboard, its publishing pipelines - reads the declaration through `mode()`.

A MISSING tracker.conf MEANS `files`. Every project governed before the
question existed tracks its work in files, so absence has exactly one meaning
and there is no "not yet asked" state to report. Scaffolding writes the file
explicitly, so a new project's answer is visible.

WHAT `check` PROVES: that the declaration parses and names one tracker, with
the project path that tracker needs.
WHAT IT DOES NOT PROVE: that the forge project exists, that anyone can reach
it, or that its issues follow templates/reference/tracker.md. Nothing here
calls the network; `export` (forge_export.py) is the one subcommand that
reads a forge, through `glab` or `gh`.

CHANGING THE DECLARATION (S019.T001, ADR-0067 in ai-toolbox). `init` never
overwrites. `init --replace --adr ADR-NNNN` does, and only when that ADR is a
file in the repository's `.ai/decisions/`: changing the tracker is a
decision, so the rewrite names the decision that made it.
"""
import argparse
import datetime
import os
import re
import sys

CONF = "tracker.conf"
TRACKERS = ("files", "gitlab", "github")
# key -> the tracker it belongs to. It is required for that tracker and
# refused for every other, so a conf cannot name two forges at once.
PATH_KEYS = {"gitlab": "gitlab_project", "github": "github_repo"}
KEYS = ("tracker",) + tuple(PATH_KEYS.values())
# A project path, never a host: tracked files must not name a private host
# (ai-toolbox's check-private-names.sh), and the path alone is enough for
# `glab`/`gh`, which read the host from their own configuration.
SEGMENT = r"[A-Za-z0-9][A-Za-z0-9._-]*"
PATHS = {
    "gitlab": re.compile(r"^%s(/%s)+$" % (SEGMENT, SEGMENT)),   # nested groups
    "github": re.compile(r"^%s/%s$" % (SEGMENT, SEGMENT)),      # owner/name
}
SHAPES = {"gitlab": "group/name (subgroups allowed)", "github": "owner/name"}


class Refusal(Exception):
    """A condition the user must fix; exit 2 with the message."""


def say(msg):
    print("tracker.sh: %s" % msg, file=sys.stderr)


def _publish():
    # Imported lazily: publish_lib imports this module to ask mode(), and the
    # git and remote helpers have one owner, which is publish_lib.
    import publish_lib
    return publish_lib


def read_text(path):
    with open(path, encoding="utf-8", newline="") as fh:
        # A Windows checkout with core.autocrlf rewrites line endings; that is
        # not a different declaration.
        return fh.read().replace("\r\n", "\n")


def validate(conf, where):
    tracker = conf.get("tracker")
    if not tracker:
        raise Refusal("%s: `tracker` is required: one of %s"
                      % (where, " | ".join(TRACKERS)))
    if tracker not in TRACKERS:
        raise Refusal("%s: tracker=%r; known: %s"
                      % (where, tracker, " | ".join(TRACKERS)))
    for forge, key in PATH_KEYS.items():
        if forge != tracker and key in conf:
            raise Refusal("%s: %s belongs to tracker = %s, not %s - remove it"
                          % (where, key, forge, tracker))
    key = PATH_KEYS.get(tracker)
    if key:
        value = conf.get(key, "")
        if not value:
            raise Refusal("%s: tracker = %s needs %s = %s"
                          % (where, tracker, key, SHAPES[tracker]))
        if "://" in value or "@" in value or ":" in value:
            raise Refusal("%s: %s=%r: names only - the project path, never a "
                          "host or URL" % (where, key, value))
        if not PATHS[tracker].match(value):
            raise Refusal("%s: %s=%r is not %s"
                          % (where, key, value, SHAPES[tracker]))
    return conf


def load(repo):
    """The parsed declaration, or None when there is no tracker.conf."""
    path = os.path.join(repo, CONF)
    if not os.path.isfile(path):
        return None
    conf = {}
    for n, raw in enumerate(read_text(path).split("\n"), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise Refusal("%s:%d: expected `key = value`, got %r" % (CONF, n, raw))
        key, value = (part.strip() for part in line.split("=", 1))
        if key not in KEYS:
            raise Refusal("%s:%d: unknown key %r. Known: %s"
                          % (CONF, n, key, ", ".join(KEYS)))
        if key in conf:
            raise Refusal("%s:%d: %r is set twice" % (CONF, n, key))
        conf[key] = value
    return validate(conf, CONF)


def mode(repo):
    """(tracker, project path or None). Absent conf is ("files", None)."""
    conf = load(repo)
    if conf is None:
        return "files", None
    tracker = conf["tracker"]
    return tracker, conf.get(PATH_KEYS.get(tracker, ""))


def describe(tracker, path):
    return tracker if path is None else "%s %s" % (tracker, path)


def render(conf, adr=None):
    tracker = conf["tracker"]
    lines = [
        "# Work tracker for this project: files | gitlab | github (ADR-0037 in",
        "# ai-toolbox; skills/project-workflow/templates/reference/tracker.md).",
        "# Written by tracker.sh init on %s. Changing it is a decision: record"
        % datetime.date.today().isoformat(),
        "# an ADR. Absent, this file means files.",
    ]
    if adr:
        lines.append("# Changed by %s." % adr)
    lines.append("tracker = %s" % tracker)
    key = PATH_KEYS.get(tracker)
    if key:
        lines.append("%s = %s" % (key, conf[key]))
    return "\n".join(lines) + "\n"


def cmd_check(repo):
    print(describe(*mode(repo)))
    return 0


def cmd_decision(repo):
    pub = _publish()
    out = pub.git(repo, "remote")
    forges = set()
    for name in (out or "").split():
        host = pub.remote_host(pub.git(repo, "remote", "get-url", name) or "")
        forge = pub.forge_of(host) if host != "(local)" else "none"
        forges.add(forge)
        print("remote   %s %s %s" % (name, host, forge))
    declared = load(repo)
    tracker, path = mode(repo)
    if declared is None:
        print("tracker  files (default: no %s)" % CONF)
    elif tracker == "files":
        print("tracker  files (declared)")
    else:
        print("tracker  %s" % describe(tracker, path))
        # A hint, never a refusal: a self-hosted GitLab is `unknown`, and a
        # project may track work on a forge it does not push to.
        if not forges & {tracker, "unknown"}:
            print("NOTE     no %s remote; confirm %s is this project's"
                  % (tracker, path))
    return 0


def adr_file(repo, adr):
    """The ADR's path under .ai/decisions/, or a Refusal."""
    if not re.match(r"^ADR-\d{4}$", adr or ""):
        raise Refusal("--adr takes an id such as ADR-0067, got %r" % adr)
    decisions = os.path.join(repo, ".ai", "decisions")
    found = sorted(f for f in (os.listdir(decisions) if os.path.isdir(decisions) else [])
                   if f.startswith(adr + "-") and f.endswith(".md"))
    if not found:
        raise Refusal("%s is not in .ai/decisions/: record the decision to change "
                      "the tracker first, then pass its id" % adr)
    return ".ai/decisions/" + found[0]


def cmd_init(repo, tracker, gitlab_project, github_repo, replace=False, adr=None):
    want = {"tracker": tracker}
    if gitlab_project is not None:
        want["gitlab_project"] = gitlab_project
    if github_repo is not None:
        want["github_repo"] = github_repo
    validate(want, "init")
    if adr is not None and not replace:
        raise Refusal("--adr goes with --replace")
    if not os.path.isdir(repo):
        raise Refusal("%s is not a directory" % repo)
    have = load(repo)
    if have is not None:
        if have == want:
            print("init: nothing to change (%s already declares %s)"
                  % (CONF, describe(*mode(repo))))
            return 0
        if not replace:
            raise Refusal("%s already declares %s; init never overwrites. Record "
                          "an ADR, then pass --replace --adr ADR-NNNN"
                          % (CONF, describe(*mode(repo))))
    if replace and have is None:
        raise Refusal("--replace: there is no %s to replace; run init without it"
                      % CONF)
    if replace:
        where = adr_file(repo, adr)
        before = describe(*mode(repo))
    with open(os.path.join(repo, CONF), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(render(want, adr if replace else None))
    if replace:
        print("init: %s replaced (%s -> %s, %s)"
              % (CONF, before, describe(*mode(repo)), where))
    else:
        print("init: %s written (%s)" % (CONF, describe(*mode(repo))))
    if tracker != "files":
        print("next: follow templates/reference/tracker.md - labels, the first "
              "milestone and the first issue are created on the forge")
    return 0


def cmd_export(repo, out, state):
    # Imported lazily: only export reads a forge, and the module owns how.
    import forge_export
    tracker, path = mode(repo)
    try:
        return forge_export.export(repo, tracker, path, os.path.abspath(out), state)
    except forge_export.Refusal as exc:
        raise Refusal(str(exc))


def parser():
    p = argparse.ArgumentParser(prog="tracker.sh", add_help=True)
    sub = p.add_subparsers(dest="cmd")
    for name in ("check", "decision", "init", "export"):
        s = sub.add_parser(name)
        s.add_argument("--repo")
        if name == "init":
            s.add_argument("--tracker", required=True, choices=TRACKERS)
            s.add_argument("--gitlab-project")
            s.add_argument("--github-repo")
            s.add_argument("--replace", action="store_true")
            s.add_argument("--adr")
        if name == "export":
            s.add_argument("--out", required=True)
            s.add_argument("--state", choices=("open", "all"), default="open")
    return p


def main(argv):
    args = parser().parse_args(argv)
    if not args.cmd:
        say("expected a subcommand: check | decision | init | export (see --help)")
        return 2
    repo = args.repo
    if repo is None:
        repo = _publish().git(os.getcwd(), "rev-parse", "--show-toplevel") \
            or os.getcwd()
    repo = os.path.abspath(repo)
    try:
        if args.cmd == "check":
            return cmd_check(repo)
        if args.cmd == "decision":
            return cmd_decision(repo)
        if args.cmd == "export":
            return cmd_export(repo, args.out, args.state)
        return cmd_init(repo, args.tracker, args.gitlab_project, args.github_repo,
                        args.replace, args.adr)
    except Refusal as exc:
        say(str(exc))
        return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
