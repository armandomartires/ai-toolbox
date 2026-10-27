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
}

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
