// Tests of the harness-neutral core, on node's built-in runner (no harness):
//   node --test mods/task-compass/core/core.test.ts
// Node 22.18 or later strips the types itself.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { currentSprint, MARKER, parseSprints, setStoryStatus, STATUSES, statusFromWords } from './board.ts'
import { layoutOf, parseRoadmap, planSprints } from './plan.ts'
import { answerStory, boardText, openStoriesText, sprintNow } from './story.ts'

const GOALS = [
  '# Project',
  '',
  '## Sprint 1 — Foundations',
  'Goal: Ship the base',
  '- [x] Set up the repo',
  '- [x] Write the parser',
  '',
  '## Sprint 2 — Ports',
  'Goal: Run on every client',
  '- [>] OpenCode port',
  '  The sidebar slot',
  '- [ ] Codex port',
  '- [x] Extract core',
  '- An idea for later',
  '',
].join('\n')

test('parseSprints reads sprints, stories, statuses and details', () => {
  const sprints = parseSprints(GOALS)
  assert.equal(sprints.length, 2)
  assert.equal(sprints[0]?.status, 'done')
  assert.equal(sprints[1]?.status, 'in_progress')
  assert.deepEqual(
    sprints[1]?.stories.map(story => [story.id, story.status]),
    [['2.1', 'in_progress'], ['2.2', 'todo'], ['2.3', 'done'], ['2.4', 'backlog']],
  )
  assert.deepEqual(sprints[1]?.stories[0]?.details, ['The sidebar slot'])
})

test('setStoryStatus rewrites only that story line, keeping CRLF', () => {
  const crlf = GOALS.replace(/\n/g, '\r\n')
  const next = setStoryStatus(crlf, '2.2', 'review')
  assert.ok(next)
  assert.ok(next.includes('- [?] Codex port\r\n'))
  assert.equal(next.replace('- [?] Codex port', '- [ ] Codex port'), crlf)
  assert.equal(setStoryStatus(GOALS, '9.9', 'done'), undefined)
  assert.ok(setStoryStatus(GOALS, '2.1', 'backlog')?.includes('\n- OpenCode port\n'))
})

test('currentSprint picks the first sprint under way', () => {
  assert.equal(currentSprint(parseSprints(GOALS)), 1)
  assert.equal(currentSprint([]), 0)
})

test('the marker table covers every status, and words map to statuses', () => {
  assert.deepEqual(Object.keys(MARKER), STATUSES)
  assert.equal(statusFromWords('In Progress'), 'in_progress')
  assert.equal(statusFromWords('finished'), 'done')
  assert.equal(statusFromWords('maybe'), undefined)
})

test('plan reading: layout, roadmap rows and a brief as a story', () => {
  assert.deepEqual(layoutOf(undefined), { root: '.ai', entrypoint: '00.CONVENTIONS.md' })
  assert.ok('error' in layoutOf('{"root": "/abs"}'))
  const rows = parseRoadmap('## Sprint history\n| Sprint | Dates | x | Theme |\n|---|---|---|---|\n| `S001_Base` | 2026-11-01 (open) | | Build it |\n')
  assert.equal(rows.length, 1)
  const sprints = planSprints(rows, [{ file: 'S001.T001_DoIt.md', text: '# T\n**Status**: in progress\n' }], '/p/.ai/tasks')
  assert.equal(sprints[0]?.stories[0]?.id, 'S001.T001')
  assert.equal(sprints[0]?.stories[0]?.status, 'in_progress')
  assert.equal(sprints[0]?.isOpen, true)
})

test('answerStory sets a status and returns the new text', () => {
  const answer = answerStory(GOALS, { story: '2.2', status: 'in_progress' })
  assert.equal(answer.result, 'Story 2.2 "Codex port" is now In progress.')
  assert.ok(answer.markdown?.includes('- [>] Codex port'))
})

test('answerStory takes words, reports without a status, and refuses the unknown', () => {
  assert.ok(answerStory(GOALS, { story: '2.2', status: 'done' }).markdown?.includes('- [x] Codex port'))
  assert.ok(answerStory(GOALS, { story: 'story 2.2', status: 'in review' }).markdown?.includes('- [?] Codex port'))
  assert.deepEqual(answerStory(GOALS, { story: '2.1' }), { result: 'Story 2.1 "OpenCode port" is In progress.' })
  assert.equal(answerStory(GOALS, { story: '2.1', status: 'in_progress' }).markdown, undefined)
  assert.match(answerStory(GOALS, { story: '7.1', status: 'done' }).result, /^No story "7.1"[\s\S]*2\.2 Codex port \[To do\]/)
  assert.match(answerStory(GOALS, { story: '2.1', status: 'someday' }).result, /^Unknown status "someday"/)
  assert.match(answerStory(undefined, { story: '1.1' }).result, /^No \.ai\/GOALS\.md/)
})

test('openStoriesText lists the current sprint\'s open stories', () => {
  const text = openStoriesText(GOALS)
  assert.match(text, /Sprint 2 — Ports, goal: Run on every client\. Open stories:/)
  assert.match(text, /2\.1 OpenCode port \[In progress\]/)
  assert.match(text, /2\.4 An idea for later \[Backlog\]/)
  assert.doesNotMatch(text, /Extract core/)
  assert.match(openStoriesText(undefined), /no sprint board/)
  assert.match(openStoriesText('# Empty\n'), /no sprints yet/)
})

test('boardText folds a done sprint; sprintNow is the current one', () => {
  const sprints = parseSprints(GOALS)
  assert.match(boardText(sprints), /^Sprint 1 — Foundations \[done\]\nSprint 2 — Ports \[In progress\] goal: Run on every client\n  2\.1 OpenCode port \[In progress\]/)
  assert.equal(sprintNow(sprints)?.n, 2)
  assert.equal(sprintNow([]), undefined)
})
