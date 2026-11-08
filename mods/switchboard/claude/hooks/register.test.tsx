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

/** 128 skills as a desktop lists them: 100 under `anthropic-skills`, 20 under `engineering`, 8 standalone; and 24 servers. */
const MANY_SKILLS = [
  ...Array.from({ length: 100 }, (_, i) => `anthropic-skills:skill-number-${i + 1}`),
  ...Array.from({ length: 20 }, (_, i) => `engineering:review-step-${i + 1}`),
  ...Array.from({ length: 8 }, (_, i) => `standalone-${i + 1}`),
]
const MANY_SERVERS = Array.from({ length: 24 }, (_, i) => `server_${i + 1}`)

/** The engine beneath the mod, in project `root.value`: what ran, and what was invalidated. */
const engine = (on: On, root: { value: string }, isRepo = false, many = false, moreRepoMods = 0) => {
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
        breakdown: many
          ? {
              // A real desktop's count (2026-11-08): 128 skills across plugins, 24 connectors.
              skills: { skillFrontmatter: MANY_SKILLS.map(name => ({ name })) },
              mcpTools: MANY_SERVERS.flatMap(server => ['get', 'list'].map(tool => ({ name: `mcp__${server}__${tool}`, serverName: server }))),
            }
          : {
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
  // More checkout mods, none loaded: each a Versions row with its note.
  const extraRepo = Array.from({ length: moreRepoMods }, (_, i) => `a-checkout-mod-with-a-long-name-number-${i + 1}`)
  for (const name of extraRepo) files[`/p/mods/${name}/claude/.claude-plugin/plugin.json`] = JSON.stringify({ name, version: '1.2.3' })
  mock.env(on, { CLAUDE_CODE_PLUGIN_DIRS: '/mods' })
  // The Windows CLI hands a path over as `C:\mods\...`; the fixtures are POSIX.
  const posix = (path: string) => path.replace(/^[A-Za-z]:/, '').replaceAll(String.fromCharCode(92), '/')
  on('fs.exists', (_, e) => ({ value: posix(e.path) in files }))
  on('fs.read', (_, e) => (posix(e.path) in files ? { value: files[posix(e.path)] as string } : { deny: 'ENOENT' }))
  on('fs.list', (_, e) =>
    posix(e.path) === '/mods' || (isRepo && posix(e.path) === '/p/mods')
      ? { value: (posix(e.path) === '/mods' ? ['agent-watch', 'task-compass', 'skills-only'] : ['_template', 'agent-watch', 'switchboard', 'task-compass', ...extraRepo]).map(name => ({ name, kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false })) }
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

type Mounted = Awaited<ReturnType<Engine['ui']['mount']>>

/** An element as `find` describes its children. */
type Drawn = { type?: string; props?: Record<string, unknown>; children?: unknown[] }
const textsIn = (node: unknown): Drawn[] =>
  typeof node !== 'object' || node === null ? [] : (node as Drawn).type === 'Text' ? [node as Drawn] : ((node as Drawn).children ?? []).flatMap(textsIn)
const textOf = (node: Drawn | undefined) => (node?.children ?? []).filter(one => typeof one === 'string').join('')

/**
 * The Texts that show words under the element keyed `key`, in drawing order: a Text keeps no key, so the Box around
 * them carries it. A pressable's blank (figure spaces) and a rule's glyphs show none.
 */
const wordsUnder = async (ui: Mounted, key: string) => {
  const found = await ui.find({ key })
  return (found?.children ?? []).flatMap(textsIn).filter(one => textOf(one).trim() !== '' && !/^─+$/.test(textOf(one)))
}

/**
 * A header's Texts (TASK-0257): its fold glyph, its title and its counts, each a Text of its own since a desktop
 * draws a Button's words in its own colour; `key` is the press, `section-<kind>` or `group-<kind>:<topic>`.
 */
const headerTexts = async (ui: Mounted, key: string) => {
  const [glyph, title, count] = await wordsUnder(ui, `${key}-head`)
  return { glyph, title, count }
}
/** A header's words: its glyph, title and counts. */
const header = async (ui: Mounted, key: string) => {
  const { glyph, title, count } = await headerTexts(ui, key)
  return { glyph: glyph && textOf(glyph), title: title && textOf(title), count: count && textOf(count) }
}

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
    expect(await header(ui, 'section-mod')).toEqual({ glyph: '▾', title: ' MODS', count: '3' })
    expect((await ui.find({ type: 'Text', text: /^SWITCHBOARD$/ }))?.props.color).toBe(DARK['text-1'])
    expect((await ui.find({ text: /^ AGENT-WATCH$/ }))?.text).toBeDefined()
    expect((await ui.find({ text: /^ TASK-COMPASS$/ }))?.text).toBeDefined()
    expect(await ui.find({ text: /skills-only/ })).toBeUndefined()
    expect((await ui.find({ text: /^  ALWAYS ON$/ }))?.text).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^ SWITCHBOARD$/ }))?.props.color).toBe(DARK['text-3'])
    // SIGMAorbital's Toggle: a square track, text-1 while on, the name uppercase, then ON in text-3.
    const on = await ui.find({ type: 'Button', key: 'mod-agent-watch' })
    expect(on?.props.plain).toBe(true)
    expect(on?.props.variant).toBeUndefined()
    if (surface === 'terminal') {
      expect(on?.props.label).toBe('AGENT-WATCH ON')
      // switchboard's own disabled track is text-3; an enabled one is text-1.
      const tracks = (await ui.findAll({ type: 'Text', text: /^\[ ■\]$/ })).map(one => one.props.color)
      expect(tracks).toContain(DARK['text-1'])
      expect(tracks).toContain(DARK['text-3'])
    } else {
      // A desktop draws a Button's label over what it holds, so the Button is blank and the track is an Svg.
      expect(String(on?.props.label ?? '').trim()).toBe('')
      const tracks = await ui.findAll({ type: 'Svg' })
      expect(tracks.find(one => one.props.alt === 'AGENT-WATCH ON')?.props.source).toContain(`fill="${DARK['text-1']}"/></svg>`)
      expect(tracks.find(one => one.props.alt === 'SWITCHBOARD ALWAYS ON')?.props.source).toContain(`fill="${DARK['text-3']}"/></svg>`)
    }
    // A row's name is body text, text-2 at the body weight, under the section's text-1 title (TASK-0257).
    expect((await ui.find({ type: 'Text', text: /^ AGENT-WATCH$/ }))?.props.color).toBe(DARK['text-2'])
    expect((await ui.find({ type: 'Text', text: /^ AGENT-WATCH$/ }))?.props.weight).toBeUndefined()
    expect((await ui.findAll({ type: 'Text', text: /^  ON$/ }))[0]?.props.color).toBe(DARK['text-3'])
    expect((await ui.findAll({ type: 'Text' })).filter(one => one.props.dimColor || (one.props.bold && !one.props.weight)).length).toBe(0)
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'mod-agent-watch' })
  expect((await header(ui, 'section-mod')).count).toBe('3 · ○ 1 OFF')
  // Off, the name falls back to text-3, as an offline item does.
  expect((await ui.find({ type: 'Text', text: /^ AGENT-WATCH$/ }))?.props.color).toBe(DARK['text-3'])
  // Off: the knob at the left, track in line-strong, the word OFF.
  const switched = (await ui.findAll({ type: 'Svg' })).find(one => one.props.alt === 'AGENT-WATCH OFF')
  expect(switched?.props.source).toContain(`<rect x="3" y="3" width="8" height="8" fill="${DARK['line-strong']}"/>`)
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
  expect(await header(ui, 'section-skill')).toEqual({ glyph: '▸', title: ' SKILLS', count: '4' })
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
  // The topic titles in drawing order, `kind` one of mod or skill.
  const titles = async (kind: string) =>
    Promise.all(
      (await ui.findAll({ type: 'Box' }))
        .filter(one => one.key?.startsWith(`group-${kind}:`) && one.key.endsWith('-head'))
        .map(async one => (await header(ui, String(one.key).replace(/-head$/, ''))).title),
    )
  // Mods: each manifest's category, switchboard under its own, none under OTHER.
  for (const topic of ['configuration', 'observability', 'planning']) {
    const { glyph, title } = await headerTexts(ui, `group-mod:${topic}`)
    expect(textOf(title)).toBe(` ${topic.toUpperCase()}`)
    expect(title?.props?.color).toBe(DARK['text-3'])
    expect(title?.props?.size).toBe('caption')
    expect(textOf(glyph)).toBe('▾')
  }
  expect((await headerTexts(ui, 'group-mod:planning')).count?.props?.tabular).toBe(true)
  expect((await header(ui, 'group-mod:planning')).count).toBe('1')
  expect(await ui.find({ text: /OTHER/ })).toBeUndefined()
  expect(await titles('mod')).toEqual([' CONFIGURATION', ' OBSERVABILITY', ' PLANNING'])

  // Skills: by plugin prefix, with STANDALONE last.
  await ui.press({ key: 'section-skill' })
  expect(await titles('skill')).toEqual([' LEGAL', ' STANDALONE'])
  expect((await ui.find({ text: /^ LEGAL:BRIEF$/ }))?.text).toBeDefined()

  // A press on a group header hides its rows; another shows them again.
  await ui.press({ key: 'group-mod:observability' })
  expect((await header(ui, 'group-mod:observability')).glyph).toBe('▸')
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
  // The section's header is the others' (TASK-0257): a fold glyph, the title, the counts; a press folds it.
  expect(await header(ui, 'section-versions')).toEqual({ glyph: '▾', title: ' VERSIONS', count: '3 · ▲ 2' })
  // Label and value, as Agents' Selected panel draws them: the label text-3 caption, the version text-1 tabular.
  for (const word of [/^LOADED$/, /^MANIFEST$/, /^VERSION$/]) expect((await ui.find({ type: 'Text', text: word }))?.props).toMatchObject({ color: DARK['text-3'], size: 'caption' })
  for (const version of [/^0\.12\.1$/, /^0\.13\.1$/, /^1\.0\.0$/]) expect((await ui.find({ type: 'Text', text: version }))?.props).toMatchObject({ color: DARK['text-1'], tabular: true })
  const notes = (await ui.findAll({ type: 'Text', text: /^ {2}▲ / })).map(one => one.text)
  expect(notes).toEqual([
    '  ▲ stale: restart or /reload-plugins to load 0.13.1; loaded from elsewhere: /mods/agent-watch',
    '  ▲ loaded from elsewhere: /mods/task-compass',
  ])
  // The name is a row's text-2; the caution colour sits on its glyph beside it, never on the name alone.
  expect((await ui.find({ type: 'Text', text: /^AGENT-WATCH$/ }))?.props.color).toBe(DARK['text-2'])
  const [mark] = await wordsUnder(ui, 'version-agent-watch-mark')
  expect(textOf(mark)).toBe('▲')
  expect(mark?.props?.color).toBe(DARK.amber)
  expect(await wordsUnder(ui, 'version-switchboard-mark')).toEqual([])
  // switchboard is not in the plugin folders and raised no plugin.register in a test: not loaded.
  expect((await ui.find({ type: 'Text', text: /not loaded in this session/ }))?.text).toBeDefined()
  expect(await ui.find({ text: /TEMPLATE/ })).toBeUndefined()
  await ui.press({ key: 'section-versions' })
  expect((await header(ui, 'section-versions')).glyph).toBe('▸')
  expect(await ui.find({ type: 'Text', text: /^AGENT-WATCH$/ })).toBeUndefined()
  await ui.unmount()
})

