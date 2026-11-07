import { expect, mock, test } from 'claude-code/testing'
import type { ConfigRow, On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import { TOKENS } from './sigma'
import { VERSION } from './view'

const DARK = TOKENS.dark

const PANE = {
  plugin: 'switchboard',
  component: 'Pane',
  requestId: 'switchboard',
  props: {
    title: 'Switchboard',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const LISTING = '- loop: Run a prompt on an interval.\n- review: Review a diff.'

/** The engine beneath the mod, in project `root.value`: what ran, and what was invalidated. */
const engine = (on: On, root: { value: string }, isRepo = false) => {
  const ran: string[] = []
  const invalidated: string[] = []
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.invalidate', (_, e) => {
    invalidated.push(String(e.event))
    return { value: undefined }
  })
  on('session.root', () => ({ value: root.value }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.list', () => ({
    value: [
      { name: 'mcp__figma__get_screenshot', description: 'x', mcp: true },
      { name: 'mcp__ccd_turn__update_plan', description: 'x', mcp: true },
    ],
  }))
  // The context breakdown: two skills, a desktop connector named by its id.
  const ID = '1a59c906-04da-521d-bda7-7f71b9f9e01c'
  on('session.usage', () => ({
    value: {
      context: {
        breakdown: {
          skills: { skillFrontmatter: [{ name: 'deploy' }, { name: 'review' }, { name: 'legal:brief' }] },
          mcpTools: ['batch', 'guide', 'update', 'read'].map(tool => ({ name: `mcp__${ID}__${tool}`, serverName: ID })),
        },
      },
    } as never,
  }))
  // One plugin folder, `/mods`, holding two mods with hooks and one plugin without.
  const files: Record<string, string> = {
    '/mods/agent-watch/.claude-plugin/plugin.json': '{"name":"agent-watch","category":"observability"}',
    '/mods/agent-watch/hooks/hooks.json': '{}',
    '/mods/task-compass/.claude-plugin/plugin.json': '{"name":"task-compass","category":"planning"}',
    '/mods/task-compass/hooks/hooks.json': '{}',
    '/mods/skills-only/.claude-plugin/plugin.json': '{"name":"skills-only"}',
  }
  // A checkout at `/p`: repo mods whose manifests are ahead of, or the same as, the copies loaded from `/mods`; and a template.
  if (isRepo) {
    Object.assign(files, {
      '/mods/agent-watch/.claude-plugin/plugin.json': '{"name":"agent-watch","category":"observability","version":"0.12.1"}',
      '/mods/task-compass/.claude-plugin/plugin.json': '{"name":"task-compass","category":"planning","version":"1.0.0"}',
      '/p/mods/agent-watch/claude/.claude-plugin/plugin.json': '{"name":"agent-watch","version":"0.13.1"}',
      '/p/mods/task-compass/claude/.claude-plugin/plugin.json': '{"name":"task-compass","version":"1.0.0"}',
      '/p/mods/switchboard/claude/.claude-plugin/plugin.json': '{"name":"switchboard","version":"0.8.0"}',
      '/p/mods/_template/claude/.claude-plugin/plugin.json': '{"name":"template","version":"0.1.0"}',
    })
  }
  mock.env(on, { CLAUDE_CODE_PLUGIN_DIRS: '/mods' })
  // The Windows CLI hands a path over as `C:\mods\...`; the fixtures are POSIX.
  const posix = (path: string) => path.replace(/^[A-Za-z]:/, '').replaceAll(String.fromCharCode(92), '/')
  on('fs.exists', (_, e) => ({ value: posix(e.path) in files }))
  on('fs.read', (_, e) => (posix(e.path) in files ? { value: files[posix(e.path)] as string } : { deny: 'ENOENT' }))
  on('fs.list', (_, e) =>
    posix(e.path) === '/mods' || (isRepo && posix(e.path) === '/p/mods')
      ? { value: (posix(e.path) === '/mods' ? ['agent-watch', 'task-compass', 'skills-only'] : ['_template', 'agent-watch', 'switchboard', 'task-compass']).map(name => ({ name, kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false })) }
      : { value: [] },
  )
  on('tool.call', (_, e) => {
    ran.push(String(e.tool))
    return { result: {} }
  })
  on('prompt.attachment', (_, e) => ({ text: e.text }))
  on('skill.prompt', (_, e) => ({ text: e.text }))
  on('tool.describe', (_, e) => ({ description: e.description }))
  on('plugin.register', () => ({ allow: true }))

  return { ran, invalidated }
}

