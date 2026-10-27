import { expect, test } from 'claude-code/testing'
import type { AgentInfo } from 'claude-code'

import type { AgentRow } from '../types'
import {
  activityLine,
  alertText,
  applyPlan,
  callEnded,
  callStarted,
  endedBadly,
  groupAgents,
  HUES,
  iconOf,
  markAlerted,
  mergeListed,
  nested,
  nextHue,
  outcomeOf,
  progressOf,
  runningText,
  spawnedRow,
  summarizeCall,
  tokensOf,
  turnCounted,
} from './model'

const row = (id: string, status: string, hue = 0, more: Partial<AgentRow> = {}): AgentRow => ({
  id,
  type: 'Explore',
  description: id,
  status,
  startedAt: 0,
  hue,
  calls: 0,
  tokens: 0,
  ...more,
})

test('agents are grouped into running and completed, newest first', () => {
  const groups = groupAgents([
    row('a', 'completed'),
    row('b', 'running'),
    row('c', 'pending'),
    row('d', 'failed'),
    row('e', 'idle'),
    row('f', 'killed'),
    row('g', 'waiting'),
  ])
  expect(groups.running.map(one => one.id)).toEqual(['g', 'e', 'c', 'b'])
  expect(groups.completed.map(one => one.id)).toEqual(['f', 'd', 'a'])
})

test('each new agent takes the least used hue', () => {
  expect(nextHue([])).toBe(0)
  expect(nextHue([row('a', 'running', 0)])).toBe(1)
  const full = Array.from({ length: HUES }, (_, i) => row(`a${i}`, 'running', i))
  expect(nextHue(full)).toBe(0)
  expect(nextHue([...full, row('b', 'running', 0)])).toBe(1)
})

test('a spawn opens a running row that keeps its hue when listed', () => {
  const spawned = spawnedRow([row('a', 'completed', 0)], { id: 'b', type: 'Plan', description: 'plan it' }, 10)
  expect(spawned[1]).toMatchObject({ id: 'b', status: 'running', startedAt: 10, hue: 1 })

  const listed: AgentInfo[] = [
    { id: 'b', type: 'Plan', description: 'plan it', status: 'completed' },
    { id: 'c', type: 'Explore', description: 'look', status: 'running', parentId: 'b' },
  ]
  const merged = mergeListed(spawned, listed, 25)
  expect(merged.find(one => one.id === 'b')).toMatchObject({ status: 'completed', startedAt: 10, endedAt: 25, hue: 1 })
  expect(merged.find(one => one.id === 'c')).toMatchObject({ status: 'running', startedAt: 25, hue: 2, parentId: 'b' })
  // A row the list no longer names stays, and an end time is kept once set.
  expect(mergeListed(merged, [], 99).map(one => one.id)).toEqual(['a', 'b', 'c'])
  expect(mergeListed(merged, [listed[0]!], 99).find(one => one.id === 'b')?.endedAt).toBe(25)
})

test('rows nest under the parent that spawned them', () => {
  const tree = nested([row('a', 'running'), row('b', 'running', 0, { parentId: 'a' }), row('c', 'running', 0, { parentId: 'zz' })])
  expect(tree.map(one => [one.row.id, one.depth])).toEqual([
    ['a', 0],
    ['b', 1],
    ['c', 0],
  ])
})

test('an agent keeps its own glyph; it pulses only while it runs, and an unfinished end is a badge', () => {
  expect(iconOf(HUES, 'completed', 0)).toBe(iconOf(0, 'completed', 0))
  expect(iconOf(1, 'completed', 0)).not.toBe(iconOf(0, 'completed', 0))
  // Running: solid on an even frame, hollow on an odd one.
  expect(iconOf(0, 'running', 0)).toBe('■')
  expect(iconOf(0, 'running', 1)).toBe('□')
  expect(iconOf(1, 'running', 2)).toBe('⬢')
  // Waiting to run: hollow and still. Ended: solid and still.
  expect(iconOf(0, 'pending', 1)).toBe('□')
  expect(iconOf(0, 'pending', 2)).toBe('□')
  expect(iconOf(0, 'completed', 1)).toBe('■')
  expect(iconOf(0, 'failed', 1)).toBe('■')
  expect([outcomeOf('completed'), outcomeOf('failed'), outcomeOf('killed'), outcomeOf('running')]).toEqual([
    undefined,
    { status: 'critical', word: 'FAILED' },
    { status: 'offline', word: 'STOPPED' },
    undefined,
  ])
})

