import { expect, test } from 'claude-code/testing'

import { BRIEFS, ROADMAP } from './fixtures/sigma'
import {
  briefName,
  datesOf,
  layoutOf,
  parseRoadmap,
  planSprints,
  rawStatus,
  spaced,
  statusOfRaw,
  taskIdOf,
} from './plan'
import { boardTitle, carousel, columnRows, focusOf, isLate, sprintEnd } from './rails'
import type { ColumnContext } from './rails'

const TASKS = '/q/.ai/tasks'
const briefs = Object.entries(BRIEFS).map(([file, text]) => ({ file, text }))
const board = () => planSprints(parseRoadmap(ROADMAP), briefs, TASKS)
const at = (date: string) => Date.parse(date) + 9 * 3_600_000

const context = (over: Partial<ColumnContext> = {}): ColumnContext => ({
  isCurrent: true,
  focusId: undefined,
  isGuess: false,
  declared: null,
  tasks: [],
  room: 60,
  opened: null,
  inner: 30,
  nowMs: 0,
  ...over,
})

test('the roadmap rows are the sprints, in number order, with their own labels', () => {
  const rows = parseRoadmap(ROADMAP)
  // Every row of the real Sprint history; S083 never existed.
  expect(rows).toHaveLength(88)
  expect(rows.some(row => row.n === 83)).toBe(false)
  // `(open)` counts only in the Dates cell: S005 has it in Commits.
  expect(rows.filter(row => row.isMarkedOpen).map(row => row.n)).toEqual([43, 66, 76, 87, 88, 89])
  const sprints = board()
  expect(sprints.find(one => one.n === 87)).toMatchObject({
    label: 'S087',
    title: 'Net Box Network Model',
    dates: '2026-10-19 →',
  })
  // A theme that only points to a review is no goal.
  expect(sprints.find(one => one.n === 2)?.goal).toBe('')
})

test('open sprints are marked open and have a task not done, and sit together last', () => {
  const sprints = board()
  // S043 is marked open but done; S082 and S001 have tasks not done but are not marked.
  expect(sprints.filter(one => one.isOpen).map(one => one.label)).toEqual(['S087', 'S088', 'S089'])
  expect(sprints.slice(-3).map(one => one.label)).toEqual(['S087', 'S088', 'S089'])
  expect(sprints.find(one => one.n === 43)?.isOpen).toBe(false)
  expect(sprints.find(one => one.n === 82)?.isOpen).toBe(false)
  // The pane centres the middle one, and its caption names them all.
  const { cur } = focusOf(sprints, null, [])
  expect(sprints[cur]?.label).toBe('S088')
  expect(boardTitle(sprints, cur)).toBe('S087–S089 open · 88 sprints')
  // Open sprints apart are listed, not written as a range.
  const apart = sprints.map(one => ({ ...one, isOpen: one.n === 1 || one.n === 89 }))
  expect(boardTitle(apart, cur)).toBe('S001, S089 open · 88 sprints')
  const view = carousel(72, sprints.length, cur, null)
  expect(sprints.slice(view.first, view.first + view.count).map(one => one.label)).toEqual(['S087', 'S088', 'S089'])
  // Centred on the open group even when no open sprint is under way: without
  // S088's done task, the first sprint not done would be S001.
  const quiet = planSprints(
    parseRoadmap(ROADMAP),
    briefs.filter(one => !one.file.startsWith('S088_ProjectVault.T001')),
    TASKS,
  )
  expect(quiet[focusOf(quiet, null, []).cur]?.label).toBe('S088')
})

test('each brief is a story with its own id, its status read from its first words', () => {
  const s087 = board().find(one => one.n === 87)
  expect(s087?.stories.map(story => [story.id, story.status])).toEqual([
    ['S087.T001', 'done'],
    ['S087.T002', 'done'],
    ['S087.T003', 'done'],
    ['S087.T004', 'todo'],
    ['S087.T005', 'todo'],
    ['S087.T006', 'todo'],
    ['S087.T007', 'todo'],
    ['S087.T008', 'blocked'],
  ])
  const t001 = s087?.stories[0]
  expect(t001?.title).toBe('Adr Network Model')
  expect(t001?.details).toEqual([
    'Status: done (2026-10-20), pending the closing MR',
    `${TASKS}/S087_NetBoxNetworkModel.T001_AdrNetworkModel.md`,
  ])
  // The status's own line, where Claude edits it (0-based).
  expect(t001?.line).toBe(2)
  // closed, resolved and complete are done; the change record and the template are no story.
  const s002 = board().find(one => one.n === 2)
  expect(s002?.stories).toHaveLength(8)
  expect(s002?.stories.every(story => story.status === 'done')).toBe(true)
  expect(board().find(one => one.n === 43)?.stories.map(story => story.id)).toEqual([
    'S043.T001',
    'S043.T002',
    'S043.T003',
    'S043.T004',
    'S043.T005',
    'S043.T006',
  ])
})

test('a status the pane does not know stays visible, counted on its sprint', () => {
  const odd = { file: 'S087_NetBoxNetworkModel.T009_Odd.md', text: '# S087.T009\n\n**Status**: parked for now\n' }
  const none = { file: 'S087_NetBoxNetworkModel.T010_Bare.md', text: '# S087.T010\n\nNo status line.\n' }
  const s087 = planSprints(parseRoadmap(ROADMAP), [...briefs, odd, none], TASKS).find(one => one.n === 87)
  expect(s087?.unknown).toBe(2)
  const t009 = s087?.stories.find(story => story.id === 'S087.T009')
  expect(t009?.status).toBe('todo')
  expect(t009?.details[0]).toBe('Status: "parked for now" is not a status the pane knows; shown as To do')
  const card = columnRows(s087!, context())[0]?.card?.lines.map(line => line.text).join(' ')
  expect(card).toContain('2 with a status the pane does not know')
  // A board with nothing unknown says nothing about it.
  const plain = columnRows(board().find(one => one.n === 88)!, context())[0]?.card?.lines.map(line => line.text)
  expect(plain?.some(line => line.includes('does not know'))).toBe(false)
})

