# Third-party tools

Tools that improve the workflow around this repo's components but are
**deliberately not components of it**. Nothing here is installed, wired,
version-pinned, indexed in `docs/registry.md` or tested by anything in this
repo. This file exists so that a tool which was considered and scoped out
has a written reason, rather than looking like an oversight to the next
reader.

## What belongs here

A tool belongs in this file, rather than in `mcp-servers/` or a
`configs/*/README.md` section, when it **changes the environment the agent
runs in rather than the agent's behaviour**. That is the third row of the
placement rule in
[`authoring-guide.md`](authoring-guide.md#placing-a-third-party-extension);
the reasoning behind it is in
[`ADR-0021`](../../.ai/decisions/0021-third-party-extensions-are-wired-not-vendored.md).

In practice the question that decides it: *if this tool were running, would
an agent behave differently because of what it can now do — or because the
ground moved underneath it?* A skill, a ruleset or an MCP server is the
first. A gateway, a proxy, a runtime or a daemon is the second.

Two things keep this file from becoming a link dump:

- **An entry needs a reason it is not a component**, not just a
  description. If the reason is hard to write, the tool probably belongs in
  one of the other two rows.
- **An entry states its evidence basis.** Nothing here is observed on this
  machine — that is what "not tested by this repo" means — so every claim
  is labelled *vendor doc* with a date, and decays from the day it is
  written.

## omniroute

**Scoped out of the component layer by human decision, 2026-09-16.** All
claims below are *vendor doc / npm metadata*, re-checked **2026-09-23**.
**Nothing here has been installed, run or observed by this repo.**

| | |
|---|---|
| Package | `omniroute` **3.8.50**, MIT — unchanged since 2026-09-16 |
| OpenCode plugin | `@omniroute/opencode-plugin` **0.2.1**, MIT — unchanged since 2026-09-16 |
| Homepage | `https://omniroute.online` |
| Status here | Documented only. Not installed, not wired, not pinned, not in the registry, not smoke-tested |

**What it is.** A local model-provider gateway: a daemon exposing an
OpenAI-compatible endpoint on port **20128** that fronts many upstream
providers, with an API key and a dashboard.

**Why it is not a component.** It replaces *where inference comes from*. It
does not extend what an agent can do the way a skill, a loop, an MCP server
or a role does, so filing it under any of those would invite the question
*"why is this a component?"* with no good answer available. It is also the
only one of the three products this sprint examined that is a **service**
rather than a package — it has a process to keep running, a port to
collide, a key to rotate and a dashboard to log into, none of which this
repo has any way to describe, pin or check.

**Per client, and the two mechanisms are genuinely different:**

- **OpenCode** — `@omniroute/opencode-plugin`, a *provider* plugin. It
  requires the gateway daemon to be already running and an API key
  configured; the plugin is a client of the service, not the service.
- **Claude Code** — **not a plugin at all.** Integration is base-URL
  redirection: you point the client at the local OpenAI-compatible endpoint.
  Optionally it can also be reached as an HTTP MCP server. Anyone
  generalising from the OpenCode instructions will look for a plugin that
  does not exist.

**The caveat worth capturing once.** The OpenCode plugin has an
**`mcpAutoEmit`** option which **writes an `mcp.*` entry into your client
config**. That is a mutation this repo forbids *itself* — agent emission
writes role files into `~/.config/opencode/agents/` and never touches
`opencode.jsonc`, and `scripts/install.sh` never writes a client's MCP
configuration. If you enable `mcpAutoEmit`, know that it edits a file this
repo deliberately leaves alone, and that nothing here will notice, reconcile
or undo it.

**If you install it, that is your decision and your maintenance.** This
repo neither recommends against it nor supports it; it records what it is
and why it sits outside the component layer.
