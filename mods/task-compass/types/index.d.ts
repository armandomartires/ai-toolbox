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
  /** 0-based line of the item in GOALS.md. */
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
}

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

declare module 'claude-code' {
  interface PluginState {
    'task-compass': {
      sprints: Sprint[]
      focus: Focus | null
      tasks: Task[]
      agents: AgentRow[]
      now: number
      /** The full path GOALS.md was last looked for at. */
      goalsPath: string
      /** The key of the dot whose card a click opened; null when none is. */
      openCard: string | null
      /** The first sprint the carousel shows once the person scrolled it; null follows the current sprint. */
      railStart: number | null
    }
  }
}
