import type { EngineInterface, RenderInput } from 'claude-code'

import type { Task, TaskStatus } from '../types'
import { isHandedOff, tokensText } from './ledger'
import { color, kit, recall } from './sigma'
import type { Token } from './sigma'

/** One task as `/orchestrate` draws it. */
export type TaskView = {
  id: string
  role: string
  status: TaskStatus
  requested: string
  observed: string
  next: string
  /** Waiting on the coordinator's own call: drawn as HANDOFF in amber, not as the blocked state it is stored as. */
  handoff?: boolean
  /** The second line under the row: why it waits or stopped, its retry count, tokens and branch. Bounded. */
  detail?: string
}

/** The most characters of a reason or blocker a panel row draws: the desktop's draw has a size limit, so every row's text is bounded. */
export const DETAIL_CAP = 120

const clip = (text: string, cap = DETAIL_CAP): string => (text.length > cap ? `${text.slice(0, cap - 1)}…` : text)

/**
 * One task as the panel draws it. `blocker` is what `blockerFor` says of a queued task: why it waits and how to unblock it.
 * A blocked task's reason is drawn too; a retry is `retry n/<max>`; the tokens and the session's branch follow when known.
 */
export const taskView = (task: Task, blocker: string | undefined, maxRetries: number): TaskView => {
  const next = task.report?.next?.trim() || task.reason || ''
  const why = task.status === 'queued' ? blocker : task.status === 'blocked' ? task.reason : undefined
  const detail = [
    ...(why && why !== next ? [clip(why.replace(/\s+/g, ' '))] : []),
    ...(task.retries > 0 ? [`retry ${task.retries}/${maxRetries}`] : []),
    ...(task.tokens !== undefined ? [`${tokensText(task.tokens)} tok`] : []),
    ...(task.branch ? [`branch ${clip(task.branch, 60)}`] : []),
  ].join(' · ')
  const settings = (one?: { model: string; effort: string }) => (one ? `${one.model}/${one.effort}` : '?')
  return {
    id: task.id,
    role: task.role,
    status: task.status,
    requested: settings(task.requested),
    observed: task.observed ? settings(task.observed) : task.resolvedModel ? `${task.resolvedModel}, effort unverified` : 'unverified',
    next: clip(next, 200),
    ...(isHandedOff(task) ? { handoff: true } : {}),
    ...(detail ? { detail } : {}),
  }
}

/** One routing-table row. */
export type RouteView = { taskClass: string; role: string; settings: string; gated?: string }

/**
 * What `/orchestrate status` and `/orchestrate routing` answered, kept under
 * their text so the row draws as SIGMAorbital panels. The text, which the
 * model reads too, is unchanged.
 */
export type OrchestrateOutput = {
  isOn: boolean
  policy: string
  coordinator?: string
  /** The coordinator's own effort, or `unknown`: shown beside its model. */
  coordinatorEffort?: string
  run?: { word: string; why: string }
  tasks?: TaskView[]
  overrides?: string[]
  routes?: RouteView[]
  limits?: string
}

/** A task's state as a colour and a glyph: running cyan, queued text-2, done text-1, failed red, held amber. */
export const STATE: Record<TaskStatus | 'idle' | 'done' | 'handoff', { token: Token; glyph: string }> = {
  queued: { token: 'text-2', glyph: '○' },
  running: { token: 'cyan', glyph: '●' },
  completed: { token: 'text-1', glyph: '●' },
  done: { token: 'text-1', glyph: '●' },
  partial: { token: 'amber', glyph: '▲' },
  blocked: { token: 'amber', glyph: '▲' },
  handoff: { token: 'amber', glyph: '⇄' },
  failed: { token: 'red', glyph: '◆' },
  cancelled: { token: 'text-3', glyph: '○' },
  idle: { token: 'text-3', glyph: '○' },
}

const stateOf = (word: string) => STATE[word as TaskStatus] ?? STATE.idle

