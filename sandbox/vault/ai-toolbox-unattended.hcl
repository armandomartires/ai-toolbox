# PROPOSED, NOT APPLIED (issue #11, Level 1). Apply by hand per
# docs/security/unattended-sandbox.md, after infra #96 is fixed.
#
# Policy: ai-toolbox-unattended-ro
# Read-only access for unattended CI runs to the project's secrets.
# Assumes `sigmarecon-projects` is a KV v2 mount (data/ and metadata/ prefixes).

path "sigmarecon-projects/data/ai-toolbox/*" {
  capabilities = ["read"]
}

# metadata read only (versions); no "list", so the job cannot enumerate the
# names of all project secrets.
path "sigmarecon-projects/metadata/ai-toolbox/*" {
  capabilities = ["read"]
}

# Explicit deny on operator secrets. `deny` wins over any other policy
# attached to the same token, so a later broad grant cannot widen this.
path "operator/*" {
  capabilities = ["deny"]
}
path "sigmarecon-projects/data/operator/*" {
  capabilities = ["deny"]
}
path "sigmarecon-projects/metadata/operator/*" {
  capabilities = ["deny"]
}
path "sigmarecon-projects/data/ai-toolbox/operator/*" {
  capabilities = ["deny"]
}
