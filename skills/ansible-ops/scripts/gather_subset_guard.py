"""Refuse a play that gathers facts against a hazard-class host without excluding `mounts`.

WHAT THIS PROVES
    That a play whose target resolves into a configured hazard-class group
    either does not gather facts, or carries one of the two accepted
    exclusions.

WHAT THIS DOES NOT PROVE
    That a node cannot hang. The hazard is an uninterruptible D-state stat on
    a wedged clustered filesystem; it is documented but not reproducible on
    demand, so this rule is validated against SYNTAX, never against the
    hazard. A green run means a keyword is present, not that a cluster is
    safe. See `skills/ansible-ops/references/hazards.md` class 1.

WHY A LINT RULE AND NOT A pre-commit HOOK
    Decided by TASK-0027 on the MCP asymmetry: a custom rule runs wherever
    `ansible-lint` runs -- pre-commit, CI, an editor, AND the pinned ansible
    MCP server's own lint tool. A standalone hook fires at commit time only,
    so it would not see an agent linting through MCP, which is the case S6
    exists to guard.

THE TRAP THIS RULE SHIPS WITH -- READ BEFORE TRUSTING A GREEN RUN
    A custom rule that is not in the active profile and not named in
    `enable_list` is LOADED, LISTED, and NEVER EVALUATED -- at exit 0.
    Observed in TASK-0027. So this rule can appear installed while doing
    nothing, which is worse than absent because it is trusted. Wiring it
    therefore requires `enable_list`, and adoption requires running the
    fires-proof in `tests/gather-subset-guard.sh`. Do not conclude from a
    passing lint run that this rule ran.

NOT WIRED INTO THIS REPOSITORY'S GATE, DELIBERATELY.
    Nothing in `ai-toolbox` executes this file. It lints OTHER repositories'
    Ansible content, and the mandatory gate must stay offline and hermetic
    (ADR-0009); `ansible-lint` is not a dependency of this repo. The
    fires-proof harness is a separate, manually-run script.

CONFIGURATION -- BY ENVIRONMENT VARIABLE, NOT BY `.ansible-lint`

        GATHER_SUBSET_GUARD_HAZARD_GROUPS=pve_cluster,other_group
        GATHER_SUBSET_GUARD_INVENTORY=inventory/production.yml,inventory/edge.yml

    Comma-separated. Both are optional; the defaults below are used when unset.

    WHY NOT `.ansible-lint`, WHICH WOULD BE THE OBVIOUS PLACE
    Because it does not work, and this was verified rather than assumed. The
    natural form --

        rules:
          gather-subset-mounts:
            hazard_groups: [pve_cluster]

    -- is REJECTED. `ansible-lint 26.8.0` validates its config against a
    strict JSON schema in which `$defs.rule` has `additionalProperties: false`
    and permits exactly one key, `exclude_paths`. The result is not a warning:

        Invalid configuration file .../.ansible-lint.
        $.rules['gather-subset-mounts'] Additional properties are not allowed
        ('hazard_groups' was unexpected).

    with EXIT CODE 3 and no linting performed. So although `AnsibleLintRule`
    exposes `get_config()` reading `options.rules[<rule id>]`, a custom rule
    cannot legally be configured through that path -- the API exists and the
    schema forbids reaching it. Environment variables are the remaining route.

    Consequence an adopter must know: rule configuration lives OUTSIDE the
    repository's committed lint config, so it is not reviewable in the same
    place as the rest of the lint setup. That is a real downgrade from
    declarative wiring, and it is the upstream schema's constraint rather than
    a choice made here. `enable_list` itself IS a legal top-level key, so
    enabling the rule stays declarative even though configuring it cannot be.

    `hazard_groups` is a list of GROUP names, matched including nested
    children. `inventory` is a list of paths. Neither is hardcoded to one
    estate: the defaults reflect the estate that motivated the rule and are
    documented as defaults rather than as truth.

WHY AN INVENTORY IS READ AT ALL
    Because a play may name a bare HOST that reaches its hazard class only by
    group membership. The estate that motivated this rule does exactly that
    (`hosts: sigsrvpve1`), so a rule matching `hosts:` against group names
    would have said nothing about the one playbook it was written for. Found
    by TASK-0052 (defect D1) before this rule was implemented.

AMBIGUITY IS A FAILURE, NOT A PASS
    `hosts:` can be a Jinja expression, a pattern, or a comma list. When the
    target cannot be resolved statically, this rule reports it as ambiguous
    and fails, with a message distinct from the missing-exclusion message. A
    guard that silently ignores what it cannot parse gives false assurance on
    exactly the plays most likely to be unusual.
"""

from __future__ import annotations

import os
import re
from typing import TYPE_CHECKING, Any

from ansiblelint.rules import AnsibleLintRule

if TYPE_CHECKING:
    from ansiblelint.errors import MatchError
    from ansiblelint.file_utils import Lintable

# Defaults describe the estate that motivated the rule. They are a starting
# point, not a claim about any other estate -- override in `.ansible-lint`.
DEFAULT_HAZARD_GROUPS = ("pve_cluster",)
DEFAULT_INVENTORIES = (
    "inventory/production.yml",
    "inventory/hosts.yml",
    "inventory.yml",
)

