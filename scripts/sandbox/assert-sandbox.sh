#!/usr/bin/env bash
# assert-sandbox.sh - refuse to run unless this process is in a throwaway
# container with no host home mount and no host credentials (issue #11).
# Run first in every unattended job. Exit 1 names each failed check.
set -u
fail=0
no() { echo "SANDBOX: $*"; fail=1; }

[ -f /.dockerenv ] || grep -qE 'docker|containerd|kubepods' /proc/1/cgroup 2>/dev/null \
  || [ "${SANDBOX_ASSUME_CONTAINER:-}" = 1 ] || no "not inside a container"
# No bind mount of a host home directory, docker socket or SSH agent.
if awk '{print $2}' /proc/mounts | grep -qE '^/(home|Users)(/|$)|^/root/\.(ssh|config|vault)'; then
  no "a host home path is mounted: $(awk '{print $2}' /proc/mounts | grep -E '^/(home|Users)|^/root/\.' | tr '\n' ' ')"
fi
for s in /var/run/docker.sock /run/docker.sock; do [ -S "$s" ] && no "docker socket is mounted: $s"; done
[ -d /var/lib/docker ] && no "/var/lib/docker is present"
[ -n "${SSH_AUTH_SOCK:-}" ] && no "SSH agent forwarded"
# No credential material lying around in the container's own home.
for p in "$HOME/.ssh" "$HOME/.config/vault" "$HOME/.vault-token" "$HOME/.aws" "$HOME/.netrc" "$HOME/.git-credentials"; do
  [ -e "$p" ] && no "credential path present: $p"
done
for v in VAULT_TOKEN GITLAB_TOKEN GITHUB_TOKEN GITLAB_PUSH_TOKEN CI_JOB_TOKEN XAI_API_KEY OPENAI_API_KEY; do
  [ -n "${!v:-}" ] && no "credential variable set: $v"
done
[ $fail -eq 0 ] && echo "assert-sandbox: OK (container, no home mount, no host credentials)"
exit $fail
