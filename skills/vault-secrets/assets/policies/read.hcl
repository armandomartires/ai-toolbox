# @@MOUNT@@-read: read this project's secrets, nothing else (ADR-0034).
# Rendered by vault_secrets.py provision; the estate maps it to LDAP readers.
path "@@MOUNT@@/data/*" {
  capabilities = ["read"]
}
path "@@MOUNT@@/metadata/*" {
  capabilities = ["read", "list"]
}
