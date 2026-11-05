// The $.state contract: every $.state key a hooks module reads or writes is
// declared here, under the mod's plugin name. The file exports types only.

/** How many times /hello has answered in this session. */
export type Greeted = number

declare module 'claude-code' {
  interface PluginState {
    'my-mod': {
      greeted: Greeted
    }
  }
}
