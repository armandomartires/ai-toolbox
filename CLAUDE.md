@AGENTS.md

# Claude Code notes

Claude-only facts; everything shared lives in AGENTS.md (ADR-0061).

- Path-scoped rules are in `.claude/rules/` (tracked); the rest of `.claude/` is ignored.
- Skills and agents reach Claude Code through `scripts/install.sh`, not by editing `~/.claude` by hand.
