import { atom, read } from 'claude-code'
import type { EngineInterface, On, RenderInput } from 'claude-code'

import { fit, iconOf, isEnded, ledgerBadge, memberTone, progressOf } from './model'
import { isOrchWorker, workersOf } from './sessions'
import { color, elapsed, kit } from './sigma'
import { stateGlyph, stateTone } from './sunburst'
import { PANE, TITLE } from './names'

// The same $.state values register.tsx writes: the engine lists a module's
// reads and writes from atoms declared in that file.
const agents = atom({ plugin: 'agent-watch', key: 'agents' } as const, [])
const frame = atom({ plugin: 'agent-watch', key: 'frame' } as const, 0)
const now = atom({ plugin: 'agent-watch', key: 'now' } as const, 0)
const tasks = atom({ plugin: 'agent-watch', key: 'tasks' } as const, [])
const runs = atom({ plugin: 'agent-watch', key: 'runs' } as const, [])
const tones = atom({ plugin: 'agent-watch', key: 'tones' } as const, {})
// task-orchestrator's ledger, read and never written (types/index.d.ts, the mirror).
const ledger = atom({ plugin: 'task-orchestrator', key: 'ledger' } as const, [])

/** The widest the meter grows; it shrinks with the band. */
const BAR_MAX = 20

/** The state a ledger task is drawn in: the Sessions panel's own words, so its glyph and colour are the panel's. */
const taskState = (status: string) => (status === 'queued' ? 'pending' : status)

/**
 * The one task every queued task waits on, when there is one: each queued
 * task's unfinished dependencies are that task alone.
 */
const waitOf = (all: readonly { id: string; status: string; deps: string[] }[], queued: readonly { deps: string[] }[]) => {
  const pending = queued.map(task => task.deps.filter(dep => all.find(other => other.id === dep)?.status !== 'completed'))
  const first = pending[0]?.[0]
  return first !== undefined && pending.every(deps => deps.length === 1 && deps[0] === first) ? first : undefined
}

/**
 * The meter and the running agents' glyphs: a meter of the task list's
 * progress, cyan while it tracks and text-1 once done, the step in progress,
 * and the glyph of each running agent, pulsing, in the tone of the session
 * that owns it. The one drawing both the band above the prompt and the
 * contribution to Compass's pane call (ADR-0048); undefined while there is no
 * task list and no agent runs. A declaration: the engine follows `$` past an
 * import only into one.
 */
