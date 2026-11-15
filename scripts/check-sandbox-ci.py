#!/usr/bin/env python3
"""check-sandbox-ci.py - static checks for issue #11 (Level 1 sandbox).
Text-based, standard library only. --self-test feeds seeded bad inputs."""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
CI = ROOT / ".gitlab/ci/unattended-sandbox.yml"
HCL = ROOT / "sandbox/vault/ai-toolbox-unattended.hcl"
ROLE = ROOT / "sandbox/vault/jwt-role-ai-toolbox-unattended.json"
GOLDEN = ROOT / ".gitlab/ci/golden-run.yml"
ROOT_CI = ROOT / ".gitlab-ci.yml"


def check_hcl(text):
    errs = []
    paths = dict(re.findall(r'path\s+"([^"]+)"\s*{\s*capabilities\s*=\s*\[([^\]]*)\]', text))
    for p, caps in paths.items():
        c = set(re.findall(r'"(\w+)"', caps))
        if c == {"deny"}:
            continue
        if not p.startswith("sigmarecon-projects/") or "/ai-toolbox/" not in p:
            errs.append(f"grant outside sigmarecon-projects/*/ai-toolbox/: {p}")
        if c - {"read", "list"}:
            errs.append(f"non read-only capabilities on {p}: {sorted(c - {'read', 'list'})}")
    if paths.get("operator/*", "").strip() != '"deny"':
        errs.append('missing explicit deny on "operator/*"')
    return errs


def check_role(text):
    import json
    errs, r = [], json.loads(text)
    bc = r.get("bound_claims", {})
    if bc.get("project_id") != "17": errs.append("role not bound to project_id 17")
    if bc.get("ref_protected") != "true": errs.append("role not bound to protected refs")
    if r.get("token_policies") != ["ai-toolbox-unattended-ro"]: errs.append("role policies are not exactly the read-only policy")
    if not r.get("token_no_default_policy"): errs.append("role keeps the default policy")
    if bc.get("environment") != "unattended" or bc.get("environment_protected") != "true":
        errs.append("role not bound to the protected environment 'unattended'")
    if not bc.get("pipeline_source") or set(bc["pipeline_source"]) - {"schedule", "web"}:
        errs.append("role not bound to pipeline_source schedule/web")
    if r.get("bound_claims_type") != "string": errs.append("bound_claims_type must be string (no globs)")
    return errs


def check_ci(text):
    errs = []
    for job in ("sandbox-selfcheck", "unattended-run"):
        m = re.search(rf"^{job}:\n((?:[ \n].*\n?)*)", text, re.M)
        if not m:
            errs.append(f"job {job} missing"); continue
        body = m.group(1)
        if not re.search(r"^\s+tags:\s*\[docker\]", body, re.M): errs.append(f"{job}: not pinned to tag docker")
        if "assert-sandbox.sh" not in body: errs.append(f"{job}: does not run assert-sandbox.sh")
        if re.search(r"VAULT_TOKEN|GITLAB_TOKEN|volumes:|privileged", body): errs.append(f"{job}: references a host credential or mount")
    if "id_tokens:" not in text: errs.append("unattended-run does not use id_tokens")
    run = re.search(r"^unattended-run:\n((?:[ \n].*\n?)*)", text, re.M)
    run = run.group(1) if run else ""
    if not re.search(r"^\s+environment:\s*\n\s+name:\s*unattended\s*$", run, re.M):
        errs.append("unattended-run: not in environment 'unattended'")
    if re.search(r"\beval\b", run): errs.append("unattended-run: uses eval (fails open)")
    if not re.search(r"unset\s+CI_JOB_TOKEN", run): errs.append("unattended-run: CI_JOB_TOKEN not unset")
    if "scrub-artifacts.sh" not in run: errs.append("unattended-run: artifacts not scrubbed")
    if "$CI_DEFAULT_BRANCH" not in text: errs.append("unattended-run not restricted to the default branch")
    return errs


def job_body(text, job):
    m = re.search(rf"^{job}:\n((?:(?:[ \t].*)?\n)*)", text, re.M)
    return m.group(1) if m else None


