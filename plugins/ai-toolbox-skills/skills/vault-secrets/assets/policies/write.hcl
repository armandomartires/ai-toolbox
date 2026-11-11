# @@MOUNT@@-write: a human writer of this project's secrets (ADR-0034).
# No delete or destroy: every overwrite stays a recoverable version.
path "@@MOUNT@@/data/*" {
  capabilities = ["create", "read", "update"]
}
path "@@MOUNT@@/metadata/*" {
  capabilities = ["read", "list"]
}
