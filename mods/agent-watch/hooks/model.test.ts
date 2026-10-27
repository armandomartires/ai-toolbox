import { expect, test } from 'claude-code/testing'
import type { AgentInfo } from 'claude-code'

import type { AgentRow } from '../types'
import { applyPlan, bar, colorOf, groupAgents, HUES, iconOf, mergeListed, nested, nextHue, outcomeOf, progressOf, spawnedRow } from './model'

const row = (id: string, status: string, hue = 0, more: Partial<AgentRow> = {}): AgentRow => ({
  id,
  type: 'Explore',
  description: id,
  status,
  startedAt: 0,
  hue,
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

test('an agent keeps its own color and icon; the icon pulses only while it runs', () => {
  expect(colorOf(0)).toBe('suggestion')
  expect(colorOf(HUES)).toBe(colorOf(0))
  expect(colorOf(1)).not.toBe(colorOf(0))
  // Running: solid on an even frame, hollow on an odd one.
  expect(iconOf(0, 'running', 0)).toBe('●')
  expect(iconOf(0, 'running', 1)).toBe('○')
  expect(iconOf(1, 'running', 2)).toBe('◆')
  // Waiting to run: hollow and still. Ended: solid and still.
  expect(iconOf(0, 'pending', 1)).toBe('○')
  expect(iconOf(0, 'pending', 2)).toBe('○')
  expect(iconOf(0, 'completed', 1)).toBe('●')
  expect(iconOf(0, 'failed', 1)).toBe('●')
  expect([outcomeOf('completed'), outcomeOf('failed'), outcomeOf('killed'), outcomeOf('running')]).toEqual(['✓', '✗', '⏹', ''])
})

test('update_plan items, advance, done and start follow the app; the bar fills with them', () => {
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
  expect(bar(2, 3, 6)).toBe('▰▰▰▰▱▱')
  expect(bar(0, 0, 4)).toBe('▱▱▱▱')
  expect(bar(5, 5, 4)).toBe('▰▰▰▰')
})
