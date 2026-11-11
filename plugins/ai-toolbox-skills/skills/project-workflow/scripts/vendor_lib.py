#!/usr/bin/env python3
"""Vendor this skill into a project, and prove a vendored copy is unedited.

Driven by vendor-skill.sh; see that file for usage. Standard library only.

WHY THIS EXISTS (TASK-0161). A project that publishes its dashboard needs a
copy of this skill INSIDE its repository, because a CI runner clones the
repository and nothing else (publish_lib.check_skill_dir, ai-toolbox
ADR-0029). That copy used to be made by hand. The first one, in
asset-management, carried its own home-made manifest and fell behind the
skill the day after it was taken. A copy nobody can compare is a copy nobody
updates.

So a vendored copy carries VENDORED.md: the source commit, the skill version
and a sha256 for every file. It is written only by `--write`, compared with
the source by `--check`, and checked against itself by `--verify`, which is
the one a consuming project's gate runs: it needs nothing but the copy.

WHAT `--verify` PROVES: every file the manifest lists is present and
unedited, and no file was added beside them.
WHAT IT DOES NOT PROVE: that the copy is current. Only `--check`, run from a
source checkout, can say that.

Hashes are taken over LF line endings. A Windows checkout with core.autocrlf
rewrites them in the working tree; that is not an edit.
"""
import datetime
import hashlib
import os
import re
import subprocess
import sys

# realpath, not abspath: run through an installed link (install.sh makes
# ~/.claude/skills/<name> a link to the checkout), the path must still be
# the one git knows, or every path relative to the toplevel is wrong.
HERE = os.path.dirname(os.path.realpath(__file__))
SKILL = os.path.dirname(HERE)
NAME = os.path.basename(SKILL)

MANIFEST = "VENDORED.md"
CONF = "dashboard-publish.conf"
# What a consuming project runs: the CI pipeline (scripts, dashboard), its
# rendering (assets), the gate command a project adds, and the documents those
# point at. fixtures/ and templates/ serve this repository and scaffolding.
INCLUDE = ("SKILL.md", "scripts", "assets", "dashboard", "references", "schemas")
ROW = re.compile(r"^\| `([^`]+)` \| `([0-9a-f]{64})` \|$")
META = re.compile(r"^- (Source|Version|Commit|Vendored): (.*)$")
# Written by running the copy, never by editing it.
NOISE = re.compile(r"(^|/)(__pycache__/|[^/]+\.pyc$)")

# Variables that make git ignore `-C` and answer about another repository
# (TASK-0127; the same list as publish_lib.GIT_LOCATORS).
GIT_LOCATORS = ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR",
                "GIT_PREFIX", "GIT_OBJECT_DIRECTORY",
                "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_NAMESPACE")


class Refusal(Exception):
    """A condition the user must fix; exit 2 with the message."""


def say(msg):
    print("vendor-skill.sh: %s" % msg, file=sys.stderr)


