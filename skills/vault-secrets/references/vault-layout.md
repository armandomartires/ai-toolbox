# What the Vault side must provide

The loader assumes this layout. It was built by hand on 2026-10-01..03
(ai-toolbox `TASK-0131`), and is written down here so that losing the session
that built it does not lose the layout. **No hostname, address, DN or group
name belongs in this file.** Those live only in Vault's own configuration.

## Transport

- **TLS on the listener**, with a certificate whose SAN covers the name
  clients use. The plain listener is *replaced*, not kept next to it. An
  `http://` request must get *"Client sent an HTTP request to an HTTPS
  server"*.
- The issuing CA's public certificate is what clients pass as
  `VAULT_CACERT`, unless the system trust store already holds it.

## Secrets engine

- **KV version 2 at `kv/`.**
- One path prefix per consuming project. For ai-toolbox that is
  `kv/ai-toolbox/<name>`, with the value in the field `token`; its
  `secrets.map` lists them.

## Policies

`workstation-read` is the only policy a stored token carries:

```hcl
path "kv/data/ai-toolbox/*"           { capabilities = ["read"] }
path "kv/data/sigma-infrastructure/*" { capabilities = ["read"] }
# lets `login` mint the narrow child token from the user's LDAP token
path "auth/token/create"              { capabilities = ["create", "update"] }
```

`secrets-writer` is used only by `put`, through a fresh login that is never
stored:

```hcl
path "kv/data/ai-toolbox/*"               { capabilities = ["create", "update", "read"] }
path "kv/metadata/ai-toolbox/*"           { capabilities = ["list", "read", "delete"] }
path "kv/data/sigma-infrastructure/*"     { capabilities = ["create", "update", "read"] }
path "kv/metadata/sigma-infrastructure/*" { capabilities = ["list", "read", "delete"] }
path "kv/metadata/"                       { capabilities = ["list"] }
```

A token may create children only with policies it holds itself, so granting
`auth/token/create` to `workstation-read` lets no one escalate.

## Authentication

- **The LDAP auth method belongs to the estate's own configuration
  management, not to this skill.** That covers `auth/ldap/config`, its bind
  account, user and group search, and group-to-policy mappings. The loader
  needs only that a user can log in at `auth/ldap/login/<user>`. **Do not
  configure the LDAP method from a consuming repository.** On 2026-10-03 a
  one-time bootstrap from ai-toolbox did, and drifted it from the codified
  configuration (ai-toolbox `TASK-0134`). An earlier version of this file
  even listed those settings as if this skill owned them.
- **What the loader does require of it:**
  - `ldaps://` or `starttls`, with `insecure_tls=false`. Plain `ldap://`
    sends every AD password Vault checks across the network in cleartext.
  - Short tokens: 8 h, 24 h at most. A stored child token can never
    outlive its parent.
- **Personal secrets are mapped per user** (`auth/ldap/users/<name>`), not
  per AD group, so that membership of a broad group grants nothing. The
  owner gets `workstation-read` and `secrets-writer`.

## A codebase's application identity (AppRole)

Added 2026-10-04 (ai-toolbox `TASK-0132`, `ADR-0031`):

```hcl
# policy ai-toolbox-app -- the whole grant; no delete, no destroy
path "kv/data/ai-toolbox/*"     { capabilities = ["create", "read", "update"] }
path "kv/metadata/ai-toolbox/*" { capabilities = ["read", "list"] }
```

- AppRole auth at `approle/`. Role `ai-toolbox` has `token_policies =
  ["ai-toolbox-app"]`, `token_ttl = 10m`, `token_max_ttl = 30m`,
  `secret_id_ttl = 8760h` and `secret_id_num_uses = 0`.
- **The credential** is a JSON file `{role_id, secret_id, secret_id_accessor}`
  at mode 600, under `~/.config/vault/`, never inside a repository. The
  loader refuses it if group or others can read it.
- **Issue one `secret_id` per host:** `POST
  auth/approle/role/ai-toolbox/secret-id`, with admin rights. Then any host
  can be cut off alone.
- **Revoke a host:** `POST
  auth/approle/role/ai-toolbox/secret-id-accessor/destroy` with its accessor.
  The accessor is not secret; it is kept in the file and printed when the
  `secret_id` is issued.
- **The private map** of variables moved out of a local `.env` sits beside
  the credential, also mode 600, and also outside every repository: its
  names describe internal systems.

## Root credential

The root token and unseal keys come from `vault operator init`, and **never
go on a workstation in a folder an agent or a repository can see**. Once LDAP
login works, the root token can be revoked; it is regenerated from the unseal
keys when it is needed again.
