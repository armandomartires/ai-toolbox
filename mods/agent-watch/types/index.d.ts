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
  /** What SendMessage addresses it by; a task-orchestrator worker's is its task id. */
  name?: string
  /** The plugin whose spawn started it, as `$.agent.list()` says. */
  spawnedBy?: string
  /** The Workflow run it belongs to: `agent.spawn`'s `workflow.runId`. */
  runId?: string
  /** Its `AgentStatus` word; a word the mod does not know is shown as is. */
  status: string
  startedAt: number
  /** Set once the status left the active ones. */
  endedAt?: number
  /** The model it resolved to, from the spawn's answer. */
  model?: string
  /** Tool calls that ended in its loop. */
  calls: number
  /** Tokens of its turns so far, the four usage counts summed. */
  tokens: number
  /** The tool call in flight in its loop, if any. */
  activity?: Activity
  /** Its own task list, from the task tools called in its loop. */
  tasks?: Task[]
  /** Set once its failure or stop was toasted; on the row, so it survives a hot reload. */
  isAlerted?: true
}

/** A tool call in flight: the tool, its main argument cut short, and when it started. */
export type Activity = { tool: string; detail: string; since: number }

export type TaskStatus = 'pending' | 'in_progress' | 'completed'

/** One step of Claude's live task list, as the band counts it. */
export type Task = { id: string; text: string; status: TaskStatus }

/** A Workflow tool run: a sub-session whose members are the agents its script starts. */
export type WorkflowRun = {
  /** The run's id, `wf_...`. */
  id: string
  /** The script's `meta.name`; `workflow` until the tool's result names it. */
  name: string
  /** The loop whose Workflow call started it; absent for the main loop. */
  ownerId?: string
  startedAt: number
}

// MIRROR of mods/task-orchestrator/types/index.d.ts, its one owner: the part of
// its contract agent-watch reads, and never writes. Each `Orch<Name>` below is
// the owner's `<Name>`, every field copied verbatim, so a change there fails
// the gate (scripts/check-mods.py, rule 8) until this agrees.
export type OrchPolicy = 'economy' | 'balanced' | 'quality'

export type OrchRole =
  | 'utility'
  | 'scout'
  | 'investigator'
  | 'documentation'
  | 'builder'
  | 'tester'
  | 'reviewer'
  | 'planner'
  | 'debugger'
  | 'risk-reviewer'
  | 'frontier-specialist'

export type OrchTaskStatus = 'queued' | 'running' | 'completed' | 'partial' | 'blocked' | 'failed' | 'cancelled'

export type OrchSettings = { model: string; effort: string }

export type OrchTask = {
  id: string
  role: OrchRole
  objective: string
  deps: string[]
  status: OrchTaskStatus
  requested: OrchSettings
  observed?: OrchSettings & { at: number }
  agentId?: string
  createdAt: number
  startedAt?: number
  endedAt?: number
}

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
      /** The Workflow runs of the session, oldest first. */
      runs: WorkflowRun[]
      /** Each sub-session's tone, an index into SESSION_TONES, fixed when it first became one. */
      tones: Record<string, number>
    }
    'task-orchestrator': {
      enabled: boolean
      policy: OrchPolicy
      ledger: OrchTask[]
    }
  }
}