const start = ($: Engine) =>
  $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })

const off = async ($: Engine, args: string) =>
  (await $.command.run({ command: 'switchboard', args } as never)) as { text: string }

test('a skill turned off is dropped from the listing, its call denied, its prompt replaced', async ($, on) => {
  mock.store(on)
  const said = engine(on, { value: '/p' })
  await start($)

  await off($, 'off skill loop')
  expect(said.invalidated).toContain('prompt.attachment')

  const listing = await $.prompt.attachment({ type: 'skill_listing', text: LISTING } as never)
  expect(listing.text).not.toContain('loop')
  expect(listing.text).toContain('review')

  const call = await $.tool.call({ tool: 'Skill', skill: 'loop' })
  expect('deny' in call && call.deny).toContain('turned off')
  expect(said.ran).not.toContain('Skill')

  await $.tool.call({ tool: 'Skill', skill: 'review' })
  expect(said.ran).toContain('Skill')

  const prompt = await $.skill.prompt({ skill: 'loop', text: 'do the loop', frontmatter: {} } as never)
  expect(prompt.text).toContain('turned off')
})

// `plugin.register` cannot be raised from a test (the kit's `$` has no
// `plugin` noun): its rule is the pure `refusal`, tested in model.test.ts.
test('a server turned off is denied and deferred', async ($, on) => {
  mock.store(on)
  const said = engine(on, { value: '/p' })
  await start($)
  await off($, 'off connector figma')

  const call = await $.tool.call({ tool: 'mcp__figma__get_screenshot' } as never)
  expect('deny' in call && call.deny).toContain('figma')
  expect(said.ran).not.toContain('mcp__figma__get_screenshot')

  const described = await $.tool.describe({
    tool: 'mcp__figma__get_screenshot',
    description: 'Screenshot a node',
    provider: { plugin: 'mcp:figma', tier: 'user' },
  } as never)
  expect(described.isDeferred).toBe(true)
  expect(described.description).toContain('Turned off')

  await off($, 'on connector figma')
  const back = await $.tool.describe({
    tool: 'mcp__figma__get_screenshot',
    description: 'Screenshot a node',
    provider: { plugin: 'mcp:figma', tier: 'user' },
  } as never)
  expect(back.isDeferred).toBeUndefined()
})

test('the command refuses to turn switchboard off', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' })
  await start($)
  expect((await off($, 'off mod switchboard')).text).toContain('cannot turn itself off')
  expect((await off($, 'off mod agent-watch')).text).toContain('mod agent-watch is off')
})

test('toggles are kept per project root and survive in the store', async ($, on) => {
  mock.store(on)
  const root = { value: '/p' }
  engine(on, root)
  await start($)
  await off($, 'off skill loop')

  root.value = '/q'
  expect((await $.tool.call({ tool: 'Skill', skill: 'loop' })).deny).toBeUndefined()

  root.value = '/p'
  expect((await $.tool.call({ tool: 'Skill', skill: 'loop' })).deny).toContain('turned off')
  await off($, 'on skill loop')
  expect((await $.tool.call({ tool: 'Skill', skill: 'loop' })).deny).toBeUndefined()
})

