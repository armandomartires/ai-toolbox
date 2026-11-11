#!/usr/bin/env bash
# Sign a release file with cosign (TASK-0283). Run only by the release job.
# Usage: sign-release.sh FILE   (writes FILE.bundle)
#   keyless (default): the OIDC token in SIGSTORE_ID_TOKEN is the identity
#   key: COSIGN_PRIVATE_KEY (masked, protected CI variable holding the key
#        text) and COSIGN_PASSWORD; cosign reads the key from the environment
# The repository holds neither.
set -euo pipefail
f="${1:-}"
[ -f "$f" ] || { echo "usage: sign-release.sh FILE" >&2; exit 2; }
command -v cosign >/dev/null 2>&1 || { echo "FAIL cosign is not installed" >&2; exit 1; }
if [ -n "${COSIGN_PRIVATE_KEY:-}" ]; then
  cosign sign-blob --yes --key env://COSIGN_PRIVATE_KEY --bundle "$f.bundle" "$f"
else
  [ -n "${SIGSTORE_ID_TOKEN:-}" ] || { echo "FAIL no signing identity: no SIGSTORE_ID_TOKEN (id_tokens) and no COSIGN_PRIVATE_KEY" >&2; exit 1; }
  cosign sign-blob --yes --bundle "$f.bundle" "$f"
fi