test('statuses as people write them map onto the pane\'s six', () => {
  const of = (raw: string) => statusOfRaw(raw)
  expect(of('done (2026-10-15), pending the merge request')).toEqual({ status: 'done', known: true })
  expect(of('resolved 2026-09-09 (S002.T008) — confirmed')).toEqual({ status: 'done', known: true })
  expect(of('closed — superseded by T004')).toEqual({ status: 'done', known: true })
  expect(of('cancelled')).toEqual({ status: 'done', known: true })
  expect(of('not started')).toEqual({ status: 'todo', known: true })
  expect(of('in progress')).toEqual({ status: 'in_progress', known: true })
  expect(of('blocked until 2026-10-30')).toEqual({ status: 'blocked', known: true })
  expect(of('')).toEqual({ status: 'todo', known: false })
  // The first **Status** line within the first 20, its markup stripped.
  expect(rawStatus('# T\n\n**Status**: **complete** — verified\n')).toEqual({ raw: 'complete — verified', line: 2 })
  expect(rawStatus(`${'\n'.repeat(20)}**Status**: done\n`)).toBeUndefined()
})

test('dates read as the pane writes them; a sprint with no end is never late', () => {
  expect(datesOf('2026-10-19 – (open)')).toBe('2026-10-19 →')
  expect(datesOf('2026-09-04 –')).toBe('2026-09-04 →')
  expect(datesOf('2026-09-05 – 2026-09-09')).toBe('2026-09-05 → 2026-09-09')
  expect(datesOf('2026-10-18')).toBe('2026-10-18')
  const s087 = board().find(one => one.n === 87)!
  expect(sprintEnd(s087)).toBeUndefined()
  expect(isLate(s087, at('2026-12-31'))).toBe(false)
  expect(columnRows(s087, context({ nowMs: at('2026-12-31') }))[1]?.text).not.toContain('late')
  // GOALS.md's own forms keep their end: after the arrow, else the last date.
  const goals = (dates: string) => ({ n: 1, title: 'S', goal: '', dates, status: 'todo' as const, stories: [] })
  expect(sprintEnd(goals('2026-10-19 → 2026-10-26'))).toBe('2026-10-26')
  expect(sprintEnd(goals('2026-10-19 to 2026-10-26'))).toBe('2026-10-26')
  expect(sprintEnd(goals('2026-10-18'))).toBe('2026-10-18')
  expect(sprintEnd(goals('2026-10-14 — extended'))).toBe('2026-10-14')
  expect(sprintEnd(goals('2026-10-19 – (open)'))).toBeUndefined()
})

test('the layout declaration, brief names, task ids and titles', () => {
  expect(layoutOf(undefined)).toEqual({ root: '.ai', entrypoint: '00.CONVENTIONS.md' })
  expect(layoutOf('{ "root": ".ai/workflow/", "entrypoint": "AGENTS.md" }')).toEqual({ root: '.ai/workflow', entrypoint: 'AGENTS.md' })
  expect(layoutOf('{ "root": ".ai", "tracker": "files" }')).toEqual({ error: '.ai-layout.json has an unknown key: tracker' })
  expect(layoutOf('{ "root": "/abs" }')).toEqual({ error: '.ai-layout.json root must be relative' })
  expect(layoutOf('{ "root": "./.ai/" }')).toEqual({ root: '.ai', entrypoint: '00.CONVENTIONS.md' })
  expect('error' in layoutOf('{ nope')).toBe(true)

  expect(briefName('S087_NetBoxNetworkModel.T004_SiteToSiteTunnel.md')).toEqual({ sprint: 87, task: 4, name: 'SiteToSiteTunnel' })
  expect(briefName('S012.T003_WorkedExample.md')).toEqual({ sprint: 12, task: 3, name: 'WorkedExample' })
  expect(briefName('S043_IntranetWebHost.T001.change-record.md')).toBeUndefined()
  expect(briefName('0000_TEMPLATE.md')).toBeUndefined()

  expect(['S087.T004', 's87.t4', '87.4', ' S087.T004 '].map(taskIdOf)).toEqual(['S087.T004', 'S087.T004', 'S087.T004', 'S087.T004'])
  expect(taskIdOf('nope')).toBe('nope')
  expect(spaced('FixPVECluster')).toBe('Fix PVE Cluster')
  expect(spaced('ThirdSitePt2')).toBe('Third Site Pt2')
})

test('on a .ai/ board the work is looked for in every open sprint', () => {
  const sprints = board()
  const live = [{ id: '1', text: 'Draw the site to site tunnel', status: 'in_progress' as const }]
  expect(focusOf(sprints, null, live)).toMatchObject({ focusId: 'S087.T004', isGuess: true })
  expect(focusOf(sprints, { story: 'S089.T001' }, [])).toMatchObject({ focusId: 'S089.T001', isGuess: false })
  // The open sprints' columns are named by their labels.
  expect(columnRows(sprints.at(-1)!, context())[0]?.text).toBe('S089 Owner Step Tiers')
})