export async function drawMeter($: EngineInterface, e: RenderInput<'AbovePrompt'> | RenderInput<'Pane'>) {
  const [list, rows, tick, at, all, held, orchTasks] = await Promise.all([
    read($, tasks),
    read($, agents),
    read($, frame),
    read($, now),
    read($, runs),
    read($, tones),
    read($, ledger),
  ])
  const running = rows.filter(row => row.status === 'running')
  const { done, total, current } = progressOf(list)
  const isRun = orchTasks.some(task => !isEnded(task))
  if (total === 0 && running.length === 0 && !isRun) return undefined

  const ui = $.ui.resolve(e as RenderInput<'AbovePrompt'>)
  const { Box, Button, Text } = ui
  const { label, meter, value } = kit(ui, e.surface)
  const cols = Math.max(20, e.props.bodyColumns)
  const width = Math.min(BAR_MAX, Math.max(5, Math.floor(cols / 4)))
  const count = `${done}/${total}`
  // Done only when nothing runs: a finished list with an agent still working is not done.
  const isDone = total > 0 && done === total && running.length === 0
  const sessions = { rows, runs: all, tones: held, tasks: list, ledger: orchTasks }
  // A glyph opens its agent's transcript in the main view; the step text
  // opens the Agents pane. No hotkeys: a bare digit in an empty composer
  // would press one.
  const icons = running.map(row => (
    <Button key={`band-agent-${row.id}`} plain onPress={() => void $.ui.view({ agentId: row.id })}>
      <Text color={color(memberTone(sessions, row.id))}>{`${iconOf('agent', row.status, tick)} `}</Text>
    </Button>
  ))
  const openPane = () => void $.ui.open({ id: PANE, title: TITLE })

  if (isRun) {
    // The orchestrator's run is what the band follows: a mark per ledger task in the Sessions panel's own glyphs and colours, done of all, the task running, and what waits.
    const cap = Math.max(5, Math.floor(cols / 3))
    const firstOpen = orchTasks.findIndex(task => !isEnded(task))
    const from = Math.min(Math.max(0, firstOpen - Math.floor(cap / 3)), Math.max(0, orchTasks.length - cap))
    const shown = orchTasks.slice(from, from + cap)
    const marks = shown.map(task => {
      const text = <Text color={color(stateTone(taskState(task.status), ledgerBadge(task.status)))}>{stateGlyph(taskState(task.status), ledgerBadge(task.status))}</Text>
      // A running mark opens its agent's transcript.
      return task.status === 'running' && task.agentId !== undefined ? (
        <Button key={`band-agent-${task.agentId}`} plain onPress={() => void $.ui.view({ agentId: task.agentId })}>
          {text}
        </Button>
      ) : (
        <Box key={`band-mark-${task.id}`}>{text}</Box>
      )
    })
    const finished = orchTasks.filter(isEnded).length
    const tally = `${finished}/${orchTasks.length}`
    const live = orchTasks.filter(task => task.status === 'running')
    const queued = orchTasks.filter(task => task.status === 'queued')
    const waitOn = waitOf(orchTasks, queued)
    const first = live[0]
    const time = first?.startedAt !== undefined ? elapsed(at - first.startedAt) : ''
    const head = first === undefined ? '' : `${first.id} · ${first.role}`
    const full = first === undefined ? '' : `${head} · ${first.objective}`
    // Agents outside the run keep their glyphs and count.
    const workers = workersOf(orchTasks)
    const others = running.filter(row => !isOrchWorker(row, workers))
    const otherIcons = others.map(row => (
      <Button key={`band-agent-${row.id}`} plain onPress={() => void $.ui.view({ agentId: row.id })}>
        <Text color={color(memberTone(sessions, row.id))}>{`${iconOf('agent', row.status, tick)} `}</Text>
      </Button>
    ))
    const otherWidth = others.length === 0 ? 0 : others.length * 2 + `${others.length} running`.length
    const tails = [
      [live.length > 1 ? `+${live.length - 1} RUNNING` : '', queued.length > 0 ? `${queued.length} QUEUED${waitOn !== undefined ? ` · WAIT ON ${waitOn}` : ''}` : ''],
      [live.length > 1 ? `+${live.length - 1} RUNNING` : '', queued.length > 0 ? `${queued.length} QUEUED` : ''],
      [],
    ].map(parts => parts.filter(part => part !== '').join(' · '))
    const used = (tail: string) => {
      const parts = [shown.length, tally.length + 6, ...(time === '' ? [] : [time.length]), ...(tail === '' ? [] : [tail.length]), ...(otherWidth === 0 ? [] : [otherWidth])]
      return parts.reduce((sum, part) => sum + part, 0) + parts.length - 1
    }
    // The objective is cut first, then the wait, then the queue; the line never wraps.
    const fits = (tail: string) => cols - used(tail) - 1 - 1 >= head.length
    const tail = tails.find(fits) ?? ''
    const name = first === undefined ? '' : fit(full, Math.max(4, cols - used(tail) - 2))

    return (
      <Box flexDirection="row" columnGap={1}>
        <Box flexShrink={0} flexDirection="row">
          {marks}
        </Box>
        {value(tally, 'tasks')}
        {name !== '' && (
          <Button key="band-step" plain onPress={openPane}>
            <Text color={color('text-2')} wrap="truncate-end">{name}</Text>
          </Button>
        )}
        {time !== '' && (
          <Text color={color('text-3')} size="caption" tabular>{time}</Text>
        )}
        {tail !== '' && (
          <Button key={name === '' ? 'band-step' : 'band-queue'} plain onPress={openPane}>
            <Text color={color('text-3')} size="caption" wrap="truncate-end">{tail}</Text>
          </Button>
        )}
        {others.length > 0 && (
          <Box flexShrink={0} flexDirection="row">
            {otherIcons}
            {label(`${others.length} running`)}
          </Box>
        )}
      </Box>
    )
  }
  const room = cols - width - count.length - 6 - running.length * 2 - 12
  const step = isDone ? 'ALL DONE' : current ? fit(current, Math.max(8, room)) : ''

  return (
    <Box flexDirection="row">
      {total > 0 && (
        <Box flexShrink={0} flexDirection="row" columnGap={1} marginRight={1}>
          {meter(done, total, width, isDone ? 'text-1' : 'cyan')}
          {value(count, 'steps')}
        </Box>
      )}
      {step !== '' && (
        <Button key="band-step" plain onPress={openPane}>
          <Text color={color(isDone ? 'text-3' : 'text-2')} wrap="truncate-end">{step}</Text>
        </Button>
      )}
      {running.length > 0 && (
        <Box flexShrink={0} flexDirection="row" marginLeft={total > 0 ? 1 : 0}>
          {icons}
          {label(`${running.length} running`)}
        </Box>
      )}
    </Box>
  )
}

/** The band above the prompt: `drawMeter`, or what the engine draws while a survey holds the band. */
export const registerBand = (on: On) =>
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    return (await drawMeter($, e)) ?? next(e)
  })
