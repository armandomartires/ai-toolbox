import { expect, mock, test } from 'claude-code/testing'
import type { CommandRunInput, On } from 'claude-code'

import { BRIEFS, ROADMAP } from './fixtures/sigma'

const PANE = {
  plugin: 'task-compass',
  component: 'Pane',
  requestId: 'task-compass',
  props: {
    title: 'Compass',
    isFocused: false,
    bodyColumns: 76,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const T004 = 'S087_NetBoxNetworkModel.T004_SiteToSiteTunnel.md'

/**
 * The engine beneath the mod: a sigma-infrastructure folder in memory at /q,
 * its `.ai/` layer from the structure-only fixtures, with every read and
 * write recorded.
 */
const project = (on: On, extra: Record<string, string> = {}, plan = true) => {
  const files = new Map<string, { text: string; mtime: number }>()
  const put = (path: string, text: string) => files.set(path, { text, mtime: (files.get(path)?.mtime ?? 0) + 1 })
  if (plan) {
    put('/q/.ai/00.CONVENTIONS.md', '# Conventions\n')
    put('/q/.ai/30.ROADMAP.md', ROADMAP)
    for (const [name, text] of Object.entries(BRIEFS)) put(`/q/.ai/tasks/${name}`, text)
  }
  for (const [path, text] of Object.entries(extra)) put(path, text)
  const log = { reads: [] as string[], writes: [] as string[] }

  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__task-compass__${e.name}` } }))
  on('tool.describe', (_, e) => ({ description: e.description }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.cwd', () => ({ value: '/q' }))
  on('fs.stat', (_, e) => {
    const file = files.get(e.path)
    if (!file) throw new Error('ENOENT')
    return { value: { kind: 'file', size: file.text.length, mtimeMs: file.mtime, isLink: false } }
  })
  on('fs.exists', (_, e) => ({ value: files.has(e.path) }))
  on('fs.list', (_, e) => ({
    value: [...files.entries()]
      .filter(([path]) => path.startsWith(`${e.path}/`) && !path.slice(e.path.length + 1).includes('/'))
      .map(([path, file]) => ({
        name: path.slice(e.path.length + 1),
        kind: 'file' as const,
        size: file.text.length,
        mtimeMs: file.mtime,
        isLink: false,
      })),
  }))
  on('fs.read', (_, e) => {
    log.reads.push(e.path)
    const file = files.get(e.path)
    if (!file) throw new Error('ENOENT')
    return { value: file.text }
  })
  on('fs.write', (_, e) => {
    log.writes.push(e.path)
    put(e.path, e.text)
    return { value: undefined }
  })
  on('agent.list', () => ({ value: [] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  return { files, put, log }
}

const DESCRIBE = {
  tool: 'mcp__task-compass__story',
  description: '',
  provider: { plugin: 'task-compass', tier: 'user' },
} as const

/** `/goals` as the person types it; the harness takes the hook's whole input. */
const GOALS = (args = '') => ({ command: 'goals', args }) as unknown as CommandRunInput

test('a project-workflow project shows its open sprints, centred and current', async ($, on) => {
  mock.clock(on)
  project(on)
  await $.session.start({ cwd: '/q', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const text = async (pattern: RegExp) => (await ui.find({ text: pattern }))?.text
    expect(await text(/S087–S089 OPEN · 88 SPRINTS/)).toBeDefined()
    expect(await text(/S087 Net Box Network/)).toBeDefined()
    expect(await text(/S088 Project Vault/)).toBeDefined()
    expect(await text(/S089 Owner Step Tiers/)).toBeDefined()
    // Every open sprint is current; the closed ones are one scroll away.
    expect((await ui.findAll({ type: 'Text', text: '◉' })).length).toBe(3)
    expect(await text(/‹ 85 EARLIER/)).toBeDefined()
    expect(await text(/Site To Site Tunnel/)).toBeDefined()
    expect(await text(/late/)).toBeUndefined()
    await ui.unmount()
  }

  const { description } = await $.tool.describe(DESCRIBE)
  expect(description).toContain('This tool writes nothing')
  expect(description).toContain('  S087.T004 Site To Site Tunnel [To do]')
  expect(description).not.toContain('S043')
})

test('the story tool marks the task and writes nothing, whatever it is given', async ($, on) => {
  mock.clock(on)
  const { log } = project(on)
  await $.session.start({ cwd: '/q', surface: 'terminal', isInteractive: true })

  const ran = await $.tool.call({ tool: 'mcp__task-compass__story', story: 's87.t4', status: 'in_progress', why: 'tunnel next' })
  expect(String(ran.result)).toContain('Task S087.T004 "Site To Site Tunnel"')
  expect(String(ran.result)).toContain(`Nothing was written: the status is line 3 of /q/.ai/tasks/${T004}`)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Button', text: /▸Site To Site Tunnel/ }))?.text).toBeDefined()
  await ui.unmount()

  const wrong = await $.tool.call({ tool: 'mcp__task-compass__story', story: 'S087.T099' })
  expect(String(wrong.result)).toContain('No task "S087.T099"')

  const init = await $.command.run(GOALS('init'))
  expect(init.text).toContain('it needs no GOALS.md')
  const listed = await $.command.run(GOALS())
  expect(listed.text).toBe('Compass: 88 sprints, 31 tasks loaded from /q/.ai; open: S087, S088, S089.')
  expect(log.writes).toEqual([])
})

test('an edited brief shows within a tick, and only changed briefs are read again', async ($, on) => {
  const clock = mock.clock(on)
  const { put, log } = project(on)
  await $.session.start({ cwd: '/q', surface: 'desktop', isInteractive: true })
  const briefReads = () => log.reads.filter(path => path.includes('/tasks/')).length
  expect(briefReads()).toBe(31)

  // Nothing changed: a tick reads no brief.
  await clock.advance(6_000)
  expect(briefReads()).toBe(31)

  // The dot drawn just before a task's name.
  const dotOf = async (name: RegExp) => {
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    const all = await ui.findAll({})
    const at = all.findIndex(one => one.type === 'Button' && name.test(one.text))
    const dot = all.slice(0, Math.max(0, at)).reverse().find(one => one.type === 'Text')?.text
    await ui.unmount()
    return at < 0 ? undefined : dot
  }
  expect(await dotOf(/Site To Site Tunnel/)).toBe('○')

  // Claude edits one brief's status: that one brief is read, at once.
  put(`/q/.ai/tasks/${T004}`, BRIEFS[T004]!.replace('**Status**: not started', '**Status**: in progress'))
  await $.tool.call({ tool: 'Edit', file_path: `/q/.ai/tasks/${T004}`, old_string: 'a', new_string: 'b' })
  expect(briefReads()).toBe(32)
  expect(await dotOf(/Site To Site Tunnel/)).toBe('◐')

  // An edit made by hand shows on the next tick.
  put(`/q/.ai/tasks/${T004}`, BRIEFS[T004]!.replace('**Status**: not started', '**Status**: completed'))
  await clock.advance(6_000)
  expect(briefReads()).toBe(33)
  expect((await $.tool.describe(DESCRIBE)).description).toContain('S087.T004 Site To Site Tunnel [Done]')
})

test('a GOALS.md wins over .ai/, and a malformed declaration is reported', async ($, on) => {
  mock.clock(on)
  const { put, files, log } = project(on, { '/q/.ai/GOALS.md': '## Sprint 1 — Own board\n- [ ] Mine\n' })
  await $.session.start({ cwd: '/q', surface: 'desktop', isInteractive: true })
  let ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /S1 Own board/ })).toBeDefined()
  expect(await ui.find({ text: /S087/ })).toBeUndefined()
  await ui.unmount()

  files.delete('/q/.ai/GOALS.md')
  put('/q/.ai-layout.json', '{ "root": ".ai", "tracker": "files" }')
  const init = await $.command.run(GOALS('init'))
  expect(init.text).toBe(
    "Compass cannot read this project's plan: /q/.ai-layout.json: .ai-layout.json has an unknown key: tracker. Fix the declaration; no GOALS.md is written.",
  )
  expect(log.writes).toEqual([])
  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /^\/q\/\.ai-layout\.json: \.ai-layout\.json has an unknown key: tracker$/ })).toBeDefined()
  expect(await ui.find({ text: /goals init|Sprint history/ })).toBeUndefined()
  await ui.unmount()
  expect((await $.tool.describe(DESCRIBE)).description).toContain('No plan is shown: /q/.ai-layout.json')
})

const OWN = '## Sprint 1 — Own board\n- [ ] Mine\n'
const OTHER = '## Sprint 1 — Other board\n- [ ] Theirs\n'
const STORY = { tool: 'mcp__task-compass__story', story: '1.1', status: 'done' } as const

test('a root GOALS.md is copied to .ai/GOALS.md, which becomes the board and the one the story tool writes', async ($, on) => {
  mock.clock(on)
  const { files, log } = project(on, { '/q/GOALS.md': OWN }, false)
  await $.session.start({ cwd: '/q', surface: 'desktop', isInteractive: true })

  expect(files.get('/q/.ai/GOALS.md')?.text).toBe(OWN)
  expect(log.writes).toEqual(['/q/.ai/GOALS.md'])
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /S1 Own board/ })).toBeDefined()
  await ui.unmount()

  await $.tool.call(STORY)
  expect(files.get('/q/.ai/GOALS.md')?.text).toContain('- [x] Mine')
  expect(files.get('/q/GOALS.md')?.text).toBe(OWN)
  expect(log.writes).toEqual(['/q/.ai/GOALS.md', '/q/.ai/GOALS.md'])

  const listed = await $.command.run(GOALS())
  expect(listed.text).toContain('loaded from /q/.ai/GOALS.md')
  expect(listed.text).toContain('/q/GOALS.md is a leftover copy')
  expect((await $.tool.describe(DESCRIBE)).description).toContain('/q/GOALS.md is a leftover copy')
})

test('both files: the .ai/ one is the board, and neither is overwritten', async ($, on) => {
  mock.clock(on)
  const { files, log } = project(on, { '/q/GOALS.md': OTHER, '/q/.ai/GOALS.md': OWN }, false)
  await $.session.start({ cwd: '/q', surface: 'desktop', isInteractive: true })

  expect(log.writes).toEqual([])
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /S1 Own board/ })).toBeDefined()
  expect(await ui.find({ text: /Other board/ })).toBeUndefined()
  await ui.unmount()
  expect(files.get('/q/GOALS.md')?.text).toBe(OTHER)
  expect((await $.command.run(GOALS())).text).toContain('/q/GOALS.md is a leftover copy')
})

test('only .ai/GOALS.md: nothing is written and no leftover is reported', async ($, on) => {
  mock.clock(on)
  const { log } = project(on, { '/q/.ai/GOALS.md': OWN }, false)
  await $.session.start({ cwd: '/q', surface: 'desktop', isInteractive: true })

  expect(log.writes).toEqual([])
  expect((await $.command.run(GOALS())).text).toBe('Compass: 1 sprints, 1 stories loaded from /q/.ai/GOALS.md.')
})

test('with no GOALS.md nothing is written on load, and /goals init creates .ai/GOALS.md', async ($, on) => {
  mock.clock(on)
  const { files, log } = project(on, {}, false)
  await $.session.start({ cwd: '/q', surface: 'desktop', isInteractive: true })
  expect(log.writes).toEqual([])
  expect((await $.command.run(GOALS())).text).toBe('Compass: no sprints found in /q/.ai/GOALS.md. Run /goals init to start one.')

  await $.command.run(GOALS('init'))
  expect(log.writes).toEqual(['/q/.ai/GOALS.md'])
  expect(files.has('/q/GOALS.md')).toBe(false)
  expect(files.get('/q/.ai/GOALS.md')?.text).toContain('## Sprint 1')
  expect((await $.command.run(GOALS('init'))).text).toBe('GOALS.md already exists; edit it to change the sprints.')
})

test('a project that plans in .ai/ gets no GOALS.md written on load', async ($, on) => {
  mock.clock(on)
  const { files, log } = project(on)
  await $.session.start({ cwd: '/q', surface: 'desktop', isInteractive: true })

  expect(log.writes).toEqual([])
  expect(files.has('/q/.ai/GOALS.md')).toBe(false)
  expect(files.has('/q/GOALS.md')).toBe(false)
})

test('the layout root decides where GOALS.md lives, and a malformed declaration uses the root file in place', async ($, on) => {
  mock.clock(on)
  const { put, files, log } = project(
    on,
    { '/q/GOALS.md': OWN, '/q/.ai-layout.json': '{ "root": "docs/ai" }' },
    false,
  )
  await $.session.start({ cwd: '/q', surface: 'desktop', isInteractive: true })
  expect(files.get('/q/docs/ai/GOALS.md')?.text).toBe(OWN)
  expect(files.has('/q/.ai/GOALS.md')).toBe(false)

  files.delete('/q/docs/ai/GOALS.md')
  log.writes.length = 0
  put('/q/.ai-layout.json', '{ "root": ".ai", "tracker": "files" }')
  const listed = await $.command.run(GOALS())
  expect(listed.text).toBe('Compass: 1 sprints, 1 stories loaded from /q/GOALS.md.')
  expect(log.writes).toEqual([])
})
