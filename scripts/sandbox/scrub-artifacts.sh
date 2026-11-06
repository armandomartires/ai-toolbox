#!/usr/bin/env bash
# scrub-artifacts.sh PATH... - delete any file under PATH that contains the
# value of a variable named in UNATTENDED_SECRETS (issue #11). GitLab masks
# only CI/CD variables, not values fetched from Vault. Never prints a value.
# Exit 0 when clean; exit 3 when a file was removed (the job then fails).
set -u
found=0
for item in ${UNATTENDED_SECRETS:-}; do
  var="${item%%=*}"
  val="${!var:-}"
  [ "${#val}" -ge 4 ] || continue
  while IFS= read -r -d '' f; do
    echo "scrub-artifacts: removed $f (contained the value of $var)"
    rm -f -- "$f"; found=1
  done < <(grep -rlZF -- "$val" "$@" 2>/dev/null)
done
[ $found -eq 0 ] && echo "scrub-artifacts: OK"
[ $found -eq 0 ] || exit 3
