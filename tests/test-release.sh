#!/usr/bin/env bash
# Release rule, packaging and signature checks (TASK-0283, P2.4, R-07).
# Offline: cosign is replaced by a stub that signs by writing the artifact's
# sha256 into the bundle, so this proves the wiring (what is signed, what is
# verified, what fails closed), not Sigstore itself. The live proof is the
# release jobs on a real tag.
#
# Red proof: before scripts/check-release.py, verify-release.sh, sign-release.sh
# and pack-release.sh exist, every positive case FAILs.
set -uo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
CR="$here/scripts/check-release.py"
VR="$here/scripts/verify-release.sh"
SR="$here/scripts/sign-release.sh"
PR="$here/scripts/pack-release.sh"
rc=0
t="$(mktemp -d)"; trap 'rm -rf "$t"' EXIT
check() { # name status [detail]
  if [ "$2" = 0 ]; then echo "PASS $1"; else echo "FAIL $1${3:+: $3}"; rc=1; fi
}
# negcheck name status [detail]: passes when the command under test failed
negcheck() { check "$1" "$([ "$2" -ne 0 ] && echo 0 || echo 1)" "${3:-}"; }

# --- the version and tag rule ------------------------------------------------
python3 -I "$CR" >"$t/o" 2>&1; s=$?
check "the repository obeys the version rule" "$s" "$(cat "$t/o")"
# The current version, read from the rule's file, so a release bump needs no edit here.
cur="$(python3 -I -c 'import json,sys;print(json.load(open(sys.argv[1]))["plugins"]["ai-toolbox-skills"]["version"])' scripts/plugin-versions.json)"
python3 -I "$CR" --tag "ai-toolbox-skills--v$cur" >"$t/o" 2>&1; s=$?
check "tag ai-toolbox-skills--v$cur matches its version" "$s" "$(cat "$t/o")"
for bad in ai-toolbox-skills--v9.9.9 v0.1.0 ai-toolbox-skills-0.1.0 other--v0.1.0; do
  python3 -I "$CR" --tag "$bad" >"$t/o" 2>&1; s=$?
  negcheck "tag $bad is refused" "$s" "$(cat "$t/o")"
done

mk() { # copy the files the rule reads into a fake root $t/$1
  mkdir -p "$t/$1/scripts" "$t/$1/.claude-plugin"
  cp "$here/scripts/plugin-versions.json" "$t/$1/scripts/" 2>/dev/null
  cp "$here/.claude-plugin/marketplace.json" "$t/$1/.claude-plugin/"
  for k in skills agents gates; do
    mkdir -p "$t/$1/plugins/ai-toolbox-$k/.claude-plugin"
    cp "$here/plugins/ai-toolbox-$k/.claude-plugin/plugin.json" "$t/$1/plugins/ai-toolbox-$k/.claude-plugin/"
  done
}
mutate() { # file python-statement-on-d
  python3 -I - "$1" "$2" <<'PY'
import json, sys
path, expr = sys.argv[1], sys.argv[2]
d = json.load(open(path, encoding="utf-8"))
exec(expr)
json.dump(d, open(path, "w", encoding="utf-8"), indent=2)
PY
}
# neg name root expected-substring: fails with exactly one FAIL line holding the text
neg() {
  python3 -I "$CR" --root "$t/$2" >"$t/o" 2>&1; s=$?
  n="$(grep -c '^FAIL' "$t/o")"
  if [ "$s" -ne 0 ] && [ "$n" = 1 ] && grep -q -- "$3" "$t/o"; then check "$1" 0
  else check "$1" 1 "status $s, $n FAIL line(s), wanted one with '$3': $(cat "$t/o")"; fi
}
mk a; mutate "$t/a/plugins/ai-toolbox-gates/.claude-plugin/plugin.json" "d['version']='0.2.0'"
neg "a plugin.json version that differs from the rule fails" a "plugin.json version is '0.2.0'"
mk b; mutate "$t/b/.claude-plugin/marketplace.json" "[p for p in d['plugins'] if p['name']=='ai-toolbox-skills'][0].pop('version', None)"
neg "a marketplace entry with no version fails" b "marketplace entry version is None"
# c: skills moves to 1.0.0 everywhere (rule, plugin.json, marketplace) so only the range is wrong
mk c
mutate "$t/c/scripts/plugin-versions.json" "d['plugins']['ai-toolbox-skills']['version']='1.0.0'"
mutate "$t/c/plugins/ai-toolbox-skills/.claude-plugin/plugin.json" "d['version']='1.0.0'"
mutate "$t/c/.claude-plugin/marketplace.json" "[p for p in d['plugins'] if p['name']=='ai-toolbox-skills'][0].update(version='1.0.0')"
neg "a dependency range the dependency no longer satisfies fails" c "needs ai-toolbox-skills ~0.1.0 but it is at 1.0.0"
mk d; mutate "$t/d/scripts/plugin-versions.json" "d['plugins']['ai-toolbox-gates']['version']='not-a-version'"
neg "a version that is not semver fails" d "not X.Y.Z semver"
mk e; mutate "$t/e/scripts/plugin-versions.json" "d['plugins']['ai-toolbox-gates']='0.1.0'"
neg "a plugin entry that is not an object is reported, not raised" e "is not an object"
mk f; mutate "$t/f/plugins/ai-toolbox-agents/.claude-plugin/plugin.json" "d['dependencies']=['ai-toolbox-skills']"
neg "a dependency without its range fails" f "plugin.json dependencies"