# The setup module under any of its names. `gather_facts` is implemented by
# ansible.builtin.setup, so a module_defaults entry must name one of these to
# affect implicit fact gathering.
SETUP_MODULE_NAMES = (
    "ansible.builtin.setup",
    "ansible.legacy.setup",
    "setup",
)

JINJA = re.compile(r"{{|{%")
# Patterns that ansible resolves at runtime against the inventory. Any of
# these means the target set is not statically knowable from `hosts:` alone.
PATTERN_CHARS = re.compile(r"[*?\[\]&!:]")


def _excludes_mounts(value: Any) -> bool:
    """True if a gather_subset value excludes the mounts subset.

    Accepts a string or a list, since both are legal. Looks for the negation
    forms ansible accepts (`!mounts`, `!hardware` -- mounts is part of
    hardware) and for a positive subset list that simply omits mounts by
    naming only other subsets, e.g. `min` or `network`.
    """
    if value is None:
        return False
    items = value if isinstance(value, list) else [value]
    items = [str(i).strip() for i in items if i is not None]
    if not items:
        return False

    # Explicit negation of mounts, or of hardware which contains it.
    if any(i in ("!mounts", "!hardware", "!all") for i in items):
        return True

    # A purely positive list that never asks for mounts, hardware or all.
    positives = [i for i in items if not i.startswith("!")]
    if positives and not any(
        p in ("mounts", "hardware", "all") for p in positives
    ):
        return True

    return False


def _module_defaults_excludes_mounts(play: dict[str, Any]) -> bool:
    """True if module_defaults scopes a mounts exclusion to the setup module.

    Deliberately requires the entry to name the SETUP module. A
    `module_defaults:` block scoped to something else -- a connection plugin,
    another collection's group -- does not affect fact gathering, and
    accepting the mere presence of the key would pass dangerous code while
    appearing to implement this accepted form. Found by TASK-0052 (defect D3);
    fixture 7 covers it.
    """
    md = play.get("module_defaults")
    if not isinstance(md, dict):
        return False
    for key, val in md.items():
        name = str(key).strip()
        # `group/...` entries are collection action-groups. Only accept one if
        # it names setup explicitly; a group like
        # `group/community.proxmox.proxmox` does not include setup.
        if name.startswith("group/"):
            if not name.endswith("/setup"):
                continue
        elif name not in SETUP_MODULE_NAMES:
            continue
        if isinstance(val, dict) and _excludes_mounts(val.get("gather_subset")):
            return True
    return False


def _gathers_facts(play: dict[str, Any]) -> bool:
    """True unless the play demonstrably does not gather facts.

    `gather_facts` defaults to the `DEFAULT_GATHERING` config, which is
    `implicit` out of the box -- so ABSENCE means facts ARE gathered. Treating
    an absent key as safe would invert the check on the most common play
    shape.
    """
    gf = play.get("gather_facts")
    if gf is None:
        return True
    if isinstance(gf, str):
        if JINJA.search(gf):
            # Conditional fact gathering: cannot rule it out statically.
            return True
        return gf.strip().lower() not in ("false", "no", "off", "0")
    return bool(gf)


