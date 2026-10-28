import { expect, test } from 'claude-code/testing'

import type { AgentRow, OrchTask } from '../types'
import { LINGER_MS, shownRows, subagentRows } from './model'

const agent = (id: string, over: Partial<AgentRow> = {}): AgentRow => ({
  id,
  type: 'Explore',
  description: `look ${id}`,
  status: 'running',
  startedAt: 100,
  ...over,
})

const task = (id: string, over: Partial<OrchTask> = {}): OrchTask => ({
  id,
  role: 'builder',
  objective: `do ${id}`,
  deps: [],
  status: 'running',
  requested: { model: 'sonnet', effort: 'medium' },
  createdAt: 50,
  startedAt: 100,
  ...over,
})

test('an empty ledger leaves the agents as listed, with their depth', () => {
  const rows = subagentRows([agent('a'), agent('b', { parentId: 'a' })], [], 1_000)
  expect(rows.map(row => [row.label, row.depth, row.isActive])).toEqual([
    ['Explore · look a', 0, true],
    ['Explore · look b', 1, true],
  ])
})

test('a task joins its agent by agentId and the agent is not drawn again', () => {
  const rows = subagentRows([agent('a'), agent('b')], [task('T1', { agentId: 'a' })], 1_000)
  expect(rows.map(row => row.label)).toEqual(['T1 · builder · do T1', 'Explore · look b'])
  expect(rows[0]).toMatchObject({ agentId: 'a', status: 'running', isActive: true, settings: 'sonnet/medium' })
})

test('tasks come first in ledger order, then the unclaimed agents', () => {
  const rows = subagentRows([agent('x'), agent('a')], [task('T2', { agentId: 'a' }), task('T1', { status: 'queued', startedAt: undefined })], 1_000)
  expect(rows.map(row => row.key)).toEqual(['task-T2', 'task-T1', 'x'])
})

test('a queued task waits hollow on its deps, with no settings and no time', () => {
  const [row] = subagentRows([], [task('T3', { status: 'queued', deps: ['T1', 'T2'], startedAt: undefined })], 1_000)
  expect(row).toMatchObject({ status: 'pending', waits: ['T1', 'T2'], settings: undefined, startedAt: undefined, isActive: true })
})

test('observed settings win over requested', () => {
  const [row] = subagentRows([], [task('T1', { observed: { model: 'opus', effort: 'high', at: 120 } })], 1_000)
  expect(row?.settings).toBe('opus/high')
})

test('a running task takes its agent row status, else running', () => {
  expect(subagentRows([agent('a', { status: 'waiting' })], [task('T1', { agentId: 'a' })], 1_000)[0]?.status).toBe('waiting')
  expect(subagentRows([], [task('T1', { agentId: 'a' })], 1_000)[0]?.status).toBe('running')
})

test('an ended task is completed, with the ledger word as its badge', () => {
  const words = (status: OrchTask['status']) => {
    const [row] = subagentRows([], [task('T1', { status, endedAt: 900 })], 1_000)
    return [row?.status, row?.isActive, row?.badge]
  }
  expect(words('completed')).toEqual(['completed', false, undefined])
  expect(words('partial')).toEqual(['completed', false, { status: 'caution', word: 'PARTIAL' }])
  expect(words('blocked')).toEqual(['completed', false, { status: 'caution', word: 'BLOCKED' }])
  expect(words('failed')).toEqual(['completed', false, { status: 'critical', word: 'FAILED' }])
  expect(words('cancelled')).toEqual(['completed', false, { status: 'offline', word: 'CANCELLED' }])
})

test('an ended task lingers, then goes; one with no endedAt stays', () => {
  const ended = task('T1', { status: 'failed', endedAt: 1_000 })
  expect(subagentRows([], [ended], 1_000 + LINGER_MS - 1)).toHaveLength(1)
  expect(subagentRows([], [ended], 1_000 + LINGER_MS)).toHaveLength(0)
  expect(subagentRows([], [task('T2', { status: 'failed' })], 1_000 + LINGER_MS * 5)).toHaveLength(1)
})

test('the cap never cuts a ledger task, only the unclaimed agents', () => {
  const tasks = Array.from({ length: 7 }, (_, i) => task(`T${i + 1}`))
  const rows = subagentRows([agent('x'), agent('y')], tasks, 1_000)
  const shown = shownRows(rows, 6)
  expect(shown.map(row => row.key)).toEqual(tasks.map(one => `task-${one.id}`))
  expect(shownRows(subagentRows([agent('x'), agent('y')], tasks.slice(0, 5), 1_000), 6).map(row => row.key)).toEqual([
    'task-T1', 'task-T2', 'task-T3', 'task-T4', 'task-T5', 'y',
  ])
})

test('with an empty ledger the cap is the old newest-six of the agents', () => {
  const agents = Array.from({ length: 9 }, (_, i) => agent(`a${i}`))
  expect(shownRows(subagentRows(agents, [], 1_000), 6).map(row => row.key)).toEqual(['a3', 'a4', 'a5', 'a6', 'a7', 'a8'])
})

test('a running task whose agent failed or was stopped shows it; the ledger word wins', () => {
  const badge = (agentStatus: AgentRow['status'], over: Partial<OrchTask> = {}) =>
    subagentRows([agent('a', { status: agentStatus })], [task('T1', { agentId: 'a', ...over })], 1_000)[0]?.badge
  expect(badge('failed')).toEqual({ status: 'critical', word: 'FAILED' })
  expect(badge('killed')).toEqual({ status: 'offline', word: 'STOPPED' })
  expect(badge('running')).toBeUndefined()
  expect(badge('failed', { status: 'completed', endedAt: 900 })).toBeUndefined()
  expect(badge('killed', { status: 'blocked', endedAt: 900 })).toEqual({ status: 'caution', word: 'BLOCKED' })
})