# --- release.yml structure (a tiny YAML reader, tests/yamlmini.py) ------------
python3 -I - "$here" <<'PY' >"$t/o" 2>&1
import os, re, sys
here = sys.argv[1]
sys.path.insert(0, os.path.join(here, "tests"))
import json, yamlmini
y = yamlmini.load(os.path.join(here, ".gitlab", "ci", "release.yml"))
bad = []
def chk(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok: bad.append(msg)
for j in ("release", "release-provenance", "release-publish", ".release-tag-rule"):
    chk(isinstance(y.get(j), dict), "release.yml defines the job %s" % j)
rel, prov, pub, tmpl = (y.get(k) or {} for k in ("release", "release-provenance", "release-publish", ".release-tag-rule"))
steps = lambda j: "\n".join(x for x in j.get("script", []) if isinstance(x, str))
for j, name in ((rel, "release"), (prov, "release-provenance")):
    chk(j.get("extends") == ".release-tag-rule", "%s runs only through the tag rule" % name)
    chk(j.get("id_tokens", {}).get("SIGSTORE_ID_TOKEN", {}).get("aud") == "sigstore", "%s requests the sigstore id token" % name)
    chk("verify-release.sh" in steps(j), "%s runs verify-release.sh" % name)
    chk("sign-release.sh" in steps(j), "%s signs through sign-release.sh" % name)
chk("check-release.py --tag" in steps(rel), "release checks the tag against the rule")
chk("pack-release.sh" in steps(rel), "release packs with pack-release.sh")
chk("sha256sum -c" in steps(rel), "release checks the .sha256 file")
chk("tampered" in steps(rel) and "unsigned" in steps(rel), "release proves an altered and an unsigned copy fail")
chk(prov.get("needs") == ["release"], "release-provenance needs release")
chk("make-provenance.py" in steps(prov), "release-provenance writes the statement")
rules = (tmpl.get("rules") or [{}])
chk("CI_COMMIT_TAG =~" in str(rules[0].get("if")), "the tag rule tests CI_COMMIT_TAG")
prules = pub.get("rules") or [{}]
chk(prules[0].get("when") == "manual", "release-publish is manual")
chk(str(pub.get("image")).startswith("$RELEASE_CLI_IMAGE") and "@sha256:" in steps(pub), "release-publish image is a variable that must be a digest")
chk(bool(pub.get("release", {}).get("tag_name")), "release-publish creates the release")
chk("RUNNER_GENERATE_ARTIFACTS_METADATA" not in open(os.path.join(here, ".gitlab", "ci", "release.yml"), encoding="utf-8").read(), "release.yml sets no unexplained runner variable")
# L3: the tag regexp lists exactly the plugins of the rule and matches their tags
def rx(cond):
    m = re.search(r"=~ /(.*)/\s*$", cond)
    return re.compile(m.group(1)) if m else None
rule = json.load(open(os.path.join(here, "scripts", "plugin-versions.json"), encoding="utf-8"))["plugins"]
for label, cond in (("template", str(rules[0].get("if"))), ("release-publish", str(prules[0].get("if")))):
    r = rx(cond)
    chk(r is not None, "%s tag regexp is readable" % label)
    if r:
        chk(all(r.match("%s--v%s" % (n, s["version"])) for n, s in rule.items()), "%s tag regexp matches the tag of every plugin in plugin-versions.json" % label)
        chk(not r.match("ai-toolbox-other--v0.1.0") and not r.match("v0.1.0") and not r.match("ai-toolbox-skills--v1.0"), "%s tag regexp refuses foreign and malformed tags" % label)
text = open(os.path.join(here, ".gitlab", "ci", "release.yml"), encoding="utf-8").read()
chk(not re.search(r"BEGIN [A-Z ]*PRIVATE KEY|cosign\.key", text), "release.yml carries no private key")
chk("SLSA provenance the runner generates" not in text, "release.yml does not claim runner-generated provenance")
sys.exit(1 if bad else 0)
PY
s=$?; grep -E '^(PASS|FAIL)' "$t/o"; [ "$s" = 0 ] || { rc=1; grep -vE '^(PASS|FAIL)' "$t/o"; }

# --- docs: the one-time setup names the protections ---------------------------
d="$here/docs/operations/releases.md"
grep -q 'Protected tags' "$d" && grep -q -- '\*--v\*' "$d" && grep -q 'protected' "$d"; s=$?
check "releases.md requires a protected *--v* tag rule and protected COSIGN_* variables" "$s"
grep -q 'SLSA provenance the runner generates' "$d" "$here/.ai/decisions/"*0064-*.md; s=$?
negcheck "the docs and ADR do not claim runner-generated provenance" "$s"
grep -q '^COSIGN_CERT_IDENTITY_REGEXP\|export COSIGN_CERT_IDENTITY_REGEXP=.<' "$d"; s=$?
negcheck "the docs example does not use a broad regexp" "$s"

# --- packaging: the tarball is reproducible, its .sha256 holds -----------------
tag="ai-toolbox-gates--v$(python3 -I -c "import json,sys;print(json.load(open(sys.argv[1]))['plugins']['ai-toolbox-gates']['version'])" "$here/scripts/plugin-versions.json")"
bash "$PR" "$tag" "$t/p1" >/dev/null 2>&1; bash "$PR" "$tag" "$t/p2" >/dev/null 2>&1
h1="$(sha256sum "$t/p1/$tag.tar.gz" 2>/dev/null | cut -d' ' -f1)"; h2="$(sha256sum "$t/p2/$tag.tar.gz" 2>/dev/null | cut -d' ' -f1)"
check "building the tarball twice gives the same digest" "$([ -n "$h1" ] && [ "$h1" = "$h2" ]; echo $?)" "$h1 vs $h2"
(cd "$t/p1" && sha256sum -c "$tag.tar.gz.sha256" >/dev/null 2>&1); s=$?
check "the .sha256 file matches the tarball" "$s"
echo x >>"$t/p1/$tag.tar.gz"; (cd "$t/p1" && sha256sum -c "$tag.tar.gz.sha256" >/dev/null 2>&1); s=$?
negcheck "an altered tarball fails its .sha256" "$s"

# --- cosign: a stub that signs and verifies by sha256 -------------------------
mkdir -p "$t/bin" "$t/rel"
cat >"$t/bin/cosign" <<'STUB'
#!/usr/bin/env bash
# stub: records its arguments; sign-blob writes the artifact's sha256 into the
# bundle; verify-blob passes only for a bundle that holds the artifact's sha256
echo "$*" >>"${STUB_LOG:-/dev/null}"
mode="$1"; shift; bundle=""; art=""
while [ $# -gt 0 ]; do case "$1" in
  --bundle) bundle="$2"; shift 2;;
  --certificate-identity|--certificate-identity-regexp|--certificate-oidc-issuer|--key) shift 2;;
  --yes) shift;; *) art="$1"; shift;; esac; done
