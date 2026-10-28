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
    }
  }
}
