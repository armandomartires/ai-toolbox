/** The six board statuses a sprint, a story or a live task can be in. */
export type Status = 'backlog' | 'todo' | 'in_progress' | 'review' | 'blocked' | 'done'

/** One story of a sprint: a top-level list item under the sprint's heading. */
export type Story = {
  /** `<sprint>.<story>`, both 1-based in file order: `3.2`. */
  id: string
  title: string
  status: Status
  /** The indented lines under the item, shown in its hover card. */
  details: string[]
  /** 0-based line of the item in GOALS.md; for a `.ai/` brief, of its status. */
  line: number
}

/** One `##` section of GOALS.md. */
export type Sprint = {
  n: number
  title: string
  goal: string
  dates: string
  /** From a `Status:` line, else derived from the stories. */
  status: Status
  stories: Story[]
  /** How the pane names it, `S087`; `S<n>` when absent. */
  label?: string
  /** A `.ai/` sprint the roadmap marks open and that has a task not done. */
  isOpen?: boolean
  /** How many of its stories carry a status the pane does not know. */
  unknown?: number
}

/** Where the board comes from: GOALS.md, or a project-workflow `.ai/` layer. */
export type Source = 'goals' | 'ai'

export type TaskStatus = 'pending' | 'in_progress' | 'completed'

export type Task = { id: string; text: string; status: TaskStatus }

/** The story Claude declared it is working on. */
export type Focus = { story: string; why?: string }

export type AgentRow = {
  id: string
  parentId?: string
  type: string
  description: string
  status: string
  startedAt: number
  endedAt?: number
}

// MIRROR of mods/agent-watch/types/index.d.ts, its one owner: the part of its
// contract task-compass reads, and never writes. Each `Watch<Name>` below is
// the owner's `<Name>`, every field copied verbatim, so a change there fails
// the gate (scripts/check-mods.py, rule 8) until this agrees.
/** One subagent of the session, as the pane shows it. */
export type WatchAgentRow = {
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
  /** Set when its own `turn.complete` ended it, so a list that lags does not reopen it. */
  isTurnEnded?: true
  /** A teammate: its turn ends in `idle`, not an end, so only the list ends it. */
  isTeammate?: true
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
  activity?: WatchActivity
  /** Its own task list, from the task tools called in its loop. */
  tasks?: WatchTask[]
  /** Set once its failure or stop was toasted; on the row, so it survives a hot reload. */
  isAlerted?: true
}

/** A tool call in flight: the tool, its main argument cut short, and when it started. */
export type WatchActivity = { tool: string; detail: string; since: number }

export type WatchTaskStatus = 'pending' | 'in_progress' | 'completed'

/** One step of Claude's live task list, as the band counts it. */
export type WatchTask = { id: string; text: string; status: WatchTaskStatus }

/** A Workflow tool run: a sub-session whose members are the agents its script starts. */
export type WatchWorkflowRun = {
  /** The run's id, `wf_...`. */
  id: string
  /** The script's `meta.name`; `workflow` until the tool's result names it. */
  name: string
  /** The loop whose Workflow call started it; absent for the main loop. */
  ownerId?: string
  startedAt: number
}

// MIRROR of mods/task-orchestrator/types/index.d.ts, its one owner: the part of
// its contract task-compass reads, and never writes. Each `Orch<Name>` below is
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
      agents: WatchAgentRow[]
      now: number
      frame: number
      tasks: WatchTask[]
      runs: WatchWorkflowRun[]
      tones: Record<string, number>
    }
    'task-orchestrator': { enabled: boolean; policy: OrchPolicy; ledger: OrchTask[] }
    'task-compass': {
      sprints: Sprint[]
      focus: Focus | null
      tasks: Task[]
      agents: AgentRow[]
      now: number
      /** The full path GOALS.md was last looked for at; for `.ai/`, its root. */
      goalsPath: string
      /** Which board is shown. */
      source: Source
      /** The key of the dot whose card a click opened; null when none is. */
      openCard: string | null
      /** The first sprint the carousel shows once the person scrolled it; null follows the current sprint. */
      railStart: number | null
      /** The key of the Sessions row a press selected (an arc, a session or an agent); null selects none and the panel shows this session. */
      selected: string | null
      /** The Sessions hierarchy list is folded to this session's row and its toggle (the chart, KPI row and SELECTED stay). */
      listCollapsed: boolean
      /** The numbers of the sprints folded to their header, progress and toggle; the rest show their stories. */
      foldedSprints: number[]
    }
  }
}
