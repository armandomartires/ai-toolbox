# Agents

Role definitions: one directory per role, `agents/<role>/agent.md`. Copy
from `agents/_template/`.

A role declares its capability boundary in **abstract terms** and is
**emitted** per client — never symlinked, because the two clients' formats
differ in syntax and semantics. Rules, the capability vocabulary, and why
emission works this way: `docs/development/authoring-guide.md` under
"Agents" (ADR-0018).
