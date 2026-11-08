// The $.state contract: every $.state key a hooks module reads or writes is
// declared here, under the mod's plugin name. The file exports types only.

/** What can be turned off: a mod (any plugin), a skill, an MCP server. */
export type Kind = 'mod' | 'skill' | 'connector'

/** A name per kind: what is off, or what the session has seen. */
export type Names = {
  mod: string[]
  skill: string[]
  connector: string[]
}

/** A loaded mod's folder and the `version` its manifest declared when it loaded. */
export type LoadedMod = { root: string; version?: string }

declare module 'claude-code' {
  interface PluginState {
    switchboard: {
      /** What is off in this session's project, mirrored from `$.store` for the pane. */
      off: Names
      /** What the session has seen of each kind, so the pane can list it. */
      seen: Names
      /** The mods switchboard refused as they loaded in this session. */
      refused: string[]
      /** Up to three tool names per MCP server, shown under one named only by an id. */
      hints: Record<string, string>
      /** The pane's sections shown open; the others show their header alone. */
      open: Kind[]
      /** Each mod's topic: the `category` of its plugin.json. A mod with none is not listed and falls under Other. */
      topics: Record<string, string>
      /** The pane's collapsed groups, each `<kind>:<topic>` (`mod:planning`), and `versions` for the Versions section; one not listed shows its rows. */
      closedGroups: string[]
      /** Each mod the session loaded: its folder and manifest version, from `plugin.register` and `CLAUDE_CODE_PLUGIN_DIRS`. */
      loaded: Record<string, LoadedMod>
      /** The session's project root when it holds `mods/<name>/claude` mods; '' otherwise (the Versions section is then not drawn). */
      checkout: string
      /** Each checkout mod's manifest version ('' for none), read from `mods/<name>/claude/.claude-plugin/plugin.json`. */
      manifests: Record<string, string>
      /** The rows the person dragged this mod's panels' bodies to, by pane, handle and surface (sigma.tsx `heldOf`); a panel not listed sizes itself (ADR-0053). */
      panelRows: Record<string, number>
    }
  }
}