test('without mods in the project root the pane has no Versions section', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' })
  await start($)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /VERSIONS/ })).toBeUndefined()
  // The pane's own version line is always there, at the right of the legend as Compass's is (TASK-0257).
  expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  const [line] = await wordsUnder(ui, 'switchboard-version')
  expect(textOf(line)).toBe(`SWITCHBOARD ${VERSION}`)
  expect(line?.props).toMatchObject({ color: DARK['text-3'], size: 'caption' })
  // The legend: each mark the pane uses, its glyph in its colour and its word in text-3.
  const [offGlyph, offWord] = await wordsUnder(ui, 'legend-off')
  expect(offGlyph?.props?.color).toBe(DARK['text-3'])
  expect(textOf(offWord)).toBe(' OFF')
  const [cautionGlyph, cautionWord] = await wordsUnder(ui, 'legend-caution')
  expect(cautionGlyph?.props?.color).toBe(DARK.amber)
  expect(cautionWord?.props).toMatchObject({ color: DARK['text-3'], size: 'caption' })
  await ui.unmount()
})

// The person, 2026-11-08, at 0.8.1 beside Compass and Agents: "Still not following the same design system as compass and agent-watch".
test('the pane is one bracketed SIGMAorbital frame opening on a KPI row, as Compass and Agents are (TASK-0257)', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' })
  await start($)
  await $.prompt.attachment({ type: 'skill_listing', text: LISTING } as never)
  await off($, 'off mod agent-watch')

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    if (surface === 'desktop') {
      // The region frame: the surface fill, a square line border and eight text-1 bracket arms, clipped from bordered Boxes.
      const boxes = await ui.findAll({ type: 'Box' })
      expect(boxes.filter(one => one.props.backgroundColor === DARK.surface).length).toBeGreaterThan(0)
      expect(boxes.filter(one => one.props.borderColor === DARK['text-1']).length).toBe(8)
    } else {
      for (const glyph of ['┌', '┐', '└', '┘']) expect((await ui.find({ type: 'Text', text: glyph }))?.props.color).toBe(DARK['text-1'])
    }
    // The KPI row: MODS, SKILLS, CONNECTORS and OFF, each a text-3 label over a text-1 tabular value.
    for (const word of ['MODS', 'SKILLS', 'CONNECTORS', 'OFF']) {
      expect((await ui.find({ type: 'Text', text: new RegExp(`^${word}$`) }))?.props).toMatchObject({ color: DARK['text-3'], size: 'caption' })
    }
    const values = (await ui.findAll({ type: 'Text' })).filter(one => one.props.size === 'title')
    expect(values.map(one => one.props.color)).toEqual([DARK['text-1'], DARK['text-1'], DARK['text-1'], DARK['text-1']])
    expect(values.every(one => one.props.tabular === true)).toBe(true)
    // Each kind's value is its section's count; OFF is everything off.
    const counts = await Promise.all(['mod', 'skill', 'connector'].map(async kind => (await header(ui, `section-${kind}`)).count?.split(' ')[0]))
    expect(values.map(one => one.text)).toEqual([...counts, '1'])
    expect(counts.slice(0, 2)).toEqual(['3', '4'])
    await ui.unmount()
  }
})

