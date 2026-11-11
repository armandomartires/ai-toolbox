#!/usr/bin/env bash
# Verify a release artifact's Sigstore signature (TASK-0283, P2.4, R-07).
# Usage: verify-release.sh ARTIFACT [BUNDLE]   (BUNDLE defaults to ARTIFACT.bundle)
#
# Fails closed: no bundle, no cosign, or no usable signing identity is a
# failure, never a skip. The identity comes from the human's CI variables:
#   key:      COSIGN_PUBLIC_KEY (a path to a public key file)
#   keyless:  COSIGN_OIDC_ISSUER plus ONE identity, in this order
#     1. COSIGN_CERT_IDENTITY, an exact string
#     2. in a tag pipeline (CI_SERVER_URL, CI_PROJECT_PATH, CI_COMMIT_TAG set),
#        derived: $CI_SERVER_URL/$CI_PROJECT_PATH//.gitlab-ci.yml@refs/tags/$CI_COMMIT_TAG
#     3. COSIGN_CERT_IDENTITY_REGEXP, accepted only when written ^...$ and not
#        starting with a wildcard, so it cannot match any identity
# Nothing here signs or holds a secret.
set -uo pipefail
art="${1:-}"
[ -n "$art" ] || { echo "usage: verify-release.sh ARTIFACT [BUNDLE]" >&2; exit 2; }
bundle="${2:-$art.bundle}"
[ -f "$art" ] || { echo "FAIL no artifact: $art" >&2; exit 1; }
[ -f "$bundle" ] || { echo "FAIL unsigned: no bundle at $bundle" >&2; exit 1; }
command -v cosign >/dev/null 2>&1 || { echo "FAIL cosign is not installed" >&2; exit 1; }
if [ -n "${COSIGN_PUBLIC_KEY:-}" ]; then
  id=(--key "$COSIGN_PUBLIC_KEY")
else
  [ -n "${COSIGN_OIDC_ISSUER:-}" ] || { echo "FAIL no signing identity: set COSIGN_OIDC_ISSUER and an identity, or COSIGN_PUBLIC_KEY" >&2; exit 1; }
  if [ -n "${COSIGN_CERT_IDENTITY:-}" ]; then
    id=(--certificate-identity "$COSIGN_CERT_IDENTITY")
  elif [ -n "${CI_SERVER_URL:-}" ] && [ -n "${CI_PROJECT_PATH:-}" ] && [ -n "${CI_COMMIT_TAG:-}" ]; then
    id=(--certificate-identity "$CI_SERVER_URL/$CI_PROJECT_PATH//.gitlab-ci.yml@refs/tags/$CI_COMMIT_TAG")
  elif [ -n "${COSIGN_CERT_IDENTITY_REGEXP:-}" ]; then
    re="$COSIGN_CERT_IDENTITY_REGEXP"
    case "$re" in
      ^*\$) ;;
      *) echo "FAIL identity regexp must be anchored ^...\$: $re" >&2; exit 1 ;;
    esac
    body="${re#^}"; body="${body%\$}"
    case "$body" in
      ""|.\**|\(.\**) echo "FAIL identity regexp starts with a wildcard and would match any identity: $re" >&2; exit 1 ;;
    esac
    id=(--certificate-identity-regexp "$re")
  else
    echo "FAIL no signing identity: set COSIGN_CERT_IDENTITY (exact), or run in a tag pipeline, or set an anchored COSIGN_CERT_IDENTITY_REGEXP" >&2
    exit 1
  fi
  id+=(--certificate-oidc-issuer "$COSIGN_OIDC_ISSUER")
fi
if cosign verify-blob "${id[@]}" --bundle "$bundle" "$art"; then
  echo "verified: $art"
else
  echo "FAIL signature does not verify: $art" >&2
  exit 1
fi