case "$mode" in
  sign-blob) sha256sum "$art" | cut -d' ' -f1 >"$bundle";;
  verify-blob) [ -f "$bundle" ] && grep -q "$(sha256sum "$art" | cut -d' ' -f1)" "$bundle";;
  *) exit 2;;
esac
STUB
chmod +x "$t/bin/cosign"
# run a command with a clean environment plus the given VAR=value pairs
cl() { env -i PATH="$t/bin:$PATH" STUB_LOG="$t/log" "$@"; }
ISS=COSIGN_OIDC_ISSUER=https://gitlab.example.invalid
ID=COSIGN_CERT_IDENTITY=https://gitlab.example.invalid/g/p//.gitlab-ci.yml@refs/tags/ai-toolbox-skills--v0.1.0
A="$t/rel/a.tar.gz"
echo payload >"$A"

cl SIGSTORE_ID_TOKEN=tok bash "$SR" "$A" >"$t/o" 2>&1; s=$?
check "sign-release.sh signs with the OIDC token" "$s" "$(cat "$t/o")"
check "keyless signing passes no --key" "$(grep -q -- '--key' "$t/log"; [ $? -ne 0 ]; echo $?)"
echo b >"$t/rel/b.tar.gz"; cl bash "$SR" "$t/rel/b.tar.gz" >"$t/o" 2>&1; s=$?
negcheck "signing with no token and no key fails closed" "$s"
: >"$t/log"; cl COSIGN_PRIVATE_KEY=k COSIGN_PASSWORD=p bash "$SR" "$t/rel/b.tar.gz" >"$t/o" 2>&1; s=$?
check "key mode signs" "$s" "$(cat "$t/o")"
check "key mode reads the key from the environment" "$(grep -q -- '--key env://COSIGN_PRIVATE_KEY' "$t/log"; echo $?)"