test('on a desktop each header is a pressable, its words Texts in their tokens under a blank Button; SKILLS and a topic open on a press (TASK-0257)', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' })
  on('config.list', () => ({ value: [{ key: 'theme', value: 'dark' } as ConfigRow] }))
  await start($)
  await $.prompt.attachment({ type: 'skill_listing', text: LISTING } as never)

  for (const theme of ['dark', 'light'] as const) {
    if (theme === 'light') await off($, 'theme light')
    const T = TOKENS[theme]
    // The control token: line-strong in Night ops, text-3 in Daylight (TASK-0241).
    const control = theme === 'dark' ? T['line-strong'] : T['text-3']
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    // A desktop draws a Button's words in its own colour (TASK-0241): every header Button is blank, plain and unlabelled.
    for (const key of ['section-mod', 'section-skill', 'section-connector', 'group-mod:observability']) {
      const button = await ui.find({ type: 'Button', key })
      expect(button?.props.plain).toBe(true)
      // The kit reports the blank as the label; nothing a desktop could draw over the words.
      expect(String(button?.props.label ?? '').trim()).toBe('')
      expect(String(button?.text).trim()).toBe('')
    }
    expect(await header(ui, 'section-skill')).toEqual({ glyph: '▸', title: ' SKILLS', count: '4' })
    const skills = await headerTexts(ui, 'section-skill')
    expect(skills.glyph?.props?.color).toBe(control)
    expect(skills.title?.props).toMatchObject({ color: T['text-1'], weight: 'semibold' })
    expect(skills.count?.props).toMatchObject({ color: T['text-3'], size: 'caption', tabular: true })
    expect(await ui.find({ text: /^ LEGAL:BRIEF$/ })).toBeUndefined()

    await ui.press({ key: 'section-skill' })
    expect((await header(ui, 'section-skill')).glyph).toBe('▾')
    expect((await ui.find({ text: /^ LOOP$/ }))?.text).toBeDefined()
    // Topics start open; a press folds LEGAL, and the press under test opens it again.
    expect((await header(ui, 'group-skill:legal')).glyph).toBe('▾')
    await ui.press({ key: 'group-skill:legal' })
    expect(await header(ui, 'group-skill:legal')).toEqual({ glyph: '▸', title: ' LEGAL', count: '1' })
    expect((await headerTexts(ui, 'group-skill:legal')).glyph?.props?.color).toBe(control)
    expect(String((await ui.find({ type: 'Button', key: 'group-skill:legal' }))?.text).trim()).toBe('')
    expect(await ui.find({ text: /^ LEGAL:BRIEF$/ })).toBeUndefined()

    await ui.press({ key: 'group-skill:legal' })
    expect((await header(ui, 'group-skill:legal')).glyph).toBe('▾')
    expect((await ui.find({ text: /^ LEGAL:BRIEF$/ }))?.text).toBeDefined()
    // Back as it was, for the other theme.
    await ui.press({ key: 'section-skill' })
    await ui.unmount()
  }
})