test('the pane lists every mod with hooks from the plugin folders, each with an On/Off toggle', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' })
  await start($)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ text: /MODS  3/ }))?.text).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^SWITCHBOARD$/ }))?.props.color).toBe(DARK['text-1'])
    expect((await ui.find({ text: /^ AGENT-WATCH$/ }))?.text).toBeDefined()
    expect((await ui.find({ text: /^ TASK-COMPASS$/ }))?.text).toBeDefined()
    expect(await ui.find({ text: /skills-only/ })).toBeUndefined()
    expect((await ui.find({ text: /^  ALWAYS ON$/ }))?.text).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^ SWITCHBOARD$/ }))?.props.color).toBe(DARK['text-3'])
    // SIGMAorbital's Toggle: a square track, text-1 while on, the name uppercase, then ON in text-3.
    const on = await ui.find({ type: 'Button', key: 'mod-agent-watch' })
    expect(on?.props.label).toBe('AGENT-WATCH ON')
    expect(on?.props.plain).toBe(true)
    expect(on?.props.variant).toBeUndefined()
    // switchboard's own disabled track is text-3; an enabled one is text-1.
    const tracks = (await ui.findAll({ type: 'Text', text: /^\[ ■\]$/ })).map(one => one.props.color)
    expect(tracks).toContain(DARK['text-1'])
    expect(tracks).toContain(DARK['text-3'])
    expect((await ui.find({ type: 'Text', text: /^ AGENT-WATCH$/ }))?.props.color).toBe(DARK['text-1'])
    expect((await ui.findAll({ type: 'Text', text: /^  ON$/ }))[0]?.props.color).toBe(DARK['text-3'])
    expect((await ui.findAll({ type: 'Text' })).filter(one => one.props.dimColor || (one.props.bold && !one.props.weight)).length).toBe(0)
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'mod-agent-watch' })
  expect((await ui.find({ text: /MODS  3 · ○ 1 OFF/ }))?.text).toBeDefined()
  // Off: the knob at the left, track in line-strong, the word OFF.
  const switched = await ui.find({ type: 'Button', key: 'mod-agent-watch' })
  expect(switched?.props.label).toBe('AGENT-WATCH OFF')
  expect((await ui.find({ type: 'Text', text: /^\[■ \]$/ }))?.props.color).toBe(DARK['line-strong'])
  expect((await ui.find({ type: 'Text', text: /^ off from the next session$/ }))?.props.color).toBe(DARK.amber)
  await ui.press({ key: 'mod-agent-watch' })
  expect(await ui.find({ type: 'Text', text: /^ (on|off) from the next session$/ })).toBeUndefined()
  await ui.unmount()
})

test('skills and connectors open from their header; a toggle there acts next turn', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' })
  await start($)
  await $.prompt.attachment({ type: 'skill_listing', text: LISTING } as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ text: /SKILLS  4/ }))?.text).toBeDefined()
  expect(await ui.find({ text: /^ LOOP$/ })).toBeUndefined()
  await ui.press({ key: 'section-skill' })
  expect((await ui.find({ text: /^ LOOP$/ }))?.text).toBeDefined()
  await ui.press({ key: 'skill-loop' })
  expect((await $.tool.call({ tool: 'Skill', skill: 'loop' })).deny).toContain('turned off')
  await ui.press({ key: 'section-connector' })
  expect((await ui.find({ text: /^ FIGMA$/ }))?.text).toBeDefined()
  await ui.unmount()
})

