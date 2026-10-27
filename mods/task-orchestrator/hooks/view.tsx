import type { EngineInterface, RenderInput } from 'claude-code'

import type { TaskStatus } from '../types'
import { color, kit, recall } from './sigma'
import type { Token } from './sigma'

/** One task as `/orchestrate` draws it. */
export type TaskView = { id: string; role: string; status: TaskStatus; requested: string; observed: string; next: string }

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
  run?: { word: string; why: string }
  tasks?: TaskView[]
  overrides?: string[]
  routes?: RouteView[]
  limits?: string
}

/** A task's state as a colour and a glyph: running cyan, queued text-2, done text-1, failed red, held amber. */
export const STATE: Record<TaskStatus | 'idle' | 'done', { token: Token; glyph: string }> = {
  queued: { token: 'text-2', glyph: '○' },
  running: { token: 'cyan', glyph: '●' },
  completed: { token: 'text-1', glyph: '●' },
  done: { token: 'text-1', glyph: '●' },
  partial: { token: 'amber', glyph: '▲' },
  blocked: { token: 'amber', glyph: '▲' },
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
            </Box>
          )}
          {out.tasks && out.tasks.length === 0 && <Text color={color('text-3')}>No task in the ledger.</Text>}
          {out.tasks?.map(task => (
            <Box flexDirection="column">
              <Box flexDirection="row" columnGap={2}>
                <Box width={10} flexShrink={0}>{value(task.id)}</Box>
                <Box width={14} flexShrink={0}>{label(task.role)}</Box>
                {state(task.status)}
                <Text color={color('text-3')} size="caption" tabular wrap="truncate-end">{`${task.requested} → ${task.observed}`}</Text>
              </Box>
              {task.next !== '' && <Text color={color('text-2')} wrap="truncate-end">{`  ${task.next}`}</Text>}
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
