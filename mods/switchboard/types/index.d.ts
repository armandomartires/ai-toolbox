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
    }
  }
}