/** What the engine draws at most: "every tree's bounds (20,000 nodes, 32 deep, 100,000 characters serialized)". */
const TREE_CHARS = 100_000
const chars = async (ui: Awaited<ReturnType<Engine['ui']['mount']>>) => JSON.stringify(await ui.drawn()).length

// A desktop refuses a tree past its bounds and keeps its last drawing, or on a fresh mount has none ("switchboard
// has not drawn in this pane"). With TASK-0256's desktop toggle (an Svg and an overlay Button a row) SKILLS open
// at 128 drew 184,790 characters: the header press seemed dead and a session switch blanked the pane.
test('on a desktop SKILLS opens with 128 skills and CONNECTORS with 25, the tree within the engine bounds (TASK-0256)', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' }, false, true)
  await start($)

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await header(ui, 'section-skill')).toEqual({ glyph: '▸', title: ' SKILLS', count: '128' })
    await ui.press({ key: 'section-skill' })
    expect((await header(ui, 'section-skill')).glyph).toBe('▾')
    expect(await header(ui, 'group-skill:anthropic-skills')).toEqual({ glyph: '▾', title: ' ANTHROPIC-SKILLS', count: '100' })
    expect((await ui.find({ text: /^ ANTHROPIC-SKILLS:SKILL-NUMBER-1$/ }))?.text).toBeDefined()
    expect(await chars(ui)).toBeLessThanOrEqual(TREE_CHARS)
    await ui.press({ key: 'section-connector' })
    expect(await header(ui, 'section-connector')).toEqual({ glyph: '▾', title: ' CONNECTORS', count: '25' })
    expect(await chars(ui)).toBeLessThanOrEqual(TREE_CHARS)
    // What does not fit says so, with the way to reach it; closing a group frees its room for the rows after it.
    expect((await ui.find({ type: 'Text', text: /^\+ \d+ more not drawn/ }))?.text).toBeDefined()
    await ui.press({ key: 'group-skill:anthropic-skills' })
    expect((await header(ui, 'group-skill:anthropic-skills')).glyph).toBe('▸')
    expect(await ui.find({ text: /^ ANTHROPIC-SKILLS:SKILL-NUMBER-1$/ })).toBeUndefined()
    expect((await ui.find({ text: /^ ENGINEERING:REVIEW-STEP-20$/ }))?.text).toBeDefined()
    expect(await chars(ui)).toBeLessThanOrEqual(TREE_CHARS)
    await ui.press({ key: 'group-skill:anthropic-skills' })
    await ui.press({ key: 'section-skill' })
    await ui.press({ key: 'section-connector' })
    await ui.unmount()
  }
})

