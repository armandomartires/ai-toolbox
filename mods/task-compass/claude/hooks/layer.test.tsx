import { expect, mock, test } from 'claude-code/testing'
import type { CommandRunInput, On } from 'claude-code'

import { FORGE_PLAN, GITHUB_CONF, GITLAB_CONF } from './fixtures/forge'
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
 * A path as the fixtures key it. The engine resolves every `$.fs` path before
 * it reaches an fs hook, so on Windows the mod's `/q/.ai/30.ROADMAP.md`
 * arrives as `C:\q\.ai\30.ROADMAP.md`; elsewhere it arrives unchanged.
 */
const posix = (path: string) => path.replace(/^[a-z]:/i, '').replace(/\\/g, '/')

/**
 * The engine beneath the mod: a sigma-infrastructure folder in memory at /q,
 * its `.ai/` layer from the structure-only fixtures, with every read and
 * write recorded.
 */
const project = (on: On, extra: Record<string, string> = {}, plan = true) => {
  const files = new Map<string, { text: string; mtime: number }>()
  // Paths that stat as a folder, and files whose read fails.
  const dirs = new Set<string>()
  const broken = new Set<string>()
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
  // The test kit's base hook for the pane, which Compass's `next(e)` reaches: it draws nothing.
  on('ui.render', { component: 'Pane', requestId: 'task-compass' }, ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })
  on('session.cwd', () => ({ value: '/q' }))
  on('session.root', () => ({ value: '/q' }))
  on('fs.stat', (_, e) => {
    if (dirs.has(posix(e.path))) return { value: { kind: 'dir', size: 0, mtimeMs: 1, isLink: false } }
    const file = files.get(posix(e.path))
    if (!file) throw new Error('ENOENT')
    return { value: { kind: 'file', size: file.text.length, mtimeMs: file.mtime, isLink: false } }
  })
  on('fs.exists', (_, e) => ({ value: files.has(posix(e.path)) }))
  on('fs.list', (_, e) => {
    const dir = posix(e.path)

    return {
      value: [...files.entries()]
        .filter(([path]) => path.startsWith(`${dir}/`) && !path.slice(dir.length + 1).includes('/'))
        .map(([path, file]) => ({
          name: path.slice(dir.length + 1),
          kind: 'file' as const,
          size: file.text.length,
          mtimeMs: file.mtime,
          isLink: false,
        })),
    }
  })
  on('fs.read', (_, e) => {
    log.reads.push(posix(e.path))
    if (broken.has(posix(e.path))) throw new Error('EACCES')
    const file = files.get(posix(e.path))
    if (!file) throw new Error('ENOENT')
    return { value: file.text }
  })
  on('fs.write', (_, e) => {
    log.writes.push(posix(e.path))
    put(posix(e.path), e.text)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  return { files, put, log, dirs, broken }
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
    expect(await text(/‹ 85 PREV/)).toBeDefined()
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
    // A desktop's Button is blanks laid over the name, the name itself a Text before it (TASK-0241).
    const blank = /^ *$/
    const wordsOf = (i: number) => (blank.test(all[i]?.text ?? '') ? all.slice(0, i).reverse().find(one => one.type === 'Text' && !blank.test(one.text ?? ''))?.text : all[i]?.text) ?? ''
    const at = all.findIndex((one, i) => one.type === 'Button' && name.test(wordsOf(i)))
    const dot = all.slice(0, Math.max(0, at)).reverse().find(one => one.type === 'Text' && !name.test(one.text ?? ''))?.text
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

// A project whose tracker.conf names a forge: a read-only state card, nothing written (S011.T035).
const FORGE = { '/q/tracker.conf': GITLAB_CONF, '/q/.ai/00.CONVENTIONS.md': '# Conventions\n', '/q/.ai/20.PLAN.md': FORGE_PLAN }

test('a gitlab project shows its Plan card on both surfaces and writes nothing', async ($, on) => {
  mock.clock(on)
  const { log } = project(on, FORGE, false)
  await $.session.start({ cwd: '/q', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const text = async (pattern: RegExp) => (await ui.find({ text: pattern }))?.text
    expect(await text(/plan/i)).toBeDefined()
    expect(await text(/GITLAB GROUP\/DEMO/)).toBeDefined()
    expect(await text(/2026-05-02/)).toBeDefined()
    expect(await text(/Demo runs its build/)).toBeDefined()
    expect(await text(/S012_Importer/)).toBeDefined()
    expect(await text(/Demo planning board/)).toBeDefined()
    expect(await text(/group\/demo#14/)).toBeDefined()
    expect(await text(/group\/demo#21/)).toBeDefined()
    expect(await text(/pre-forge-migration/)).toBeDefined()
    expect(await text(/goals init|Sprint history/)).toBeUndefined()
    expect(await text(/‹|NEXT ›/)).toBeUndefined()
    await ui.unmount()
  }
  expect(log.writes).toEqual([])
})

test('on a forge the story tool names the forge, writes nothing and changes no focus', async ($, on) => {
  mock.clock(on)
  const { log } = project(on, FORGE, false)
  await $.session.start({ cwd: '/q', surface: 'terminal', isInteractive: true })

  const { description } = await $.tool.describe(DESCRIBE)
  expect(description).toContain('writes nothing')
  expect(description).toContain('calls no forge')
  expect(description).toContain('gitlab group/demo')
  expect(description).toContain('/q/.ai/20.PLAN.md')
  expect(description).toContain('Demo runs its build')
  expect(description).not.toMatch(/goals init|No GOALS\.md/)

  const ran = await $.tool.call({ ...STORY, story: 'group/demo#21' })
  expect(String(ran.result)).toContain('Nothing was written')
  expect(String(ran.result)).toContain('gitlab group/demo')
  const done = await $.tool.call({ tool: 'mcp__task-compass__story', story: '1.1', status: 'done' })
  expect(String(done.result)).toContain('Nothing was written')
  expect(log.writes).toEqual([])
})

test('on a forge /goals and /goals init decline and no GOALS.md is created', async ($, on) => {
  mock.clock(on)
  const { files, log } = project(on, FORGE, false)
  await $.session.start({ cwd: '/q', surface: 'terminal', isInteractive: true })

  for (const args of ['init', '']) {
    const said = await $.command.run(GOALS(args))
    expect(said.text).toContain('tracks its work on gitlab group/demo per tracker.conf')
    expect(said.text).toContain('no GOALS.md is written')
    expect(said.text).toContain('/q/.ai/20.PLAN.md')
  }
  expect(files.has('/q/.ai/GOALS.md')).toBe(false)
  expect(log.writes).toEqual([])
})

for (const stray of ['/q/GOALS.md', '/q/.ai/GOALS.md']) {
  test(`on a forge a ${stray} is not read, copied or drawn, and is reported as a stray`, async ($, on) => {
    mock.clock(on)
    const { files, log } = project(on, { ...FORGE, [stray]: OWN }, false)
    await $.session.start({ cwd: '/q', surface: 'desktop', isInteractive: true })

    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    expect(await ui.find({ text: /Own board/ })).toBeUndefined()
    expect(await ui.find({ text: /GITLAB GROUP\/DEMO/ })).toBeDefined()
    expect(await ui.find({ text: new RegExp(`${stray.replace(/\./g, '\\.')} is a stray GOALS.md`) })).toBeDefined()
    await ui.unmount()
    expect(files.has('/q/.ai/GOALS.md')).toBe(stray === '/q/.ai/GOALS.md')
    expect(log.reads.filter(path => path.endsWith('GOALS.md'))).toEqual([])
    expect((await $.command.run(GOALS())).text).toContain(`${stray} is a stray GOALS.md`)
    expect((await $.tool.describe(DESCRIBE)).description).toContain(`${stray} is a stray GOALS.md`)
    expect(log.writes).toEqual([])
  })
}

test('on a forge with no 20.PLAN.md the card says so and nothing is written', async ($, on) => {
  mock.clock(on)
  const { log } = project(on, { '/q/tracker.conf': GITLAB_CONF, '/q/.ai/00.CONVENTIONS.md': '# C\n' }, false)
  await $.session.start({ cwd: '/q', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /No 20\.PLAN\.md in \/q\/\.ai: on a forge tracker this file holds/ })).toBeDefined()
  expect(await ui.find({ text: /the board is on gitlab group\/demo\./ })).toBeDefined()
  await ui.unmount()
  expect((await $.command.run(GOALS('init'))).text).toContain('tracks its work on gitlab group/demo')
  expect(log.writes).toEqual([])
})

test('on a forge a 20.PLAN.md that is not the forge variant says so and shows nothing else', async ($, on) => {
  mock.clock(on)
  project(on, { ...FORGE, '/q/.ai/20.PLAN.md': '# Plan\n\n## Sprint 1\n- a task\n' }, false)
  await $.session.start({ cwd: '/q', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /is not the forge variant of 20\.PLAN\.md/ })).toBeDefined()
  expect(await ui.find({ text: /Current state|Next action/i })).toBeUndefined()
  await ui.unmount()
})

for (const [what, conf, error] of [
  ['an unknown key', 'tracker = gitlab\ngitlab_project = group/demo\nhost = x\n', "unknown key 'host'"],
  ['a URL path', 'tracker = gitlab\ngitlab_project = https://example.invalid/group/demo\n', 'names only'],
] as const) {
  test(`an invalid tracker.conf (${what}) is reported, nothing is written and GOALS.md is not the fallback`, async ($, on) => {
    mock.clock(on)
    const { log } = project(on, { ...FORGE, '/q/tracker.conf': conf, '/q/GOALS.md': OWN }, false)
    await $.session.start({ cwd: '/q', surface: 'desktop', isInteractive: true })

    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    expect(await ui.find({ text: new RegExp(`^/q/tracker\\.conf:.*${error}`) })).toBeDefined()
    expect(await ui.find({ text: /tracker\.conf:.*tracker\.conf/ })).toBeUndefined()
    expect(await ui.find({ text: /Own board|goals init|Sprint history/ })).toBeUndefined()
    await ui.unmount()
    const init = await $.command.run(GOALS('init'))
    expect(init.text).toContain("Compass cannot read this project's tracker.conf:")
    expect(init.text).not.toMatch(/tracker\.conf:.*tracker\.conf|\.\./)
    expect(init.text).toContain('Fix the declaration; no GOALS.md is written.')
    expect((await $.tool.describe(DESCRIBE)).description).toContain(error)
    expect(String((await $.tool.call(STORY)).result)).toContain(error)
    expect(log.writes).toEqual([])
  })
}

test('a forge project that still has the full files layer shows the card, not the sprints', async ($, on) => {
  mock.clock(on)
  const { log } = project(on, { '/q/tracker.conf': GITLAB_CONF, '/q/.ai/20.PLAN.md': FORGE_PLAN })
  await $.session.start({ cwd: '/q', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /GITLAB GROUP\/DEMO/ })).toBeDefined()
  expect(await ui.find({ text: /S087/ })).toBeUndefined()
  await ui.unmount()
  expect(log.writes).toEqual([])
})

test('tracker = files keeps the sprints, and a conf switched to a forge shows the card within a tick', async ($, on) => {
  const clock = mock.clock(on)
  const { put, files, log } = project(on, { '/q/tracker.conf': 'tracker = files\n' })
  await $.session.start({ cwd: '/q', surface: 'desktop', isInteractive: true })

  let ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /S087–S089 OPEN · 88 SPRINTS/ })).toBeDefined()
  expect(await ui.find({ text: /Site To Site Tunnel/ })).toBeDefined()
  expect(await ui.find({ text: /GITLAB/ })).toBeUndefined()
  await ui.unmount()

  put('/q/.ai/20.PLAN.md', FORGE_PLAN)
  put('/q/tracker.conf', GITLAB_CONF)
  await clock.advance(6_000)
  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /GITLAB GROUP\/DEMO/ })).toBeDefined()
  expect(await ui.find({ text: /S087/ })).toBeUndefined()
  await ui.unmount()
  expect(files.has('/q/.ai/GOALS.md')).toBe(false)
  expect(log.writes).toEqual([])
})

