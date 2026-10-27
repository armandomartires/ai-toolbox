// The $.state contract: every $.state key the hooks modules read or write is
// declared here, under the mod's plugin name. The file exports types only;
// the unions are owned here and the hooks modules import them.

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export type Policy = 'economy' | 'balanced' | 'quality'

export type Role =
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

export type TaskClass =
  | 'extraction'
  | 'lookup'
  | 'exploration'
  | 'documentation'
  | 'implementation'
  | 'testing'
  | 'review'
  | 'architecture'
  | 'debugging'
  | 'risk-review'
  | 'frontier'

export type TaskStatus = 'queued' | 'running' | 'completed' | 'partial' | 'blocked' | 'failed' | 'cancelled'

export type Settings = { model: string; effort: string }

/** The labelled lines a worker ends its answer with. */
export type Report = {
  status: 'completed' | 'partial' | 'blocked' | 'failed' | 'unknown'
  findings: string
  files: string
  checks: string
  evidence: string
  risks: string
  next: string
}

/** One row of the ledger. */
export type Task = {
  id: string
  taskClass: TaskClass
  role: Role
  objective: string
  description: string
  deps: string[]
  /** Paths a writer may change; empty means the whole checkout. */
  allowedFiles: string[]
  isWriter: boolean
  /** Runs in a git worktree of its own, so it may write beside another writer. */
  isolated: boolean
  status: TaskStatus
  requested: Settings
  /** The model core resolved the alias to, from the spawn's answer. */
  resolvedModel?: string
  /** What the first `turn.step` of the worker's loop carried. */
  observed?: Settings & { at: number }
  agentId?: string
  retries: number
  escalations: number
  createdAt: number
  startedAt?: number
  endedAt?: number
  /** HEAD when an isolated worker started: what its worktree holds. */
  baseRevision?: string
  report?: Report
  /** Why the task is blocked, failed or cancelled when no report says. */
  reason?: string
  /** Every substitution the router made. */
  notes: string[]
  /** The whole assignment, kept to start a queued task later; never audited. */
  prompt: string
}

/** A setting or variable that outranks or alters a worker's requested settings. */
export type Override = {
  source: 'settings' | 'env'
  key: string
  value: string
  effect: string
}

declare module 'claude-code' {
  interface PluginState {
    'task-orchestrator': {
      /** Whether orchestration is on: dispatch works, workers are fenced. */
      enabled: boolean
      /** The policy in force. */
      policy: Policy
      /** The task ledger. */
      ledger: Task[]
      /** What was found in settings and environment at session start. */
      overrides: Override[]
      /** Model aliases or ids a spawn refused this session. */
      unavailable: string[]
    }
  }
}