test('a fresh desktop mount after the sections were opened draws the pane, as a session switched away and back does (TASK-0256)', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' }, false, true)
  await start($)

  const first = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await first.press({ key: 'section-skill' })
  await first.press({ key: 'section-connector' })
  await first.unmount()

  const again = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await chars(again)).toBeLessThanOrEqual(TREE_CHARS)
  expect(await header(again, 'section-skill')).toEqual({ glyph: '▾', title: ' SKILLS', count: '128' })
  expect(await header(again, 'section-connector')).toEqual({ glyph: '▾', title: ' CONNECTORS', count: '25' })
  expect((await again.find({ type: 'Text', text: /^SWITCHBOARD \d/ }))?.text).toBeDefined()
  await again.unmount()
})

test('however many skills and however long their names, the desktop tree stays within the bounds (TASK-0256)', async ($, on) => {
  mock.store(on, { 'off:/p': { mod: [], skill: [], connector: [] } })
  engine(on, { value: '/p' }, false, true)
  await start($)
  // 600 more skills with 60-character names, seen by the listing hook.
  const listing = Array.from({ length: 600 }, (_, i) => `- plugin-${i % 7}:${'a-very-long-skill-name-that-goes-on-'.padEnd(48, 'x')}${i}: x`).join('\n')
  await $.prompt.attachment({ type: 'skill_listing', text: listing } as never)
  await off($, 'off skill plugin-1:a-very-long-skill-name-that-goes-on-xxxxxxxxxxxx1')

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'section-skill' })
  await ui.press({ key: 'section-connector' })
  expect((await header(ui, 'section-skill')).count).toMatch(/^728 · ○ 1 OFF$/)
  expect(await chars(ui)).toBeLessThanOrEqual(TREE_CHARS)
  expect((await ui.drawn() as unknown as { children?: unknown }) !== undefined).toBe(true)
  await ui.unmount()
})

