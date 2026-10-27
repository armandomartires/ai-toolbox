// The $.state contract: every $.state key a hooks module reads or writes is
// declared here, under the mod's plugin name. The file exports types only.

/** One subagent of the session, as the pane shows it. */
export type AgentRow = {
  /** The engine's id, as `$.agent.list()` and the loop's events carry it. */
  id: string
  /** The agent whose loop spawned it; absent when the main loop did. */
  parentId?: string
  /** The type it was spawned as: `Explore`, `general-purpose`, ... */
  type: string
  /** The Agent call's few-word description of its task. */
  description: string
  /** Its `AgentStatus` word; a word the mod does not know is shown as is. */
  status: string
  startedAt: number
  /** Set once the status left the active ones. */
  endedAt?: number
  /** Its place in the palette, fixed when it was first seen. */
  hue: number
  /** The model it resolved to, from the spawn's answer. */
  model?: string
  /** Tool calls that ended in its loop. */
  calls: number
  /** Tokens of its turns so far, the four usage counts summed. */
  tokens: number
  /** The tool call in flight in its loop, if any. */
  activity?: Activity
  /** Set once its failure or stop was toasted; on the row, so it survives a hot reload. */
  isAlerted?: true
}

/** A tool call in flight: the tool, its main argument cut short, and when it started. */
export type Activity = { tool: string; detail: string; since: number }

export type TaskStatus = 'pending' | 'in_progress' | 'completed'

/** One step of Claude's live task list, as the band counts it. */
export type Task = { id: string; text: string; status: TaskStatus }

declare module 'claude-code' {
  interface PluginState {
    'agent-watch': {
      agents: AgentRow[]
      /** The clock the elapsed times are drawn against. */
      now: number
      /** The animation frame, moved on a tick while an agent runs. */
      frame: number
      /** Claude's live task list, from TodoWrite, TaskCreate/TaskUpdate or the desktop app's plan. */
      tasks: Task[]
    }
  }
}