test('an Edit of a forge plan, or of tracker.conf, reloads at once', async ($, on) => {
  mock.clock(on)
  const { put, log } = project(on, FORGE, false)
  await $.session.start({ cwd: '/q', surface: 'desktop', isInteractive: true })

  put('/q/.ai/20.PLAN.md', FORGE_PLAN.replace('Take group/demo#21', 'Take group/demo#33'))
  await $.tool.call({ tool: 'Edit', file_path: '/q/.ai/20.PLAN.md', old_string: 'a', new_string: 'b' })
  let ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /group\/demo#33/ })).toBeDefined()
  await ui.unmount()

  put('/q/tracker.conf', GITHUB_CONF)
  await $.tool.call({ tool: 'Write', file_path: '/q/tracker.conf', content: GITHUB_CONF })
  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /GITHUB OWNER\/NAME/ })).toBeDefined()
  await ui.unmount()
  expect(log.writes).toEqual([])
})

test('a github conf names GITHUB owner/name', async ($, on) => {
  mock.clock(on)
  const { log } = project(on, { ...FORGE, '/q/tracker.conf': GITHUB_CONF }, false)
  await $.session.start({ cwd: '/q', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /GITHUB OWNER\/NAME/ })).toBeDefined()
  await ui.unmount()
  expect((await $.command.run(GOALS('init'))).text).toContain('github owner/name')
  expect(log.writes).toEqual([])
})