test('update_plan items, advance, done and start follow the app', () => {
  let list = applyPlan([], {
    items: [
      { content: 'a', status: 'in_progress' },
      { content: 'b', status: 'pending' },
      { content: 'c', status: 'pending' },
    ],
  })
  expect(progressOf(list)).toEqual({ done: 0, total: 3, current: 'a' })
  list = applyPlan(list, { advance: true })
  expect(list.map(task => task.status)).toEqual(['completed', 'in_progress', 'pending'])
  list = applyPlan(list, { done: [2], start: 3 })
  expect(progressOf(list)).toEqual({ done: 2, total: 3, current: 'c' })
})

test('a call is summarized by its main argument, and the row counts it', () => {
  expect(summarizeCall('Bash', { command: 'ls  -la\n  /tmp' })).toEqual({ tool: 'Bash', detail: 'ls -la /tmp' })
  expect(summarizeCall('Read', { file_path: '/p/a.ts' })).toEqual({ tool: 'Read', detail: '/p/a.ts' })
  expect(summarizeCall('Grep', { pattern: 'x' }).detail).toBe('x')
  expect(summarizeCall('Agent', { description: 'look' }).detail).toBe('look')
  expect(summarizeCall('TodoWrite', { todos: [] }).detail).toBe('')
  expect(summarizeCall('Bash', { command: 'a'.repeat(50) }, 10).detail).toBe('aaaaaaaaa…')

  let rows = [row('a', 'running')]
  rows = callStarted(rows, 'a', { tool: 'Bash', detail: 'ls', since: 100 })
  expect(activityLine(rows[0]!, 1_000)).toBe('Bash: ls · 0 CALLS')
  expect(activityLine(rows[0]!, 9_100)).toBe('Bash: ls (9s) · 0 CALLS')
  rows = callEnded(rows, 'a')
  expect(rows[0]).toMatchObject({ calls: 1, activity: undefined })
  expect(callEnded(rows, 'zz')).toEqual(rows)
  expect(tokensOf({ input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 })).toBe(1200)
  expect(tokensOf({ input_tokens: 5 })).toBe(5)
  expect(tokensOf(undefined)).toBe(0)
  rows = turnCounted(rows, 'a', 1200, 'm1')
  expect(rows[0]).toMatchObject({ tokens: 1200, model: 'm1' })
  expect(activityLine(rows[0]!, 0)).toBe('1 CALL · 1.2k TOK')
  expect(activityLine(turnCounted(rows, 'a', 2_000_000)[0]!, 0)).toBe('1 CALL · 2M TOK')
  // The fields survive a list merge, and the activity leaves with the status.
  const merged = mergeListed(rows, [{ id: 'a', type: 'Explore', description: 'a', status: 'completed' }], 5)
  expect(merged[0]).toMatchObject({ calls: 1, tokens: 1200, model: 'm1', activity: undefined })
  expect(spawnedRow([], { id: 'b', type: 'Plan', description: 'p', model: 'm2' }, 1)[0]).toMatchObject({ model: 'm2', calls: 0, tokens: 0 })
})

test('a failed or stopped agent is alerted once', () => {
  const before = [row('a', 'running'), row('b', 'running'), row('c', 'completed')]
  const after = [row('a', 'failed'), row('b', 'killed'), row('c', 'failed'), row('d', 'failed')]
  expect(endedBadly(before, after).map(one => one.id)).toEqual(['a', 'b', 'd'])
  const marked = markAlerted(after, ['a', 'b', 'd'])
  expect(endedBadly(after, marked)).toEqual([])
  expect(alertText({ ...row('a', 'failed'), startedAt: 0, endedAt: 72_000 })).toBe('EXPLORE · a · FAILED 00:01:12')
  expect(alertText({ ...row('b', 'killed'), startedAt: 0, endedAt: 5_000 })).toBe('EXPLORE · b · STOPPED 00:00:05')
  expect([runningText(0), runningText(1), runningText(2)]).toEqual([undefined, '1 AGENT RUNNING', '2 AGENTS RUNNING'])
})
