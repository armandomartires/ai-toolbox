#!/usr/bin/env python3
"""check-sandbox-ci.py - static checks for issue #11 (Level 1 sandbox).
Text-based, standard library only. --self-test feeds seeded bad inputs."""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
CI = ROOT / ".gitlab/ci/unattended-sandbox.yml"
HCL = ROOT / "sandbox/vault/ai-toolbox-unattended.hcl"
ROLE = ROOT / "sandbox/vault/jwt-role-ai-toolbox-unattended.json"


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
    print("check-sandbox-ci self-test: OK")


def main():
    if sys.argv[1:] == ["--self-test"]:
        return self_test()
    errs = check_hcl(HCL.read_text()) + check_role(ROLE.read_text()) + check_ci(CI.read_text())
    for e in errs: print("SANDBOX CI:", e)
    if not errs: print("check-sandbox-ci: OK")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