cl $ISS $ID bash "$VR" "$A" >"$t/o" 2>&1; s=$?
check "a correctly signed artifact verifies with the exact identity" "$s" "$(cat "$t/o")"
check "the exact identity and the issuer reach cosign" "$(grep -q -- 'verify-blob --certificate-identity https://gitlab.example.invalid/g/p//.gitlab-ci.yml@refs/tags/ai-toolbox-skills--v0.1.0 --certificate-oidc-issuer https://gitlab.example.invalid' "$t/log"; echo $?)"
# M1: the same, validly signed artifact, with only the identity variables removed
cl bash "$VR" "$A" >"$t/o" 2>&1; s=$?
negcheck "a signed artifact with no signing identity configured fails" "$s" "$(cat "$t/o")"
check "that failure is the missing identity, not the signature" "$(grep -q 'no signing identity' "$t/o"; echo $?)" "$(cat "$t/o")"
cl $ISS bash "$VR" "$A" >"$t/o" 2>&1; s=$?
negcheck "an issuer alone is not an identity" "$s"
# the identity is derived in a tag pipeline
: >"$t/log"
cl $ISS CI_SERVER_URL=https://gitlab.example.invalid CI_PROJECT_PATH=g/p CI_COMMIT_TAG=ai-toolbox-skills--v0.1.0 bash "$VR" "$A" >"$t/o" 2>&1; s=$?
check "in a tag pipeline the identity is derived" "$s" "$(cat "$t/o")"
check "the derived identity is the exact tag pipeline" "$(grep -q -- '--certificate-identity https://gitlab.example.invalid/g/p//.gitlab-ci.yml@refs/tags/ai-toolbox-skills--v0.1.0 ' "$t/log"; echo $?)"
# M3: the regexp fallback is refused unless anchored and not a wildcard
for re in '.*' '^.*$' '^(.*)$' 'https://gitlab.example.invalid/.*' '^$' ; do
  cl $ISS "COSIGN_CERT_IDENTITY_REGEXP=$re" bash "$VR" "$A" >"$t/o" 2>&1; s=$?
  negcheck "the identity regexp '$re' is refused" "$s" "$(cat "$t/o")"