def git(repo, *args, raw=False):
    env = {k: v for k, v in os.environ.items() if k not in GIT_LOCATORS}
    try:
        out = subprocess.run(["git", "-C", repo] + list(args), env=env,
                             stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    except OSError:
        return None
    if out.returncode != 0:
        return None
    return out.stdout if raw else out.stdout.decode("utf-8", "replace").strip()


def lf(data):
    return data.replace(b"\r\n", b"\n")


def sha(data):
    return hashlib.sha256(lf(data)).hexdigest()


def version_of(text):
    m = re.search(r"^\s*version:\s*[\"']?([^\"'\s]+)", text, re.MULTILINE)
    return m.group(1) if m else "unknown"


# --- the source: this skill, as committed ------------------------------------

def source():
    """{relpath: bytes} of the skill at HEAD, plus the commit and version.

    Read from HEAD, not the working tree: a vendored copy names a commit, so
    it must be exactly that commit's bytes."""
    top = git(SKILL, "rev-parse", "--show-toplevel")
    if top is None:
        raise Refusal("%s is not inside a git checkout, so there is no commit "
                      "to vendor. Run this from the source repository "
                      "(ai-toolbox), not from a vendored copy." % SKILL)
    if os.path.isfile(os.path.join(SKILL, MANIFEST)):
        raise Refusal("%s holds a %s, so it is itself a vendored copy. "
                      "Vendor from the source repository." % (SKILL, MANIFEST))
    prefix = os.path.relpath(SKILL, top).replace(os.sep, "/")
    listed = git(top, "ls-files", "-z", "--", prefix, raw=True)
    if not listed:
        raise Refusal("no tracked files under %s" % prefix)
    files = {}
    for path in listed.decode("utf-8").split("\0"):
        if not path:
            continue
        rel = path[len(prefix) + 1:]
        if rel.split("/")[0] not in INCLUDE:
            continue
        blob = git(top, "show", "HEAD:" + path, raw=True)
        if blob is None:
            continue  # added to the index but never committed
        files[rel] = lf(blob)
    commit = git(top, "rev-parse", "HEAD")
    dirty = git(top, "status", "--porcelain", "--", prefix)
    version = version_of(files.get("SKILL.md", b"").decode("utf-8", "replace"))
    return files, commit, version, bool(dirty)


# --- the copy -------------------------------------------------------------------

def read_manifest(dest):
    path = os.path.join(dest, MANIFEST)
    if not os.path.isfile(path):
        return None
    meta, rows = {}, {}
    with open(path, encoding="utf-8") as fh:
        for line in fh.read().replace("\r\n", "\n").split("\n"):
            m = ROW.match(line)
            if m:
                rows[m.group(1)] = m.group(2)
                continue
            m = META.match(line)
            if m:
                meta[m.group(1).lower()] = m.group(2).strip("`")
    return meta, rows


def on_disk(dest):
    """Every file under dest except the manifest and runtime noise."""
    found = []
    for root, dirs, names in os.walk(dest):
        dirs[:] = [d for d in dirs if d != "__pycache__"]
        for n in names:
            rel = os.path.relpath(os.path.join(root, n), dest).replace(os.sep, "/")
            if rel == MANIFEST or NOISE.search(rel):
                continue
            found.append(rel)
    return sorted(found)


def file_hash(dest, rel):
    try:
        with open(os.path.join(dest, rel), "rb") as fh:
            return sha(fh.read())
    except OSError:
        return None


def edits(dest, rows):
    """Lines naming every listed file that is missing or not what was written."""
    out = []
    for rel, want in sorted(rows.items()):
        have = file_hash(dest, rel)
        if have is None:
            out.append("missing        %s" % rel)
        elif have != want:
            out.append("edited locally %s" % rel)
    return out


def render_manifest(files, commit, version, src_label):
    lines = [
        "# Vendored: %s - do not edit these files here" % NAME,
        "",
        "Every file listed below is a copy of `%s` at the commit named here." % src_label,
        "Change the source, commit it, then re-vendor from the source checkout:",
        "",
        "```",
        "bash %s/scripts/vendor-skill.sh --into <this repository> --write" % src_label,
        "```",
        "",
        "`scripts/vendor-skill.sh --verify`, run here, fails on any edited, missing",
        "or added file; `--check`, run from the source, says whether this is behind.",
        "",
        "- Source: `%s`" % src_label,
        "- Version: `%s`" % version,
        "- Commit: `%s`" % commit,
        "- Vendored: `%s`" % datetime.date.today().isoformat(),
        "",
        "| File | sha256 |",
        "|---|---|",
    ]
    lines += ["| `%s` | `%s` |" % (rel, sha(files[rel])) for rel in sorted(files)]
    return "\n".join(lines) + "\n"


# --- resolving the destination ----------------------------------------------------

def resolve_dest(repo, dest_arg):
    repo = os.path.abspath(repo)
    if not os.path.isdir(repo):
        raise Refusal("--into %s is not a directory" % repo)
    rel = dest_arg
    if rel is None:
        conf = os.path.join(repo, CONF)
        if os.path.isfile(conf):
            with open(conf, encoding="utf-8") as fh:
                for line in fh.read().split("\n"):
                    m = re.match(r"^\s*skill_dir\s*=\s*(\S+)\s*$", line)
                    if m:
                        rel = m.group(1)
    if not rel:
        raise Refusal("no destination: %s at %s has no skill_dir, and no "
                      "--dest was given" % (CONF, repo))
    if os.path.isabs(rel):
        raise Refusal("--dest %r must be a path inside the repository" % rel)
    full = os.path.normpath(os.path.join(repo, rel))
    real_repo = os.path.realpath(repo)
    real_full = os.path.realpath(full)
    if (os.path.commonpath([real_repo, real_full]) != real_repo
            or real_full == real_repo):
        raise Refusal("destination %r resolves outside the repository, or to "
                      "its root; a CI runner clones the repository and "
                      "nothing else" % rel)
    if ".git" in os.path.relpath(real_full, real_repo).split(os.sep):
        raise Refusal("destination %r is inside .git" % rel)
    return full


# --- commands ---------------------------------------------------------------------

def write(repo, dest_arg, adopt):
    dest = resolve_dest(repo, dest_arg)
    files, commit, version, dirty = source()
    if dirty:
        raise Refusal("the source skill has uncommitted changes; a vendored "
                      "copy names a commit, so commit them first")
    old = read_manifest(dest)
    present = on_disk(dest) if os.path.isdir(dest) else []
    if old is None and present and not adopt:
        raise Refusal("%s already holds %d file(s) and no %s, so it was not "
                      "written by this script. Move it aside, or pass --adopt "
                      "to replace the files this skill ships"
                      % (dest, len(present), MANIFEST))
    old_rows = old[1] if old else {}
    changed = edits(dest, old_rows)
    if changed and not adopt:
        raise Refusal("the copy has local edits, which a write would discard:\n  "
                      + "\n  ".join(changed)
                      + "\nMove the change into the source, or pass --adopt to "
                      "discard it")

    for rel in sorted(files):
        path = os.path.join(dest, *rel.split("/"))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(files[rel])
        if rel.endswith(".sh"):
            os.chmod(path, 0o755)
    for rel in sorted(set(old_rows) - set(files)):
        path = os.path.join(dest, *rel.split("/"))
        if os.path.isfile(path):
            os.remove(path)
            print("removed  %s (gone from the source)" % rel)
    top = git(SKILL, "rev-parse", "--show-toplevel")
    src_label = "%s/%s" % (os.path.basename(top), os.path.relpath(
        SKILL, top).replace(os.sep, "/"))
    with open(os.path.join(dest, MANIFEST), "w", encoding="utf-8",
              newline="\n") as fh:
        fh.write(render_manifest(files, commit, version, src_label))
    for rel in sorted(set(on_disk(dest)) - set(files)):
        print("kept     %s (not vendored; --verify will fail on it)" % rel)
    was = old[0].get("version", "?") if old else "none"
    print("vendored %s %s -> %s at %s (%d files; was %s)"
          % (NAME, version, os.path.relpath(dest, repo), commit[:12],
             len(files), was))
    return 0


def check(repo, dest_arg):
    dest = resolve_dest(repo, dest_arg)
    files, commit, version, dirty = source()
    old = read_manifest(dest)
    if old is None:
        print("STALE    %s has no %s: never vendored by this script"
              % (dest, MANIFEST))
        return 1
    meta, rows = old
    problems = edits(dest, rows)
    for rel in sorted(files):
        want = sha(files[rel])
        if rel not in rows:
            problems.append("behind         %s (new in the source)" % rel)
        elif rows[rel] != want:
            problems.append("behind         %s" % rel)
    for rel in sorted(set(rows) - set(files)):
        problems.append("behind         %s (gone from the source)" % rel)
    for rel in sorted(set(on_disk(dest)) - set(rows)):
        problems.append("not vendored   %s" % rel)
    if dirty:
        print("note     the source has uncommitted changes; compared with HEAD")
    for p in problems:
        print("STALE    " + p)
    if problems:
        print("STALE    vendored %s, source %s at %s; run --write"
              % (meta.get("version", "?"), version, commit[:12]))
        return 1
    print("ok       %s %s at %s" % (NAME, version, meta.get("commit", "?")[:12]))
    return 0


def verify(dest):
    dest = os.path.abspath(dest)
    old = read_manifest(dest)
    if old is None:
        raise Refusal("%s has no %s, so it is not a vendored copy (in the "
                      "source repository, use --check instead)" % (dest, MANIFEST))
    meta, rows = old
    problems = edits(dest, rows)
    for rel in sorted(set(on_disk(dest)) - set(rows)):
        problems.append("not vendored   %s" % rel)
    for p in problems:
        print("FAIL     " + p)
    if problems:
        print("FAIL     change the source and re-vendor; never edit a vendored copy")
        return 1
    print("ok       %s %s, %d files unedited (commit %s)"
          % (NAME, meta.get("version", "?"), len(rows), meta.get("commit", "?")[:12]))
    return 0


def main(argv):
    repo = dest = None
    mode = None
    adopt = False
    verify_dir = None
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg in ("--into", "--dest", "--dir"):
            if i + 1 >= len(argv):
                say("%s needs a value" % arg)
                return 2
            value = argv[i + 1]
            if arg == "--into":
                repo = value
            elif arg == "--dest":
                dest = value
            else:
                verify_dir = value
            i += 2
            continue
        if arg in ("--write", "--check", "--verify"):
            if mode and mode != arg:
                say("%s and %s together make no sense" % (mode, arg))
                return 2
            mode = arg
        elif arg == "--adopt":
            adopt = True
        else:
            say("unknown argument %s (see --help)" % arg)
            return 2
        i += 1
    try:
        if mode == "--verify":
            return verify(verify_dir or SKILL)
        if mode is None:
            raise Refusal("say --write, --check or --verify")
        if repo is None:
            raise Refusal("%s needs --into REPO" % mode)
        if adopt and mode != "--write":
            raise Refusal("--adopt goes with --write only")
        if mode == "--write":
            return write(repo, dest, adopt)
        return check(repo, dest)
    except Refusal as exc:
        say(str(exc))
        return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