/** The status line: `ORCH BALANCED · 2 RUNNING · 1 QUEUED`. */
export const statusLineText = (policy: string, running: number, queued: number) =>
  `ORCH ${policy.toUpperCase()} · ${running} RUNNING · ${queued} QUEUED`

/**
 * `/orchestrate`'s row as panels: the run and its tasks, the routing table,
 * the overrides; none for a row this session did not answer (a resume, a
 * reload), which the engine draws as text. A declaration: the engine follows
 * `$` past an import only into one.
 */
export function renderOutput($: EngineInterface, e: RenderInput<'CommandOutput'>) {
  if (e.props.isErrored) return undefined
  const out = recall<OrchestrateOutput>(e.props.text)
  if (out === undefined) return undefined
  const ui = $.ui.resolve(e)
  const { Box, Text } = ui
  const { label, panel, value } = kit(ui, e.surface)
  const width = Math.min(96, e.viewport?.columns ?? 96)
  const state = (word: string) => (
    <Box flexDirection="row" flexShrink={0}>
      <Text color={color(stateOf(word).token)}>{stateOf(word).glyph}</Text>
      <Text color={color(stateOf(word).token)} size="caption">{` ${word.toUpperCase()}`}</Text>
    </Box>
  )

  return (
    <Box flexDirection="column" rowGap={1}>
      {panel(
        { title: 'Orchestrator', code: `${out.isOn ? 'on' : 'off'} · ${out.policy}`, width },
        <Box flexDirection="column">
          {out.run && (
            <Box flexDirection="row" columnGap={2}>
              {label('Run')}
              {state(out.run.word)}
              <Text color={color('text-2')} wrap="truncate-end">{out.run.why}</Text>
            </Box>
          )}
          {out.coordinator && (
            <Box flexDirection="row" columnGap={2}>
              {label('Coordinator')}
              {value(out.coordinator)}
              <Text color={color('text-2')}>{`effort ${out.coordinatorEffort ?? 'unknown'}`}</Text>
            </Box>
          )}
          {out.tasks && out.tasks.length === 0 && <Text color={color('text-3')}>No task in the ledger.</Text>}
          {out.tasks?.map(task => (
            <Box flexDirection="column">
              <Box flexDirection="row" columnGap={2}>
                <Box width={10} flexShrink={0}>{value(task.id)}</Box>
                <Box width={14} flexShrink={0}>{label(task.role)}</Box>
                {state(task.handoff ? 'handoff' : task.status)}
                <Text color={color('text-3')} size="caption" tabular wrap="truncate-end">{`${task.requested} → ${task.observed}`}</Text>
              </Box>
              {task.next !== '' && <Text color={color('text-2')} wrap="truncate-end">{`  ${task.next}`}</Text>}
              {task.detail !== undefined && <Text color={color('text-3')} wrap="truncate-end">{`  ${task.detail}`}</Text>}
            </Box>
          ))}
        </Box>,
      )}
      {out.routes &&
        panel(
          { title: 'Routing', code: out.policy, width },
          <Box flexDirection="column">
            {out.limits && <Text color={color('text-3')} size="caption">{out.limits.toUpperCase()}</Text>}
            {out.routes.map(one => (
              <Box flexDirection="row" columnGap={2}>
                <Box width={14} flexShrink={0}>{label(one.taskClass)}</Box>
                <Box width={16} flexShrink={0}>
                  <Text color={color('text-2')}>{one.role}</Text>
                </Box>
                {value(one.settings)}
                {one.gated !== undefined && state('blocked')}
              </Box>
            ))}
          </Box>,
        )}
      {out.overrides &&
        panel(
          { title: 'Overrides in force', code: 'disclosed, not changed', width },
          <Box flexDirection="column">
            {out.overrides.map(one => (
              <Text color={color('text-2')} wrap="truncate-end">{one}</Text>
            ))}
          </Box>,
        )}
    </Box>
  )
}