test('mods and skills sit under topic sub-headers, in text-3, with their counts; a press collapses one', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' })
  await start($)
  await $.prompt.attachment({ type: 'skill_listing', text: LISTING } as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  // Mods: each manifest's category, switchboard under its own, none under OTHER.
  for (const topic of ['CONFIGURATION', 'OBSERVABILITY', 'PLANNING']) {
    expect((await ui.find({ type: 'Text', text: new RegExp(`^▾ ${topic}$`) }))?.props.color).toBe(DARK['text-3'])
  }
  expect((await ui.find({ type: 'Text', text: /^1$/ }))?.props.tabular).toBe(true)
  expect(await ui.find({ text: /OTHER/ })).toBeUndefined()
  const topics = (await ui.findAll({ type: 'Text', text: /^▾ [A-Z]+$/ })).map(one => one.text)
  expect(topics).toEqual(['▾ CONFIGURATION', '▾ OBSERVABILITY', '▾ PLANNING'])

  // Skills: by plugin prefix, with STANDALONE last.
  await ui.press({ key: 'section-skill' })
  const skillTopics = (await ui.findAll({ type: 'Text', text: /^▾ (LEGAL|STANDALONE)$/ })).map(one => one.text)
  expect(skillTopics).toEqual(['▾ LEGAL', '▾ STANDALONE'])
  expect((await ui.find({ text: /^ LEGAL:BRIEF$/ }))?.text).toBeDefined()

  // A press on a group header hides its rows; another shows them again.
  await ui.press({ key: 'group-mod:observability' })
  expect((await ui.find({ type: 'Text', text: /^▸ OBSERVABILITY$/ }))?.text).toBeDefined()
  expect(await ui.find({ text: /^ AGENT-WATCH$/ })).toBeUndefined()
  expect((await ui.find({ text: /^ TASK-COMPASS$/ }))?.text).toBeDefined()
  await ui.press({ key: 'group-mod:observability' })
  expect((await ui.find({ text: /^ AGENT-WATCH$/ }))?.text).toBeDefined()
  expect((await ui.findAll({ type: 'Text' })).filter(one => one.props.dimColor || (one.props.bold && !one.props.weight)).length).toBe(0)
  await ui.unmount()
})

test('the command opens the pane when a kind or a name is left out', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' })
  await start($)
  for (const args of ['', 'on', 'off mod', 'mod']) expect((await off($, args)).text).toBe('Switchboard opened.')
})

test('skills and servers come from the context breakdown; an id-named server shows its tools', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' })
  await start($)

  const { text } = await off($, 'list')
  expect(text).toContain('on   deploy')
  expect(text).toContain('1a59c906… (batch, guide, update)')
  expect(text).not.toContain('read')
})

test("the desktop app's own servers are never listed, turned off or refused", async ($, on) => {
  mock.store(on, { 'off:/p': { mod: [], skill: [], connector: ['ccd_turn'] } })
  const said = engine(on, { value: '/p' })
  await start($)

  expect((await off($, 'list')).text).not.toContain('ccd_turn')
  expect((await off($, 'off connector ccd_turn')).text).toContain('stays on')
  expect((await $.tool.call({ tool: 'mcp__ccd_turn__update_plan' } as never)).deny).toBeUndefined()
  expect(said.ran).toContain('mcp__ccd_turn__update_plan')
})

const OUTPUT = (text: string) => ({
  plugin: 'switchboard',
  component: 'CommandOutput',
  props: { command: 'switchboard', args: 'list', text, isErrored: false },
}) as const

test('/switchboard list draws a panel per kind in the host theme; an unknown row stays text', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' })
  on('config.list', () => ({ value: [{ key: 'theme', value: 'light' } as ConfigRow] }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await start($)
  await off($, 'off mod agent-watch')
  const { text } = await off($, 'list')
  // The text the model reads still names each row's state; since 0.5.0 its rows sit under topic lines.
  expect(text).toContain('off  agent-watch')
  const LIGHT = TOKENS.light

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...OUTPUT(text), surface })
    expect((await ui.find({ type: 'Text', text: /^MODS$/ }))?.props.color).toBe(LIGHT['text-1'])
    expect(await ui.find({ type: 'Text', text: /^SKILLS$/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^agent-watch$/ }))?.props.color).toBe(LIGHT['text-3'])
    expect((await ui.find({ type: 'Text', text: /^task-compass$/ }))?.props.color).toBe(LIGHT['text-1'])
    expect((await ui.findAll({ type: 'Text', text: / ON$/ }))[0]?.props.color).toBe(LIGHT.cyan)
    await ui.unmount()
  }
  const old = await $.ui.mount({ ...OUTPUT('mods (next session):'), surface: 'terminal' })
  expect((await old.find({ type: 'Text' }))?.text).toBe('engine')
  await old.unmount()
})