def check_golden(text, root_ci):
    """The golden-run jobs (S018.T004): a dry job with no secret on every
    pipeline, a manual live job whose only secret is ANTHROPIC_API_KEY."""
    errs = []
    if ".gitlab/ci/golden-run.yml" not in root_ci:
        errs.append("golden-run.yml is not included from .gitlab-ci.yml")
    dry, live = job_body(text, "golden-run-dry"), job_body(text, "golden-run-live")
    for name, body in (("golden-run-dry", dry), ("golden-run-live", live)):
        if body is None:
            errs.append(f"job {name} missing"); continue
        if not re.search(r"^\s+tags:\s*\[docker\]", body, re.M): errs.append(f"{name}: not pinned to tag docker")
        if re.search(r"^\s*-\s+(env|printenv|export -p)\s*$|set -x|set -o xtrace", body, re.M):
            errs.append(f"{name}: can dump the environment")
        if re.search(r"\$(VAULT_TOKEN|GITLAB_TOKEN|GITHUB_TOKEN|GITLAB_PUSH_TOKEN)", body):
            errs.append(f"{name}: references a host credential")
    if dry is not None:
        if re.search(r"API_KEY|SECRET|TOKEN|id_tokens", dry): errs.append("golden-run-dry: references a secret")
        if "test-golden-run.sh" not in dry: errs.append("golden-run-dry: does not run tests/test-golden-run.sh")
        if re.search(r"when:\s*manual", dry): errs.append("golden-run-dry: is manual")
    if live is not None:
        if not re.search(r"when:\s*manual", live): errs.append("golden-run-live: not when: manual")
        if not re.search(r'\$CI_PIPELINE_SOURCE == "schedule"\n\s+when: never', live):
            errs.append("golden-run-live: a schedule is not refused")
        if "--max-cost-usd" not in live: errs.append("golden-run-live: no spend cap")
        used = re.sub(r"^\s*-\s+unset .*$", "", live, flags=re.M)  # dropping one is not consuming it
        secrets = set(re.findall(r"\b[A-Z][A-Z0-9_]*(?:API_KEY|_TOKEN|SECRET)\b", used))
        if secrets - {"ANTHROPIC_API_KEY", "CI_JOB_TOKEN"}:
            errs.append("golden-run-live: consumes a secret other than ANTHROPIC_API_KEY")
        m = re.search(r"artifacts:\n((?:[ \n].*\n?)*)", live)
        paths = re.findall(r"^\s+-\s+(\S+)", m.group(1), re.M) if m else []
        if not paths or any(not p.startswith("golden-live/") or p.endswith("/") for p in paths):
            errs.append("golden-run-live: artifacts are not limited to named golden-live/ files")
    return errs


def self_test():
    assert check_hcl('path "sigmarecon-projects/data/ai-toolbox/*" { capabilities = ["read","update"] }')
    assert check_hcl('path "sigmarecon-projects/data/ai-toolbox/*" { capabilities = ["read"] }')  # no deny
    assert check_hcl('path "kv/data/*" { capabilities = ["read"] }\npath "operator/*" { capabilities = ["deny"] }')
    assert check_role('{"bound_claims":{"project_id":"18"},"token_policies":["x"]}')
    assert check_ci("unattended-run:\n  script:\n    - echo $VAULT_TOKEN\n")
    good_role = ('{"bound_claims":{"project_id":"17","ref_protected":"true","environment":"unattended",'
                 '"environment_protected":"true","pipeline_source":["schedule","web"]},'
                 '"bound_claims_type":"string","token_policies":["ai-toolbox-unattended-ro"],"token_no_default_policy":true}')
    assert not check_role(good_role), check_role(good_role)
    assert check_role(good_role.replace('"environment":"unattended",', ''))
    assert check_role(good_role.replace('"string"', '"glob"'))
    assert check_role(good_role.replace('"web"', '"push"'))
    run = ("unattended-run:\n  tags: [docker]\n  environment:\n    name: unattended\n  id_tokens:\n  script:\n"
           "    - unset CI_JOB_TOKEN\n    - bash scripts/sandbox/assert-sandbox.sh\n    - bash scripts/sandbox/scrub-artifacts.sh x\n")
    assert not [e for e in check_ci(run) if e.startswith("unattended-run:")], check_ci(run)
    assert check_ci(run + '    - eval "$(python3 f.py)"\n')
    assert check_ci(run.replace("unset CI_JOB_TOKEN", "true"))
    gold = ("golden-run-dry:\n  tags: [docker]\n  script:\n    - bash tests/test-golden-run.sh\n"
            "golden-run-live:\n  tags: [docker]\n  rules:\n    - if: $CI_PIPELINE_SOURCE == \"schedule\"\n"
            "      when: never\n    - when: manual\n  script:\n    - runner.py --max-cost-usd 10\n"
            "    - test -n \"$ANTHROPIC_API_KEY\"\n  artifacts:\n    paths:\n      - golden-live/journal.jsonl\n")
    inc = "- local: .gitlab/ci/golden-run.yml"
    assert not check_golden(gold, inc), check_golden(gold, inc)
    assert check_golden(gold, "")
    assert check_golden(gold.replace("tests/test-golden-run.sh", "x"), inc)
    assert check_golden(gold.replace("    - when: manual", "    - when: always"), inc)
    assert check_golden(gold.replace(" --max-cost-usd 10", ""), inc)
    assert check_golden(gold.replace("    - bash tests", "    - echo $ANTHROPIC_API_KEY\n    - bash tests"), inc)
    assert check_golden(gold + "    - echo $XAI_API_KEY\n", inc)
    assert check_golden(gold.replace("golden-live/journal.jsonl", "golden-live/"), inc)
    assert check_golden(gold.replace("  script:\n    - runner", "  script:\n    - env\n    - runner"), inc)
    print("check-sandbox-ci self-test: OK")


def main():
    if sys.argv[1:] == ["--self-test"]:
        return self_test()
    errs = check_hcl(HCL.read_text()) + check_role(ROLE.read_text()) + check_ci(CI.read_text())
    errs += check_golden(GOLDEN.read_text(), ROOT_CI.read_text())
    for e in errs: print("SANDBOX CI:", e)
    if not errs: print("check-sandbox-ci: OK")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
