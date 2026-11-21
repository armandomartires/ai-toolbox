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

/** Where the board comes from: GOALS.md, a project-workflow `.ai/` layer, or a forge's state card. */
export type Source = 'goals' | 'ai' | 'forge'

/** The card a forge project shows instead of a board: `20.PLAN.md` read by `forgeState`, with where it came from. */
export type ForgeCard = {
  tracker: 'gitlab' | 'github' | ''
  /** The project's path on the forge, from `tracker.conf`. */
  path: string
  /** The full path of the `20.PLAN.md` it was read from. */
  where: string
  updated?: string
  current: string[]
  milestone?: string
  board?: string
  blocked: string[]
  next: string[]
  history: string[]
  tag?: string
  hasSections: boolean
  /** The plan file is missing: the card says so. */
  isMissing?: boolean
  /** The GOALS.md copies found beside a forge's plan, which its convention forbids; never read or drawn as a board. */
  strays: string[]
  /** Why no card can be drawn: set when `tracker.conf` is invalid or the plan cannot be read, with `tracker` and `path` empty and `where` the text the panel shows. */
  error?: string
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed'

export type Task = { id: string; text: string; status: TaskStatus }

/** The story Claude declared it is working on. */
export type Focus = { story: string; why?: string }

declare module 'claude-code' {
  interface PluginState {
    'task-compass': {
      sprints: Sprint[]
      focus: Focus | null
      tasks: Task[]
      now: number
      /** The full path GOALS.md was last looked for at; for `.ai/`, its root. */
      goalsPath: string
      /** Which board is shown. */
      source: Source
      /** The forge card shown when `source` is `forge`; null otherwise. */
      forge: ForgeCard | null
      /** The key of the dot whose card a click opened; null when none is. */
      openCard: string | null
      /** The first sprint the carousel shows once the person scrolled it; null follows the current sprint. */
      railStart: number | null
      /** The numbers of the sprints folded to their header, progress and toggle; the rest show their stories. */
      foldedSprints: number[]
      /** The rows the person dragged this mod's panels' bodies to, by pane, handle and surface (sigma.tsx `heldOf`); a panel not listed sizes itself (ADR-0053). */
      panelRows: Record<string, number>
    }
  }
}