test('the Switchboard panel has the resize handle on its bottom edge: a drag holds its body, a double press lets it go, mobile has none (ADR-0053)', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' })
  on('ui.message', () => ({}))
  await start($)
  const body = async (ui: Awaited<ReturnType<typeof $.ui.mount>>) => ((await ui.find({ key: 'switchboard-handle-body' }))?.props as { height?: number } | undefined)?.height
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Client', key: 'switchboard-handle' })).toBeDefined()
    expect(await body(ui)).toBeUndefined()
    await ui.pointer({ type: 'down', x: 5, y: 0, button: 'left', in: 'switchboard-handle' })
    await ui.pointer({ type: 'move', x: 5, y: -200, button: 'left', in: 'switchboard-handle' })
    await ui.pointer({ type: 'up', x: 5, y: -200, button: 'left', in: 'switchboard-handle' })
    expect(await body(ui)).toBe(4)
    await ui.pointer({ type: 'down', x: 5, y: 0, button: 'left', in: 'switchboard-handle' })
    await ui.pointer({ type: 'down', x: 5, y: 0, button: 'left', in: 'switchboard-handle' })
    expect(await body(ui)).toBeUndefined()
    await ui.unmount()
  }
  const phone = await $.ui.mount({ ...PANE, surface: 'mobile' })
  expect(await phone.findAll({ type: 'Client' })).toHaveLength(0)
  await phone.unmount()
})

test('/switchboard theme light pins Daylight for the next render; a bad value answers with usage', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' })
  on('config.list', () => ({ value: [{ key: 'theme', value: 'dark' } as ConfigRow] }))
  await start($)

  const bad = await off($, 'theme blue')
  expect(bad.text).toBe('Unknown theme "blue". Usage: /switchboard [list | on|off mod|skill|connector <name> | theme dark|light|auto]')

  const pinned = await off($, 'theme light')
  expect(pinned.text).toBe('Colours: Daylight (pinned; "theme auto" follows the theme setting again)')
  const { text } = await off($, 'list')
  const ui = await $.ui.mount({ ...OUTPUT(text), surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^MODS$/ }))?.props.color).toBe(TOKENS.light['text-1'])
  await ui.unmount()
})

test('the pane lists each repo mod\'s loaded version beside its manifest, with a mark for a stale or foreign copy', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' }, true)
  await start($)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  // Three repo mods (the template is left out): agent-watch is stale and loaded from /mods, task-compass loaded from /mods.
  expect((await ui.find({ type: 'Text', text: /^VERSIONS  3 · ▲ 2$/ }))?.text).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /^loaded 0\.12\.1 · manifest 0\.13\.1$/ }))?.text).toBeDefined()
  const notes = (await ui.findAll({ type: 'Text', text: /^ {2}▲ / })).map(one => one.text)
  expect(notes).toEqual([
    '  ▲ stale: restart or /reload-plugins to load 0.13.1; loaded from elsewhere: /mods/agent-watch',
    '  ▲ loaded from elsewhere: /mods/task-compass',
  ])
  expect((await ui.find({ type: 'Text', text: /^AGENT-WATCH$/ }))?.props.color).toBe(DARK.amber)
  // switchboard is not in the plugin folders and raised no plugin.register in a test: not loaded.
  expect((await ui.find({ type: 'Text', text: /not loaded in this session/ }))?.text).toBeDefined()
  expect(await ui.find({ text: /TEMPLATE/ })).toBeUndefined()
  await ui.unmount()
})

test('without mods in the project root the pane has no Versions section', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' })
  await start($)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /VERSIONS/ })).toBeUndefined()
  // The pane's own version line is always there.
  expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  expect((await ui.find({ type: 'Text', text: `SWITCHBOARD ${VERSION}` }))?.props.color).toBe(DARK['text-3'])
  await ui.unmount()
})