class GatherSubsetMountsRule(AnsibleLintRule):
    """Fact gathering against a hazard-class host must exclude mounts."""

    id = "gather-subset-mounts"
    shortdesc = "Fact gathering on a hazard-class host must exclude `mounts`"
    description = (
        "Default fact gathering collects `ansible_mounts`, which stats every "
        "mount point on the target. On a clustered FUSE-backed filesystem "
        "whose daemon is wedged, that stat blocks uninterruptibly and cannot "
        "be killed -- not by a task timeout, not by `timeout`. There is no "
        "global remedy: `gather_subset` is rejected in `[defaults]` and "
        "silently ignored in `group_vars`, so the exclusion must be repeated "
        "per play. This rule checks that it was. It proves a keyword is "
        "present; it does not prove a node is safe."
    )
    severity = "HIGH"
    tags = ["idiom"]
    version_changed = "26.8.0"

    _inventory_cache: dict[str, frozenset[str]] = {}

    # ---- configuration -------------------------------------------------
    # Read from the environment, NOT from `.ansible-lint`. See this module's
    # docstring: the config schema's `$defs.rule` sets
    # `additionalProperties: false` and allows only `exclude_paths`, so a
    # custom rule key there is a fatal config error (exit 3), not a warning.
    # `get_config()` therefore cannot be used, despite existing.

    @staticmethod
    def _env_list(name: str, default: tuple[str, ...]) -> list[str]:
        raw = os.environ.get(name, "")
        items = [p.strip() for p in raw.split(",") if p.strip()]
        return items or list(default)

    def _hazard_groups(self) -> list[str]:
        return self._env_list(
            "GATHER_SUBSET_GUARD_HAZARD_GROUPS", DEFAULT_HAZARD_GROUPS
        )

    def _inventory_paths(self) -> list[str]:
        return self._env_list(
            "GATHER_SUBSET_GUARD_INVENTORY", DEFAULT_INVENTORIES
        )

    # ---- inventory resolution ------------------------------------------

    def _hazard_hosts(self) -> frozenset[str]:
        """Every host and group name that resolves into a hazard group.

        Returns the hazard group names themselves plus, transitively, every
        nested child group and every host under them -- which is what makes a
        bare hostname resolvable (defect D1).

        A missing or unparseable inventory yields an empty set rather than an
        error: the rule must still work in a repo that stores its inventory
        elsewhere, and it degrades to group-name matching plus an ambiguity
        report rather than to silence.
        """
        key = "|".join(self._inventory_paths()) + "||" + "|".join(
            self._hazard_groups()
        )
        if key in self._inventory_cache:
            return self._inventory_cache[key]

        names: set[str] = set(self._hazard_groups())
        for path in self._inventory_paths():
            if not os.path.isfile(path):
                continue
            try:
                import yaml  # noqa: PLC0415

                with open(path, encoding="utf-8") as fh:
                    data = yaml.safe_load(fh)
            except (OSError, UnicodeDecodeError, ValueError):
                continue
            if not isinstance(data, dict):
                continue

            def walk(node: Any, inside: bool) -> None:
                """Collect names under a hazard group, recursing into children."""
                if not isinstance(node, dict):
                    return
                for gname, gbody in node.items():
                    hit = inside or str(gname) in names
                    if hit:
                        names.add(str(gname))
                    if not isinstance(gbody, dict):
                        continue
                    hosts = gbody.get("hosts")
                    if hit and isinstance(hosts, dict):
                        names.update(str(h) for h in hosts)
                    elif hit and isinstance(hosts, list):
                        names.update(str(h) for h in hosts)
                    children = gbody.get("children")
                    if isinstance(children, dict):
                        walk(children, hit)

            # Two passes: group membership can be declared before the parent
            # that makes it hazardous is seen.
            for _ in range(2):
                walk(data, False)
                for body in data.values():
                    if isinstance(body, dict) and isinstance(
                        body.get("children"), dict
                    ):
                        walk(body["children"], False)

        frozen = frozenset(names)
        self._inventory_cache[key] = frozen
        return frozen

    # ---- target classification -----------------------------------------

    def _classify(self, hosts: Any) -> str:
        """Return 'hazard', 'safe' or 'ambiguous' for a play's `hosts:` value.

        'ambiguous' is a real verdict, not a fallback for anything unrecognised:
        it means the target set cannot be determined statically, which is a
        finding in its own right.
        """
        if hosts is None:
            # No `hosts:` at all -- not a play this rule can reason about.
            return "ambiguous"
        if isinstance(hosts, list):
            verdicts = {self._classify(h) for h in hosts}
            if "hazard" in verdicts:
                return "hazard"
            if "ambiguous" in verdicts:
                return "ambiguous"
            return "safe"

        text = str(hosts).strip()
        if not text:
            return "ambiguous"
        if JINJA.search(text):
            return "ambiguous"

        hazard_names = self._hazard_hosts()
        parts = [p.strip() for p in text.split(",") if p.strip()]
        saw_ambiguous = False
        for part in parts:
            if part in hazard_names:
                return "hazard"
            if part in ("localhost", "127.0.0.1", "::1"):
                continue
            if PATTERN_CHARS.search(part):
                # A pattern that could expand to include a hazard host.
                saw_ambiguous = True
                continue
            if part == "all":
                # `all` includes every group, so it includes the hazard class
                # whenever one is configured.
                return "hazard"
        return "ambiguous" if saw_ambiguous else "safe"

    # ---- the check ------------------------------------------------------

    def matchplay(self, file: Lintable, data: dict[str, Any]) -> list[MatchError]:
        if file.kind != "playbook" or not isinstance(data, dict):
            return []
        if "hosts" not in data and "import_playbook" in data:
            return []

        if not _gathers_facts(data):
            return []
        if _excludes_mounts(data.get("gather_subset")):
            return []
        if _module_defaults_excludes_mounts(data):
            return []

        verdict = self._classify(data.get("hosts"))
        if verdict == "safe":
            return []

        target = data.get("hosts")
        if verdict == "ambiguous":
            message = (
                "AMBIGUOUS TARGET: cannot determine statically whether "
                f"hosts: {target!r} includes a hazard-class host, and this "
                "play gathers facts without excluding `mounts`. Resolve the "
                "target or add `gather_subset: \"!mounts\"`. This is not the "
                "same finding as a missing exclusion on a known target."
            )
        else:
            message = (
                "MISSING EXCLUSION: this play gathers facts against "
                f"hazard-class target {target!r} without excluding `mounts`. "
                "Add `gather_subset: \"!mounts\"` as a play keyword, or a "
                "`module_defaults` entry for `ansible.builtin.setup`. A "
                "`module_defaults` block scoped to anything else does not "
                "affect fact gathering."
            )

        return [
            self.create_matcherror(
                message=message,
                filename=file,
                data=data,
            )
        ]