// Review of 8d92c44: the Versions rows and header were not paid from the budget, so a checkout with many mods, Versions
// open and the skills' rows filling the budget drew past the bound.
test('with Versions open over a large checkout and 728 long-named skills open, the tree stays within the bounds (TASK-0257)', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' }, true, true, 80)
  await start($)
  const listing = Array.from({ length: 600 }, (_, i) => `- plugin-${i % 7}:${'a-very-long-skill-name-that-goes-on-'.padEnd(48, 'x')}${i}: x`).join('\n')
  await $.prompt.attachment({ type: 'skill_listing', text: listing } as never)

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await header(ui, 'section-versions')).glyph).toBe('▾')
    await ui.press({ key: 'section-skill' })
    await ui.press({ key: 'section-connector' })
    expect((await header(ui, 'section-skill')).count).toBe('728')
    expect(await chars(ui)).toBeLessThanOrEqual(TREE_CHARS)
    // The rows past the budget say so; the sections after them are still drawn.
    expect((await ui.find({ type: 'Text', text: /^\+ \d+ more/ }))?.text).toBeDefined()
    expect((await header(ui, 'section-connector')).glyph).toBe('▾')
    await ui.press({ key: 'section-skill' })
    await ui.press({ key: 'section-connector' })
    await ui.unmount()
  }
})

// A header is a pressable since TASK-0257 (its words, an overlay Box and a blank Button), so headers are paid from the budget too.
test('however many topics, the desktop tree stays within the bounds and names the topics not drawn (TASK-0257)', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' })
  await start($)
  // 400 skills, each under a plugin of its own: 400 topic headers.
  const listing = Array.from({ length: 400 }, (_, i) => `- plugin-number-${i}:only-skill: x`).join('\n')
  await $.prompt.attachment({ type: 'skill_listing', text: listing } as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'section-skill' })
  expect(await chars(ui)).toBeLessThanOrEqual(TREE_CHARS)
  expect((await header(ui, 'group-skill:plugin-number-0')).glyph).toBe('▾')
  expect((await ui.find({ type: 'Text', text: /^\+ \d+ more topics not drawn/ }))?.text).toBeDefined()
  // The section after SKILLS is still drawn, and opens.
  await ui.press({ key: 'section-connector' })
  expect((await header(ui, 'section-connector')).glyph).toBe('▾')
  expect(await chars(ui)).toBeLessThanOrEqual(TREE_CHARS)
  await ui.unmount()
})
