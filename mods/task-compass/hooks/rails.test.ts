import { expect, test } from 'claude-code/testing'

import { parseSprints } from './model'
import { carousel, columnRows, daysLeft, focusOf, isLate, progressBar } from './rails'
import type { ColumnContext } from './rails'

const GOALS = `## Sprint 1 — Setup
Dates: 2026-10-19 → 2026-10-26
- [x] One
- [x] Two
- [x] Three
- [x] Four
- [>] Five
  The one being worked on

## Sprint 2 — Next
Dates: 2026-10-27 → 2026-11-06
- [x] Done one
- [ ] Open one
`

const DAY = 86_400_000
const at = (date: string) => Date.parse(date) + 9 * 3_600_000

const context = (over: Partial<ColumnContext> = {}): ColumnContext => ({
  isCurrent: true,
  focusId: undefined,
  isGuess: false,
  declared: null,
  tasks: [],
  room: 40,
  opened: null,
  inner: 20,
  nowMs: 0,
  ...over,
})

test('a sprint shows its progress and whether it ran past its end', () => {
  const [setup, next] = parseSprints(GOALS)
  expect(progressBar(setup!)).toBe('▰▰▰▰▱ 4/5')
  expect(progressBar(next!)).toBe('▰▰▰▱▱ 1/2')
  expect(daysLeft(next!, at('2026-11-04'))).toBe(2)
  expect(daysLeft(next!, at('2026-11-06'))).toBe(0)
  expect(daysLeft(next!, at('2026-11-09'))).toBe(-3)
  expect(daysLeft(next!, 0)).toBeUndefined()
  expect(isLate(setup!, at('2026-10-28'))).toBe(true)
  expect(isLate(next!, at('2026-10-28'))).toBe(false)

  // The progress line under the sprint's dot, red and marked once late.
  const late = columnRows(setup!, context({ nowMs: at('2026-10-28') }))[1]
  expect(late?.text).toBe('▰▰▰▰▱ 4/5 LATE')
  expect(late?.textColor).toBe('red')
  expect(columnRows(next!, context({ nowMs: at('2026-10-28') }))[1]?.text).toBe('▰▰▰▱▱ 1/2')
  // The sprint's card says how long is left.
  const card = columnRows(next!, context({ nowMs: at('2026-11-04') }))[0]?.card
  expect(card?.lines.map(line => line.text)).toContain('2 days left')
})

test('a long column folds its leading done stories, an open card counted', () => {
  const [setup] = parseSprints(GOALS)
  const texts = (ctx: ColumnContext) => columnRows(setup!, ctx).map(row => row.text)
  // 12 rows: the dot, its progress and five stories spaced by rails. Nothing folds.
  const closed = texts(context({ room: 12 }))
  expect(closed).toContain('One')
  expect(closed.filter(text => text === '')).toHaveLength(5)
  // Story 1.5's open card takes eight rows of its own, so the same room folds.
  const opened = texts(context({ room: 12, opened: 'st1.5' }))
  expect(opened).not.toContain('One')
  expect(opened).toContain('4 stories done')
})

test('the carousel centres the current sprint until scrolled, within the ends', () => {
  expect(carousel(72, 5, 2, null)).toMatchObject({ count: 3, first: 1, centred: 1, later: 1, columnWidth: 24, cardWidth: 22 })
  expect(carousel(72, 5, 2, 0)).toMatchObject({ first: 0, later: 2 })
  expect(carousel(72, 5, 2, 9)).toMatchObject({ first: 2, later: 0 })
  expect(carousel(44, 3, 0, null)).toMatchObject({ count: 2, first: 0 })
})

test('the story worked on is the named one, else the one in progress', () => {
  const sprints = parseSprints(GOALS)
  expect(focusOf(sprints, null, [])).toMatchObject({ cur: 0, focusId: '1.5', isGuess: false })
  expect(focusOf(sprints, { story: '2.2' }, [])).toMatchObject({ focusId: '2.2' })
  // A finished story named earlier gives way to the one in progress.
  expect(focusOf(sprints, { story: '2.1' }, []).focusId).toBe('1.5')
})

test('days count from the clock day, not the hour', () => {
  const [, next] = parseSprints(GOALS)
  expect(daysLeft(next!, Date.parse('2026-11-05') + DAY - 1)).toBe(1)
})
