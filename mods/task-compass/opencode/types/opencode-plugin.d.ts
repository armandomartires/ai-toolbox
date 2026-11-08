/**
 * Only what task-compass uses of OpenCode's plugin API, declared by hand: no
 * npm install here. Mirrors @opencode-ai/plugin 1.18.30's dist/index.d.ts,
 * dist/tool.d.ts and dist/tui.d.ts as found under ~/.config/opencode/
 * node_modules on 2026-11-08 (the package OpenCode itself installs there).
 * The `slots.register` argument is @opentui/solid's SolidPlugin, which is not
 * on this host; its shape here ({ order, slots }) is unverified.
 * OpenCode 2.x's documented `@opencode/plugin` (`Plugin.define`) is another
 * API: re-read before moving to it (docs/development/mod-workflow.md).
 */
declare module '@opencode-ai/plugin' {
  type Schema<T> = {
    describe(text: string): Schema<T>
    optional(): Schema<T | undefined>
  }
  export type ToolContext = { sessionID: string; directory: string; worktree: string }
  export type ToolDefinition = {
    description: string
    args: Record<string, Schema<unknown>>
    execute(args: Record<string, unknown>, context: ToolContext): Promise<string>
  }
  export function tool<A extends Record<string, Schema<unknown>>>(input: {
    description: string
    args: A
    execute(args: { [K in keyof A]: A[K] extends Schema<infer T> ? T : never }, context: ToolContext): Promise<string>
  }): ToolDefinition
  export namespace tool {
    const schema: { string(): Schema<string> }
  }
  export type PluginInput = { directory: string; worktree: string }
  export type Hooks = { tool?: Record<string, ToolDefinition> }
  export type Plugin = (input: PluginInput, options?: Record<string, unknown>) => Promise<Hooks>
}

declare module '@opencode-ai/plugin/tui' {
  type RGBA = unknown
  export type TuiThemeCurrent = {
    readonly text: RGBA
    readonly textMuted: RGBA
    readonly info: RGBA
    readonly warning: RGBA
    readonly error: RGBA
    readonly success: RGBA
  }
  export type TuiSlotContext = { theme: { readonly current: TuiThemeCurrent } }
  export type TuiPluginApi = {
    state: { readonly path: { directory: string; worktree: string } }
    slots: {
      register(plugin: {
        order?: number
        slots: { sidebar_content?: (ctx: TuiSlotContext, props: { session_id: string }) => unknown }
      }): string
    }
  }
  export type TuiPlugin = (api: TuiPluginApi, options?: Record<string, unknown>) => Promise<void>
}
