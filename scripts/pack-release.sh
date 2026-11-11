#!/usr/bin/env bash
# Pack one plugin into a reproducible tarball (TASK-0283).
# Usage: pack-release.sh TAG OUTDIR   (TAG is <plugin>--v<version>)
# Writes OUTDIR/TAG.tar.gz and OUTDIR/TAG.tar.gz.sha256 (relative name, so
# `cd OUTDIR && sha256sum -c TAG.tar.gz.sha256` works). Sorted entries, fixed
# mtime and owner, gzip -n: the same tree gives the same bytes.
set -euo pipefail
tag="${1:-}"; out="${2:-}"
[ -n "$tag" ] && [ -n "$out" ] || { echo "usage: pack-release.sh TAG OUTDIR" >&2; exit 2; }
root="$(cd "$(dirname "$0")/.." && pwd)"
plugin="${tag%%--v*}"
[ -d "$root/plugins/$plugin" ] || { echo "FAIL no plugin folder plugins/$plugin" >&2; exit 1; }
mkdir -p "$out"
art="$out/$tag.tar.gz"
tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner -C "$root/plugins" -cf - "$plugin" | gzip -n > "$art"
(cd "$out" && sha256sum "$tag.tar.gz" > "$tag.tar.gz.sha256")
echo "packed $art"
