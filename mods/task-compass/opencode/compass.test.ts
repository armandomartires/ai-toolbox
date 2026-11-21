// The OpenCode plugin's story tool and sidebar data, on node's test runner:
//   node --test mods/task-compass/opencode/compass.test.ts
// index.ts and tui.tsx import OpenCode's own packages and are not loaded here.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'

import { goalsFile, runStory, sidebarBoard } from './compass.ts'

const dirs: string[] = []
after(() => dirs.forEach(dir => rmSync(dir, { recursive: true, force: true })))

const folder = (goals?: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'compass-oc-'))
  dirs.push(dir)
  if (goals !== undefined) {
    mkdirSync(join(dir, '.ai'))
    writeFileSync(join(dir, '.ai', 'GOALS.md'), goals)
  }
  return dir
}

const GOALS = '## Sprint 1 — Ports\n- [>] OpenCode port\n- [ ] Codex port\n- [x] Core\n'

test('the story tool writes the new status into .ai/GOALS.md', () => {
  const dir = folder(GOALS)
  assert.equal(runStory(dir, { story: '1.2', status: 'review' }), 'Story 1.2 "Codex port" is now In review.')
  assert.equal(readFileSync(goalsFile(dir), 'utf8'), GOALS.replace('- [ ] Codex port', '- [?] Codex port'))
})

test('the story tool leaves the file alone when nothing changes or the call is wrong', () => {
  const dir = folder(GOALS)
  runStory(dir, { story: '1.1', status: 'in_progress' })
  assert.match(runStory(dir, { story: '4.4', status: 'done' }), /^No story "4.4"/)
  assert.match(runStory(dir, { story: '1.1', status: 'soon' }), /^Unknown status/)
  assert.equal(readFileSync(goalsFile(dir), 'utf8'), GOALS)
})

test('a folder with no board answers so and writes nothing', () => {
  const dir = folder()
  assert.match(runStory(dir, { story: '1.1', status: 'done' }), /^No \.ai\/GOALS\.md/)
  assert.deepEqual(sidebarBoard(dir), { title: 'No .ai/GOALS.md', rows: [] })
})

test('the sidebar lists the current sprint\'s stories with their glyphs', () => {
  assert.deepEqual(sidebarBoard(folder(GOALS)), {
    title: 'Sprint 1 — Ports',
    rows: [
      { glyph: '◐', text: '1.1 OpenCode port', status: 'in_progress' },
      { glyph: '○', text: '1.2 Codex port', status: 'todo' },
      { glyph: '●', text: '1.3 Core', status: 'done' },
    ],
  })
})

const withConf = (conf: string, goals?: string) => {
  const dir = folder(goals)
  writeFileSync(join(dir, 'tracker.conf'), conf)
  return dir
}
const FORGE = 'tracker = gitlab\ngitlab_project = group/demo\n'

test('on a forge tracker the story tool declines and writes no GOALS.md', () => {
  const dir = withConf(FORGE)
  const answer = runStory(dir, { story: '1.1', status: 'done' })
  assert.match(answer, /gitlab group\/demo/)
  assert.match(answer, /no GOALS\.md is written/)
  assert.equal(existsSync(goalsFile(dir)), false)
})

test('on a forge tracker the sidebar is titled for the forge, with no rows', () => {
  assert.deepEqual(sidebarBoard(withConf(FORGE, GOALS)), { title: 'Forge: gitlab group/demo', rows: [] })
})

test('an invalid tracker.conf is reported and nothing is written', () => {
  const dir = withConf('tracker = svn\n')
  const answer = runStory(dir, { story: '1.1', status: 'done' })
  assert.match(answer, /^Compass cannot read this project's tracker\.conf: .*svn.*\. Fix the declaration; no GOALS\.md is written\.$/)
  assert.equal(existsSync(goalsFile(dir)), false)
  assert.match(sidebarBoard(dir).title, /svn/)
  assert.deepEqual(sidebarBoard(dir).rows, [])
})

test('a files tracker behaves as before', () => {
  const dir = withConf('tracker = files\n', GOALS)
  assert.equal(runStory(dir, { story: '1.2', status: 'review' }), 'Story 1.2 "Codex port" is now In review.')
  assert.equal(sidebarBoard(dir).title, 'Sprint 1 — Ports')
})

test('a tracker.conf that is a folder means files, as tracker_lib has it', () => {
  const dir = folder(GOALS)
  mkdirSync(join(dir, 'tracker.conf'))
  assert.equal(runStory(dir, { story: '1.2', status: 'review' }), 'Story 1.2 "Codex port" is now In review.')
  assert.equal(sidebarBoard(dir).title, 'Sprint 1 — Ports')
})

test('a tracker.conf that cannot be read is reported once, in the tool and the sidebar, and nothing is written', () => {
  const dir = `${folder(GOALS)}\0`
  const answer = runStory(dir, { story: '1.2', status: 'review' })
  assert.equal(answer, "Compass cannot read this project's tracker.conf: the file is not readable. No GOALS.md is written.")
  assert.equal(sidebarBoard(dir).title, 'tracker.conf: the file is not readable')
  assert.equal(readFileSync(goalsFile(dir.slice(0, -1)), 'utf8'), GOALS)
})

test('a tracker.conf error carries the file name once, and a byte order mark is refused', () => {
  const dir = withConf('tracker = files\nhost = x\n')
  assert.equal(
    runStory(dir, { story: '1.1' }),
    "Compass cannot read this project's tracker.conf:2: unknown key 'host'. Known: tracker, gitlab_project, github_repo. Fix the declaration; no GOALS.md is written.",
  )
  assert.match(sidebarBoard(dir).title, /^tracker\.conf:2: unknown key/)
  const bom = withConf('\uFEFFtracker = files\n', GOALS)
  assert.match(runStory(bom, { story: '1.2', status: 'review' }), /^Compass cannot read this project's tracker\.conf:1: the file starts with a byte-order mark; save it as UTF-8 without one\. Fix the declaration/)
  assert.equal(readFileSync(goalsFile(bom), 'utf8'), GOALS)
})
