// Tests of the harness-neutral core, on node's built-in runner (no harness):
//   node --test mods/task-compass/core/core.test.ts
// Node 22.18 or later strips the types itself.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { boardFolders, currentSprint, MARKER, parseSprints, projectFolder, setStoryStatus, STATUSES, statusFromWords } from './board.ts'
import { layoutOf, parseRoadmap, planSprints } from './plan.ts'
import { answerStory, boardText, openStoriesText, sprintNow, storyFolder } from './story.ts'
import { CONF_UNREADABLE, confProblem, forgeDecline, forgeState, forgeText, isForge, SECTION_LINES, trackerOf } from './tracker.ts'

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

/** A POSIX-spelled path in Windows separators: `win('C:/r')` is C:\r. */
const win = (path: string) => path.replace(/\//g, '\\')

test('boardFolders walks up and starts above the outermost .ai', () => {
  assert.deepEqual(boardFolders('/r/p/sub/'), ['/r/p/sub', '/r/p', '/r', '/'])
  assert.deepEqual(boardFolders('/r/p/.ai'), ['/r/p', '/r', '/'])
  assert.deepEqual(boardFolders('/r/p/.ai/.ai/tasks'), ['/r/p', '/r', '/'])
  assert.deepEqual(boardFolders(win('C:/r/p/.AI')), [win('C:/r/p'), win('C:/r'), win('C:/')])
  assert.deepEqual(boardFolders(win('//host/share/p')), [win('//host/share/p'), win('//host/share')])
})

test('projectFolder: the nearest board, never inside .ai, not past the top (S019.T002)', () => {
  const boards = new Set(['/r/p', '/r/p/.ai'])
  const has = (dir: string) => boards.has(dir)
  // A shell in the board's folder, even with a stray .ai/.ai/GOALS.md, means the project.
  assert.equal(projectFolder('/r/p/.ai', has), '/r/p')
  assert.equal(projectFolder('/r/p/sub/deep', has), '/r/p')
  // No board up to the repository's top: the start, or the folder above its .ai.
  assert.equal(projectFolder('/r/q/sub', has, dir => dir === '/r/q'), '/r/q/sub')
  assert.equal(projectFolder('/r/q/.ai', () => false), '/r/q')
  assert.equal(projectFolder(win('C:/r/p/.ai'), dir => dir === win('C:/r/p')), win('C:/r/p'))
})

test('storyFolder counts a folder holding a tracker.conf: a forge project has no GOALS.md', () => {
  const paths = new Set(['/r/p/tracker.conf', '/r/p/.git'])
  assert.equal(storyFolder('/r/p/.ai', path => paths.has(path)), '/r/p')
  assert.equal(storyFolder('/r/p/src/deep', path => paths.has(path)), '/r/p')
  assert.equal(storyFolder(win('C:/r/p/src'), path => path === win('C:/r/p/tracker.conf')), win('C:/r/p'))
})

test('storyFolder finds .ai/GOALS.md from inside .ai, in either separator', () => {
  const paths = new Set(['/r/p/.ai/GOALS.md', '/r/p/.ai/.ai/GOALS.md', '/r/p/.git'])
  assert.equal(storyFolder('/r/p/.ai', path => paths.has(path)), '/r/p')
  assert.equal(storyFolder('/r/p/src', path => paths.has(path)), '/r/p')
  assert.equal(storyFolder('/r/x', path => paths.has(path)), '/r/x')
  assert.equal(storyFolder(win('C:/r/p/.ai'), path => path === win('C:/r/p/.ai/GOALS.md')), win('C:/r/p'))
})

const CONF_HEADER = [
  '# Work tracker for this project: files | gitlab | github (ADR-0037 in',
  '# ai-toolbox; skills/project-workflow/templates/reference/tracker.md).',
  '# Written by tracker.sh init on 2026-10-18. Changing it is a decision: record',
  '# an ADR. Absent, this file means files.',
].join('\r\n')

test('trackerOf reads a declaration, absent meaning files', () => {
  assert.deepEqual(trackerOf(undefined), { tracker: 'files', declared: false })
  assert.deepEqual(trackerOf('tracker = files\n'), { tracker: 'files', declared: true })
  assert.deepEqual(trackerOf('tracker = gitlab\ngitlab_project = group/sub/name\n'), {
    tracker: 'gitlab',
    path: 'group/sub/name',
    declared: true,
  })
  assert.deepEqual(trackerOf('tracker=github\ngithub_repo=owner/name'), {
    tracker: 'github',
    path: 'owner/name',
    declared: true,
  })
  assert.deepEqual(trackerOf(`${CONF_HEADER}\r\n\r\ntracker = files\r\n\r\n`), { tracker: 'files', declared: true })
  assert.equal(isForge({ tracker: 'files', declared: true }), false)
  assert.equal(isForge({ tracker: 'github', path: 'owner/name', declared: true }), true)
})

test('trackerOf reports what tracker_lib refuses', () => {
  const error = (text: string) => {
    const got = trackerOf(text)
    return 'error' in got ? got.error : ''
  }
  assert.match(error('tracker = files\nnonsense\n'), /^tracker\.conf:2: expected `key = value`/)
  assert.match(error('tracker = files\nhost = x\n'), /^tracker\.conf:2: unknown key 'host'/)
  assert.match(error('tracker = files\ntracker = files\n'), /^tracker\.conf:2: 'tracker' is set twice/)
  assert.match(error('# only a comment\n'), /^tracker\.conf: `tracker` is required/)
  assert.match(error('tracker = jira\n'), /tracker='jira'; known: files \| gitlab \| github/)
  assert.match(error('tracker = gitlab\ngithub_repo = a/b\ngitlab_project = g/n\n'), /github_repo belongs to tracker = github, not gitlab/)
  assert.match(error('tracker = gitlab\n'), /needs gitlab_project = group\/name/)
  assert.match(error('tracker = gitlab\ngitlab_project = https://host/g/n\n'), /names only/)
  assert.match(error('tracker = gitlab\ngitlab_project = git@host:g/n\n'), /names only/)
  assert.match(error('tracker = github\ngithub_repo = a/b/c\n'), /github_repo='a\/b\/c' is not owner\/name/)
  assert.match(error('tracker = gitlab\ngitlab_project = single\n'), /gitlab_project='single' is not group\/name/)
  assert.match(error('tracker = gitlab # x\ngitlab_project = g/n\n'), /tracker='gitlab # x'; known/)
})

const FORGE_TEMPLATE = [
  '# Active Plan (forge tracker)',
  '',
  'Where the project stands, right now.',
  '',
  'Last updated: YYYY-MM-DD.',
  '',
  '## Current state',
  '',
  '<!-- a comment',
  'over two lines -->',
  'Two or three lines: what the project is doing now.',
  '',
  '## Open milestone and board',
  '',
  '- Milestone: `S###_SprintName` — one sentence on its purpose.',
  '- Board: name of the issue board.',
  '',
  '## Blocked',
  '',
  'What is blocked and on which issue (`group/name#N`).',
  '',
  '## Next action',
  '',
  'One line: the issue to take next.',
  '',
  '## History',
  '',
  'Only if the repository moved to this forge.',
  '',
].join('\n')

const FORGE_PLAN = [
  '# Active Plan (forge tracker)',
  '',
  'Last updated: 2026-11-02.',
  '',
  '## Current state',
  'Demo runs; the importer works.',
  '',
  '## Open milestone and board',
  '- Milestone: `S004_Importer` — ship the importer.',
  '- Board: Delivery board',
  '',
  '## Blocked',
  'Nothing currently blocked.',
  '',
  '## Next action',
  'Take group/demo#12 from the board.',
  '',
  '## Notes',
  'An unknown heading is ignored.',
  '',
  '## History',
  'Earlier planning is in tag `pre-forge-migration`: `git show pre-forge-migration:.ai/tasks/`',
  '',
].join('\n')

test('forgeState reads the forge variant of the plan', () => {
  const blank = forgeState(FORGE_TEMPLATE)
  assert.equal(blank.hasSections, true)
  assert.equal(blank.current.length, 1)
  assert.equal(blank.tag, undefined)

  const state = forgeState(FORGE_PLAN)
  assert.equal(state.updated, '2026-11-02')
  assert.deepEqual(state.current, ['Demo runs; the importer works.'])
  assert.equal(state.milestone, 'S004_Importer — ship the importer.')
  assert.equal(state.board, 'Delivery board')
  assert.deepEqual(state.blocked, ['Nothing currently blocked.'])
  assert.deepEqual(state.next, ['Take group/demo#12 from the board.'])
  assert.equal(state.history.length, 1)
  assert.equal(state.tag, 'pre-forge-migration')
  assert.equal(JSON.stringify(state).includes('unknown heading'), false)

  assert.equal(forgeState(FORGE_PLAN.replace(/## History[\s\S]*$/, '')).tag, undefined)
  assert.deepEqual(forgeState(FORGE_PLAN.replace(/\n/g, '\r\n')), state)
})

test('forgeState reads no sections from a files-variant plan, and caps each', () => {
  const files = ['# Active Plan', '', '## Current plan', '| T001 | Do it |', '', '## Roadmap', 'Later'].join('\n')
  const none = forgeState(files)
  assert.equal(none.hasSections, false)
  assert.deepEqual(none.current, [])

  const long = ['## Blocked', ...Array.from({ length: SECTION_LINES + 4 }, (_, i) => `issue ${i}`)].join('\n')
  assert.equal(forgeState(long).blocked.length, SECTION_LINES)
})

test('forgeText and forgeDecline name the forge and write nothing', () => {
  const tracker = { tracker: 'gitlab' as const, path: 'group/demo', declared: true }
  const text = forgeText(forgeState(FORGE_PLAN), tracker, '.ai/20.PLAN.md')
  assert.match(text, /gitlab group\/demo/)
  assert.match(text, /Nothing was written/)
  assert.match(text, /Milestone: S004_Importer/)
  assert.match(text, /pre-forge-migration/)
  const decline = forgeDecline(tracker)
  assert.match(decline, /gitlab group\/demo/)
  assert.match(decline, /no GOALS\.md is written/)
  for (const one of [text, decline]) {
    assert.doesNotMatch(one, /http/)
    assert.doesNotMatch(one, /\/goals init/)
    assert.doesNotMatch(one, /GOALS\.md with sprints/)
  }
})

test('forgeState ignores headings that name an Object.prototype member', () => {
  const odd = ['## constructor', 'x', '## __proto__', 'y', '## toString', '## valueOf', 'z', '## hasOwnProperty', 'w'].join('\n')
  const none = forgeState(odd)
  assert.equal(none.hasSections, false)
  assert.deepEqual(none.current, [])
  const both = forgeState(`## constructor\nlost\n## __proto__\nlost\n${FORGE_PLAN}`)
  assert.equal(both.hasSections, true)
  assert.deepEqual(both.current, ['Demo runs; the importer works.'])
  assert.equal(JSON.stringify(both).includes('lost'), false)
})

test('forgeState reads the milestone and board in each bullet form', () => {
  const plan = (open: string[]) => ['## Open milestone and board', ...open].join('\n')
  for (const open of [
    ['- **Milestone**: S004', '- **Board**: Delivery'],
    ['* Milestone: S004', '* Board: Delivery'],
    ['Milestone: S004', 'Board: Delivery'],
    ['- Milestone: S004', '- Board: Delivery'],
    ['**Milestone:** S004', '**Board:** Delivery'],
  ]) {
    const state = forgeState(plan(open))
    assert.equal(state.milestone, 'S004', open.join(' / '))
    assert.equal(state.board, 'Delivery', open.join(' / '))
  }
})

test('trackerOf refuses a leading byte order mark the way tracker_lib does', () => {
  for (const text of ['\uFEFFtracker = files\n', '\uFEFF# a comment\ntracker = files\n']) {
    const got = trackerOf(text)
    assert.ok('error' in got, text)
    assert.match(got.error, /^tracker\.conf:1: /)
  }
  assert.match((trackerOf('\uFEFFtracker = files\n') as { error: string }).error, /^tracker\.conf:1: the file starts with a byte-order mark; save it as UTF-8 without one$/)
  assert.deepEqual(trackerOf('tracker = files\n'), { tracker: 'files', declared: true })
})

test('confProblem carries the error once and ends it with one full stop', () => {
  assert.equal(
    confProblem(CONF_UNREADABLE),
    "Compass cannot read this project's tracker.conf: the file is not readable. No GOALS.md is written.",
  )
  assert.equal(
    confProblem("tracker.conf:2: unknown key 'host'."),
    "Compass cannot read this project's tracker.conf:2: unknown key 'host'. Fix the declaration; no GOALS.md is written.",
  )
  assert.doesNotMatch(confProblem('tracker.conf: x.'), /\.\./)
  assert.doesNotMatch(confProblem('tracker.conf: x'), /tracker\.conf: tracker\.conf/)
})
