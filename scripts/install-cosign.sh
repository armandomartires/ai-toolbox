#!/usr/bin/env bash
# Install the pinned cosign into /usr/local/bin (TASK-0283). CI only.
# COSIGN_VERSION and COSIGN_SHA256 (the release's checksum for the linux amd64
# binary, from its cosign_checksums.txt) are the human's CI variables; unset
# means the job fails rather than run an unpinned download.
set -euo pipefail
for v in COSIGN_VERSION COSIGN_SHA256; do
  [ -n "${!v:-}" ] || { echo "FAIL $v is not set: the human pins cosign (docs/operations/releases.md)" >&2; exit 1; }
done
dest="${COSIGN_DEST:-/usr/local/bin/cosign}"
curl -sSfL -o "$dest" "https://github.com/sigstore/cosign/releases/download/v${COSIGN_VERSION}/cosign-linux-amd64"
echo "${COSIGN_SHA256}  ${dest}" | sha256sum -c -
chmod +x "$dest"