test('a tracker.conf that is a folder means files; one that cannot be read is reported and read again', async ($, on) => {
  const clock = mock.clock(on)
  const { put, dirs, broken, log } = project(on, {})
  dirs.add('/q/tracker.conf')
  await $.session.start({ cwd: '/q', surface: 'desktop', isInteractive: true })

  let ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /S087–S089 OPEN · 88 SPRINTS/ })).toBeDefined()
  expect(await ui.find({ text: /cannot be read/ })).toBeUndefined()
  await ui.unmount()
  expect(log.reads.filter(path => path.endsWith('tracker.conf'))).toEqual([])

  dirs.delete('/q/tracker.conf')
  put('/q/tracker.conf', GITLAB_CONF)
  put('/q/.ai/20.PLAN.md', FORGE_PLAN)
  broken.add('/q/tracker.conf')
  await clock.advance(6_000)
  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /^\/q\/tracker\.conf: the file is not readable$/ })).toBeDefined()
  expect(await ui.find({ text: /Own board|goals init|Sprint history/ })).toBeUndefined()
  await ui.unmount()
  expect(String((await $.tool.call(STORY)).result)).toContain("Compass cannot read this project's tracker.conf: the file is not readable. No GOALS.md is written.")

  // The failure was not cached: once the file reads again, the next tick shows the card.
  broken.delete('/q/tracker.conf')
  await clock.advance(6_000)
  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /GITLAB GROUP\/DEMO/ })).toBeDefined()
  await ui.unmount()
  expect(log.writes).toEqual([])
})

