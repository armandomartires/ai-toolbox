# @@MOUNT@@-app: the project's AppRole identity (ADR-0034, as ADR-0031).
# Its own mount only; no delete, no destroy, no Vault configuration.
path "@@MOUNT@@/data/*" {
  capabilities = ["create", "read", "update"]
}
path "@@MOUNT@@/metadata/*" {
  capabilities = ["read", "list"]
}