done
cl $ISS 'COSIGN_CERT_IDENTITY_REGEXP=^https://gitlab\.example\.invalid/g/p//\.gitlab-ci\.yml@refs/tags/ai-toolbox-skills--v[0-9.]+$' bash "$VR" "$A" >"$t/o" 2>&1; s=$?
check "an anchored, specific regexp is accepted" "$s" "$(cat "$t/o")"
# key mode
: >"$t/log"; echo pub >"$t/pub.key"
cl COSIGN_PUBLIC_KEY="$t/pub.key" bash "$VR" "$A" >"$t/o" 2>&1; s=$?
check "a public key verifies key-signed artifacts" "$s" "$(cat "$t/o")"
check "key mode passes --key" "$(grep -q -- "verify-blob --key $t/pub.key" "$t/log"; echo $?)"
# the unsigned and tampered negative cases
cp "$A" "$t/rel/u.tar.gz"
cl $ISS $ID bash "$VR" "$t/rel/u.tar.gz" >"$t/o" 2>&1; s=$?
negcheck "an unsigned artifact (no bundle) fails verification" "$s"
check "that failure says unsigned" "$(grep -q 'unsigned' "$t/o"; echo $?)"
cp "$A" "$t/rel/t.tar.gz"; cp "$A.bundle" "$t/rel/t.tar.gz.bundle"; echo tampered >>"$t/rel/t.tar.gz"
cl $ISS $ID bash "$VR" "$t/rel/t.tar.gz" >"$t/o" 2>&1; s=$?
negcheck "a tampered artifact fails verification" "$s"
check "that failure says the signature does not verify" "$(grep -q 'does not verify' "$t/o"; echo $?)"
# install-cosign.sh: the version variable may carry its leading v or not; the
# URL names the release once (pipeline 1089 asked for vv3.1.4 and got 404).
mkdir -p "$t/cbin"
cat >"$t/cbin/curl" <<'STUB'
#!/usr/bin/env bash
out=""; while [ $# -gt 0 ]; do case "$1" in -o) out="$2"; shift;; http*) echo "$1" >>"$CURL_LOG";; esac; shift; done
echo cosign-stub >"$out"
STUB
chmod +x "$t/cbin/curl"
sum="$(echo cosign-stub | sha256sum | cut -d' ' -f1)"
for ver in v3.1.4 3.1.4; do
  : >"$t/curl.log"
  env PATH="$t/cbin:$PATH" CURL_LOG="$t/curl.log" COSIGN_VERSION="$ver" COSIGN_SHA256="$sum"     COSIGN_DEST="$t/cosign" bash scripts/install-cosign.sh >"$t/o" 2>&1; s=$?
  check "install-cosign.sh installs with COSIGN_VERSION=$ver" "$s" "$(cat "$t/o")"
  check "install-cosign.sh asks for release v3.1.4 given $ver"     "$(grep -q '/releases/download/v3.1.4/cosign-linux-amd64$' "$t/curl.log"; echo $?)" "$(cat "$t/curl.log")"
done
exit $rc