test('a plan file that cannot be read is said so, not called the wrong variant, and read again', async ($, on) => {
  const clock = mock.clock(on)
  const { broken, log } = project(on, FORGE, false)
  broken.add('/q/.ai/20.PLAN.md')
  await $.session.start({ cwd: '/q', surface: 'desktop', isInteractive: true })

  let ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /Compass cannot read \/q\/\.ai\/20\.PLAN\.md/ })).toBeDefined()
  expect(await ui.find({ text: /not the forge variant/ })).toBeUndefined()
  await ui.unmount()
  expect(String((await $.command.run(GOALS())).text)).toContain('Compass cannot read /q/.ai/20.PLAN.md')

  broken.delete('/q/.ai/20.PLAN.md')
  await clock.advance(6_000)
  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /Demo runs its build/ })).toBeDefined()
  await ui.unmount()
  expect(log.writes).toEqual([])
})

test('a Write of tracker.conf re-reads it even when its mtime and size are unchanged', async ($, on) => {
  mock.clock(on)
  const { files, log } = project(on, FORGE, false)
  await $.session.start({ cwd: '/q', surface: 'desktop', isInteractive: true })
  let ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /GITLAB GROUP\/DEMO/ })).toBeDefined()
  await ui.unmount()

  const same = { text: GITLAB_CONF.replace('group/demo', 'group/dome'), mtime: files.get('/q/tracker.conf')!.mtime }
  expect(same.text.length).toBe(GITLAB_CONF.length)
  files.set('/q/tracker.conf', same)
  await $.tool.call({ tool: 'Write', file_path: '/q/tracker.conf', content: same.text })
  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /GITLAB GROUP\/DOME/ })).toBeDefined()
  await ui.unmount()
  expect(log.writes).toEqual([])
})

test('on a forge with an invalid .ai-layout.json the story tool names the tracker and the layout error', async ($, on) => {
  mock.clock(on)
  const { log } = project(on, { ...FORGE, '/q/.ai-layout.json': '{ "root": ".ai", "tracker": "files" }' }, false)
  await $.session.start({ cwd: '/q', surface: 'terminal', isInteractive: true })

  const text = String((await $.tool.call({ ...STORY, story: 'S001.T001' })).result)
  expect(text).toContain('gitlab group/demo')
  expect(text).toContain('.ai-layout.json has an unknown key: tracker')
  expect(text).toContain('Nothing was written')
  expect(text).not.toContain('No task')
  expect(log.writes).toEqual([])
})
