---
name: template-agent
description: One line describing what this role does and when to delegate to it. This drives role selection and renders into one registry cell.
mode: subagent
capabilities:
  - read-only
  - no-delegation
clients:
  - claude-code
  - opencode
# Optional — a tier name, never a client-native model ID:
# model: analyst
---

# Template Agent

You are template-agent. Replace this body with the role's system prompt.

Everything below the frontmatter is emitted verbatim to every client in
`clients`, so it is the only genuinely portable part of a role. Write it as
instructions to the agent, in the second person.

State three things explicitly, because a role that omits them gets used for
work it was not scoped for:

1. **What this role does** — the task it owns, and what "done" looks like.
2. **What it must not do** — the adjacent work that belongs to another
   role, named. Prefer "report the failure to `build`" over "do not fix
   bugs", because the first says where the work goes.
3. **What it reports back** — the shape of its answer, so a caller can tell
   a real result from a plausible one.

Do not restate the `capabilities` list here as if it were instructions. The
capabilities are enforced by the emitted client configuration; repeating
them in prose creates a second owner of the same boundary, which will
drift. Explaining *why* a boundary exists is useful; re-declaring it is not.

Do not write client-native permission or tool-gating syntax anywhere in
this file. Capability boundaries go in the `capabilities` list above, in
abstract terms only. See `docs/development/authoring-guide.md` under
"Agents" for the vocabulary this role may draw on, the exact keys that are
forbidden, and why.
