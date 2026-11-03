import { expect, mock, test } from 'claude-code/testing'
import type { ConfigRow, On } from 'claude-code'

import { engine as shared } from '../preview/fixtures'
import { applyPlan, currentSprint, guessStory, parseSprints, setStoryStatus } from './model'
import { TOKENS } from './sigma'
import { VERSION } from './view'

const DARK = TOKENS.dark

const GOALS = `# Project

<!-- comment lines are skipped
- [x] not a story
-->

## Sprint 1 — Setup
Goal: Get the basics in
- [x] Scaffold the mod
- [x] First pane

## Sprint 2 — Timeline
Goal: Show sprints as rails
Dates: 2026-10-26 → 2026-11-06
- [>] Draw the rails
  One color per status
- [ ] Hover cards
- [?] Parse sprints
- [!] Terminal check
- Screenshots later

## Sprint 3 — Sharing
- [ ] Publish
`

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

const SURFACES = ['terminal', 'desktop'] as const

/**
 * A call to one of the desktop app's tools. The engine types only the MCP
 * tools connected when it last loaded the mod, which may not include them.
 */
type AppTool = never

const engine = (on: On) => shared(on, GOALS)

test('sprints, stories, statuses and details come from GOALS.md', () => {
  const sprints = parseSprints(GOALS)
  expect(sprints.map(sprint => [sprint.n, sprint.status])).toEqual([
    [1, 'done'],
    [2, 'in_progress'],
    [3, 'todo'],
  ])
  expect(sprints[1]?.stories.map(story => [story.id, story.status])).toEqual([
    ['2.1', 'in_progress'],
    ['2.2', 'todo'],
    ['2.3', 'review'],
    ['2.4', 'blocked'],
    ['2.5', 'backlog'],
  ])
  expect(sprints[1]?.stories[0]?.details).toEqual(['One color per status'])
  expect(sprints[1]?.goal).toBe('Show sprints as rails')
  expect(currentSprint(sprints)).toBe(1)
  // A file of plain items is one sprint of backlog stories.
  expect(parseSprints('- a\n- b')[0]?.stories.map(story => story.status)).toEqual(['backlog', 'backlog'])
})

test('a story status is written back as its checkbox, the rest untouched', () => {
  const done = setStoryStatus(GOALS, '2.1', 'done') ?? ''
  expect(done).toContain('- [x] Draw the rails\n  One color per status')
  expect(setStoryStatus(GOALS, '2.5', 'todo')).toContain('- [ ] Screenshots later')
  expect(setStoryStatus(GOALS, '2.2', 'backlog')).toContain('\n- Hover cards\n')
  expect(setStoryStatus(GOALS, '9.9', 'done')).toBeUndefined()
  expect(done.split('\n').length).toBe(GOALS.split('\n').length)
})

test('update_plan items, advance, done and start follow the app', () => {
  let list = applyPlan([], {
    items: [
      { content: 'a', status: 'in_progress' },
      { content: 'b', status: 'pending' },
      { content: 'c', status: 'pending' },
    ],
  })
  list = applyPlan(list, { advance: true })
  expect(list.map(task => task.status)).toEqual(['completed', 'in_progress', 'pending'])
  list = applyPlan(list, { done: [2], start: 3 })
  expect(list.map(task => task.status)).toEqual(['completed', 'completed', 'in_progress'])
})

test('a live task is matched to the story it shares words with', () => {
  const stories = parseSprints(GOALS)[1]?.stories ?? []
  expect(guessStory('Build the hover cards', stories)).toBe('2.2')
  expect(guessStory('Refactor', stories)).toBeUndefined()
})

test('the timeline shows sprints side by side with cards and tasks', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on)

  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.tool.call({
    tool: 'mcp__ccd_turn__update_plan',
    items: [
      { content: 'Write the model', status: 'completed' },
      { content: 'Render the dots', status: 'in_progress' },
      { content: 'Test it', status: 'pending' },
    ],
  } as AppTool)
  await clock.advance(12_000)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    // Any element's text: a dot's name is drawn as its Button's label.
    const text = async (pattern: RegExp) => (await ui.find({ text: pattern }))?.text
    // Three sprint rails, the current one marked.
    expect(await text(/S1 Setup/)).toBeDefined()
    expect(await text(/S2 Timeline/)).toBeDefined()
    expect(await text(/S3 Sharing/)).toBeDefined()
    expect(await text(/^S2\/3$/)).toBeDefined()
    // The story in progress carries Claude's live tasks under it.
    expect(await text(/▸Draw the rails/)).toBeDefined()
    expect(await text(/1 task done/)).toBeDefined()
    expect(await text(/Render the dots/)).toBeDefined()
    // The dots keep their status colours outside the name's Button, and the
    // tree fills the pane's rows. In progress is cyan; the current sprint's
    // mark is white, the one peak.
    expect((await ui.find({ type: 'Text', text: '◐' }))?.props.color).toBe(DARK.cyan)
    expect((await ui.find({ type: 'Text', text: '◉' }))?.props.color).toBe(DARK.white)
    expect((await ui.findAll({ type: 'Text' })).filter(one => one.props.dimColor).length).toBe(0)
    expect((await ui.find({ type: 'Button', text: /▸Draw the rails/ }))?.text).not.toContain('◐')
    expect((await ui.findAll({ type: 'Box' }))[0]?.props.minHeight).toBe(40)
    // No card is open until a dot or its name is pressed.
    // (The bracketed Sprints panel is filled too, but as wide as the pane.)
    const isCard = (one: { type: string; props: Record<string, unknown> }) =>
      one.type === 'Box' && one.props.backgroundColor !== undefined && one.props.width !== PANE.props.bodyColumns
    const card = async () => (await ui.findAll({ type: 'Box' })).find(isCard)
    expect(await card()).toBeUndefined()
    await ui.press({ key: 'st2.1' })
    expect(await text(/· One color per/)).toBeDefined()
    // A SIGMAorbital panel on `surface`, filling its column (the second of
    // three in 72 cells) right of the rail, in the flow under its story: the
    // stories below it slide down.
    const opened = await card()
    // The card's rows: its text lines and the two its frame takes.
    const cardRows =
      (opened?.children ?? []).filter(one => typeof one === 'object' && (one as { type?: string }).type === 'Text').length + 2
    expect(opened?.props).toMatchObject({ backgroundColor: DARK.surface, width: 22 })
    expect(opened?.props.position).toBeUndefined()
    // A square-cornered border on the terminal; elsewhere no border, padded to the same size.
    if (surface === 'terminal') expect(opened?.props).toMatchObject({ borderStyle: 'single', borderColor: DARK.line, paddingX: 1 })
    else expect(opened?.props).toMatchObject({ paddingX: 2, paddingY: 1 })
    if (surface !== 'terminal') {
      expect(opened?.props.borderStyle).toBeUndefined()
      // Framed by four straight edges: clipped strips, each one cell thick.
      const strips = (opened?.children ?? []).filter(
        (one): one is { props: Record<string, unknown> } =>
          typeof one === 'object' && one !== null && (one as { props?: { overflow?: string } }).props?.overflow === 'hidden',
      )
      expect(strips.map(one => [one.props.width === 1 ? 'side' : 'edge', one.props.top])).toEqual([
        ['edge', 0],
        ['edge', cardRows - 1],
        ['side', 0],
        ['side', 0],
      ])
    }
    const all = await ui.findAll({})
    const at = (key: string) => all.findIndex(one => one.key === key)
    const cardAt = all.findIndex(isCard)
    expect(at('st2.1')).toBeLessThan(cardAt)
    expect(cardAt).toBeLessThan(at('st2.2'))
    // The rail runs on beside it for all of the card's rows: `│` cells on the
    // terminal, and elsewhere the left edge of one bordered Box, unbroken.
    const before = all.slice(0, cardAt).reverse()
    if (surface === 'terminal') {
      expect(before.find(one => one.type === 'Box' && one.props.width === 2)?.text).toBe('│'.repeat(cardRows))
    } else {
      const edge = before.find(one => one.props.borderStyle === 'single')
      expect(edge?.props).toMatchObject({ position: 'absolute', width: 3, height: cardRows + 2, borderColor: DARK.line })
      // The rail's slot is two cells wide and its line sits on their boundary (`left` 1), where the sprint's glyph is centred.
      expect(edge?.props.left).toBe(1)
      expect(all.find(one => one.props.overflow === 'hidden' && one.props.height === cardRows)?.props.width).toBe(2)
    }
    // Another press opens that one instead; pressing it again closes it.
    await ui.press({ key: 'st2.3' })
    expect(await text(/· One color per/)).toBeUndefined()
    // The status line is the status's glyph and word, in its colour: review is amber.
    expect((await ui.find({ type: 'Text', text: /▲ IN REVIEW/ }))?.props).toMatchObject({ color: DARK.amber, mono: true, wrap: 'truncate-end' })
    await ui.press({ key: 's2' })
    expect(await text(/Goal: Show sprints/)).toBeDefined()
    await ui.press({ key: 's2' })
    expect(await card()).toBeUndefined()
    // Text styling: weight in place of the deprecated bold, sizes for the
    // heading and the legend, steady digits for times and counts.
    const styled = await ui.findAll({ type: 'Text' })
    // (A desktop adds bold beside a semibold weight of its own accord.)
    expect(styled.every(one => one.props.bold === undefined || one.props.weight !== undefined)).toBe(true)
    expect((await ui.find({ type: 'Text', text: /^SPRINTS$/ }))?.props).toMatchObject({ weight: 'bold', color: DARK['text-1'] })
    expect((await ui.find({ type: 'Text', text: / IN REVIEW$/ }))?.props).toMatchObject({ size: 'caption', color: DARK['text-3'] })
    // Names and labels are cut at the edge, never wrapped onto a second row.
    expect((await ui.find({ type: 'Text', text: /S2 Timeline/ }))?.props.wrap).toBe('truncate-end')
    // The legend, and no Sessions panel: agent-watch contributes that one (slot.test.tsx).
    expect(await text(/IN REVIEW/)).toBeDefined()
    expect(await text(/SESSIONS/)).toBeUndefined()
    expect(await text(/Explore · Find hooks/)).toBeUndefined()
    await ui.unmount()
  }
})

test('earlier and later scroll the sprints like a carousel', async ($, on) => {
  mock.clock(on)
  engine(on)

  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  // Two of the three sprints fit in 48 cells (44 inside the Sprints frame), the current one (2) first.
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop', props: { ...PANE.props, bodyColumns: 48 } })
  const has = async (pattern: RegExp) => (await ui.find({ text: pattern })) !== undefined
  expect([await has(/S1 Setup/), await has(/S2 Timeline/), await has(/S3 Sharing/)]).toEqual([false, true, true])
  expect(await has(/‹ 1 PREV/)).toBe(true)
  expect(await has(/NEXT ›/)).toBe(false)

  await ui.press({ key: 'earlier' })
  expect([await has(/S1 Setup/), await has(/S2 Timeline/), await has(/S3 Sharing/)]).toEqual([true, true, false])
  expect(await has(/1 NEXT ›/)).toBe(true)
  expect(await has(/PREV/)).toBe(false)

  // Away from the current sprint, the middle label goes back to it.
  await ui.press({ key: 'current' })
  expect([await has(/S1 Setup/), await has(/S3 Sharing/)]).toEqual([false, true])
  expect(await has(/↺/)).toBe(false)
  await ui.unmount()
})

test('wrap_up finishes the live task list, and the story tool says when review ends', async ($, on) => {
  mock.clock(on)
  engine(on)

  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.tool.call({
    tool: 'mcp__ccd_turn__update_plan',
    items: [
      { content: 'Write the model', status: 'completed' },
      { content: 'Render the dots', status: 'in_progress' },
    ],
  } as AppTool)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /Render the dots/ })).toBeDefined()
  // The app ticks off the last step with wrap_up, not update_plan.
  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'done' } as AppTool)
  expect(await ui.find({ text: /Render the dots/ })).toBeUndefined()
  expect(await ui.find({ text: /2 tasks done/ })).toBeDefined()
  await ui.unmount()

  const { description } = await $.tool.describe({
    tool: 'mcp__task-compass__story',
    description: '',
    provider: { plugin: 'task-compass', tier: 'user' },
  })
  expect(description).toContain('a story in review is done once they have seen it and moved on')
})

test('on the terminal h, l and c steer the carousel; elsewhere the controls carry no key', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  engine(on)

  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })

  const terminal = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, bodyColumns: 48 } })
  // The carousel's controls carry their keys on the terminal.
  expect((await terminal.find({ key: 'earlier' }))?.props.hotkey).toBe('h')
  await terminal.press({ key: 'earlier' })
  expect((await terminal.find({ key: 'later' }))?.props.hotkey).toBe('l')
  expect((await terminal.find({ key: 'current' }))?.props.hotkey).toBe('c')
  await terminal.unmount()

  // Elsewhere the same controls have none.
  const desktop = await $.ui.mount({ ...PANE, surface: 'desktop', props: { ...PANE.props, bodyColumns: 48 } })
  expect((await desktop.find({ key: 'later' }))?.props.hotkey).toBeUndefined()
  await desktop.unmount()
})

test('the story tool writes the status to GOALS.md and marks the story', async ($, on) => {
  mock.clock(on)
  const file = engine(on)

  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const ran = await $.tool.call({ tool: 'mcp__task-compass__story', story: '2.2', status: 'in_progress', why: 'cards next' })
  expect(String(ran.result)).toContain('is now In progress')
  expect(file.text).toContain('- [>] Hover cards')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Button', text: /▸Hover cards/ }))?.text).toBeDefined()
  await ui.press({ key: 'st2.2' })
  expect((await ui.find({ type: 'Text', text: /cards next/ }))?.text).toBeDefined()
  await ui.unmount()

  const wrong = await $.tool.call({ tool: 'mcp__task-compass__story', story: '7.1' })
  expect(String(wrong.result)).toContain('No story "7.1"')
})

test('a session started in a temporary folder describes the board of the folder it moved to', async ($, on) => {
  mock.clock(on)
  const file = engine(on)
  file.cwd = '/tmp/spare'
  const describe = async () =>
    (await $.tool.describe({
      tool: 'mcp__task-compass__story',
      description: '',
      provider: { plugin: 'task-compass', tier: 'user' },
    })).description

  await $.session.start({ cwd: '/tmp/spare', surface: 'desktop', isInteractive: true })
  expect(await describe()).toContain('call this all the same')

  // The app moves the session into the project before the tool is rendered.
  file.cwd = '/p'
  expect(await describe()).toContain('2.2 Hover cards [To do]')

  // A move it reports later reloads the board too.
  file.cwd = '/tmp/spare'
  await $.classic.CwdChanged({ old_cwd: '/p', new_cwd: '/tmp/spare' })
  file.cwd = '/p'
  await $.classic.CwdChanged({ old_cwd: '/tmp/spare', new_cwd: '/p' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /S2 Timeline/ }))?.text).toBeDefined()
  await ui.unmount()
})

const OUTPUT = (command: string, text: string) => ({
  plugin: 'task-compass',
  component: 'CommandOutput',
  props: { command, args: '', text, isErrored: false },
}) as const

test('/compass and /goals draw as panels in the host theme; an unknown row stays text', async ($, on) => {
  mock.clock(on)
  engine(on)
  on('config.list', () => ({ value: [{ key: 'theme', value: 'light' } as ConfigRow] }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const LIGHT = TOKENS.light

  const compass = ((await $.command.run({ command: 'compass', args: '' } as never)) as { text: string }).text
  expect(compass).toBe('Compass pane opened: 3 sprints, 8 stories.')
  const goals = ((await $.command.run({ command: 'goals', args: '' } as never)) as { text: string }).text
  expect(goals).toBe('Compass: 3 sprints, 8 stories loaded from /p/.ai/GOALS.md.')

  for (const surface of ['terminal', 'desktop'] as const) {
    let ui = await $.ui.mount({ ...OUTPUT('compass', compass), surface })
    expect((await ui.find({ type: 'Text', text: /^COMPASS$/ }))?.props.color).toBe(LIGHT['text-1'])
    expect((await ui.find({ type: 'Text', text: /^8$/ }))?.props.tabular).toBe(true)
    await ui.unmount()

    ui = await $.ui.mount({ ...OUTPUT('goals', goals), surface })
    expect((await ui.find({ type: 'Text', text: /^GOALS$/ }))?.props.color).toBe(LIGHT['text-1'])
    expect(await ui.find({ text: /3 SPRINTS/ })).toBeDefined()
    // The current sprint is marked white, the others by their status.
    expect((await ui.find({ type: 'Text', text: '◉' }))?.props.color).toBe(LIGHT.white)
    expect((await ui.find({ type: 'Text', text: /Timeline$/ }))?.props.color).toBe(LIGHT['text-1'])
    expect((await ui.find({ type: 'Text', text: /^0\/5$/ }))?.props.tabular).toBe(true)
    expect((await ui.findAll({ type: 'Text' })).filter(one => one.text === '').length).toBe(0)
    await ui.unmount()
  }

  const old = await $.ui.mount({ ...OUTPUT('goals', 'Compass: 2 sprints, 4 stories loaded from /x.'), surface: 'terminal' })
  expect((await old.find({ type: 'Text' }))?.text).toBe('engine')
  await old.unmount()
})

const TALL = { ...PANE.props, scroll: { offset: 0, bodyRows: 74 } }

test('the Sprints status legend is drawn inside the Sprints panel, as its last row', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await clock.advance(4_000)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface, props: TALL })
    // The one frame is the Box as wide as the pane that is filled (desktop) or bordered (terminal): the Sprints panel.
    type Node = { type?: string; text?: string; props?: Record<string, unknown>; children?: unknown[] }
    const frames = (await ui.findAll({ type: 'Box' })).filter(
      one => one.props.width === PANE.props.bodyColumns && (one.props.backgroundColor !== undefined || one.props.borderStyle === 'single'),
    )
    expect(frames.length).toBe(1)
    const texts = (node: Node): string[] =>
      (node.children ?? []).flatMap(child => (typeof child === 'object' && child !== null ? [(child as Node).text ?? '', ...texts(child as Node)] : typeof child === 'string' ? [child] : []))
    const inSprints = texts(frames[0] as Node)
    for (const word of [' BACKLOG', ' TO DO', ' IN PROGRESS', ' IN REVIEW', ' BLOCKED', ' DONE']) {
      expect(inSprints).toContain(word)
    }
    await ui.unmount()
  }
})

test('the Sprints panel is a bracketed frame: four text-1 corners, and nothing inside adds more', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await clock.advance(4_000)

  // Desktop: the frame is filled with `surface` and has four line edges and four text-1 bracket corners (eight arms), drawn without a height.
  const desktop = await $.ui.mount({ ...PANE, surface: 'desktop', props: TALL })
  const boxes = await desktop.findAll({ type: 'Box' })
  const framed = boxes.filter(one => one.props.backgroundColor === DARK.surface && one.props.width === PANE.props.bodyColumns)
  expect(framed.length).toBe(1)
  for (const one of framed) expect(one.props.height).toBeUndefined()
  const arms = boxes.filter(one => one.props.borderStyle === 'single' && one.props.borderColor === DARK['text-1'])
  expect(arms.length).toBe(8)
  await desktop.unmount()

  // Terminal: a `single` line border and the four corner glyphs in text-1, once.
  const terminal = await $.ui.mount({ ...PANE, surface: 'terminal', props: TALL })
  for (const glyph of ['┌', '┐', '└', '┘']) {
    const found = await terminal.findAll({ type: 'Text', text: glyph })
    expect(found.length).toBe(1)
    for (const one of found) expect(one.props.color).toBe(DARK['text-1'])
  }
  const bordered = (await terminal.findAll({ type: 'Box' })).filter(one => one.props.borderStyle === 'single' && one.props.borderColor === DARK.line && one.props.width === PANE.props.bodyColumns)
  expect(bordered.length).toBe(1)
  await terminal.unmount()
})

test('the board has a SIGMAorbital title bar', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: TALL })
  const titles = (await ui.findAll({ type: 'Text' })).map(one => one.children?.join?.('') ?? one.props.children).filter(text => typeof text === 'string')
  expect(titles.indexOf('SPRINTS')).toBeGreaterThanOrEqual(0)
  expect(titles).not.toContain('SESSIONS')
  await ui.unmount()
})

// Collapse and expand (TASK-0199): each sprint folds under its progress line; no title bar carries a toggle.
const fold = (n: number) => `fold-s${n}`
const SHORT = { ...PANE.props, scroll: { offset: 0, bodyRows: 56 } }

/** A Button's label: the text of the Text inside it. */
const labelOf = async (ui: { find: (q: Record<string, unknown>) => Promise<{ text?: string } | undefined> }, key: string) => (await ui.find({ type: 'Button', key }))?.text

test('a sprint\'s toggle hangs directly under that sprint\'s progress line, as a line-strong Button: `k` on the terminal for the current sprint', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface, props: TALL })
    const all = await ui.findAll({})
    for (const n of [1, 2, 3]) {
      const progress = all.findIndex(one => one.type === 'Text' && /^[▰▱]{5} \d+\/\d+/.test(one.text ?? '') && all.findIndex(other => other.key === `s${n}`) < all.indexOf(one) && (n === 3 || all.indexOf(one) < all.findIndex(other => other.key === `s${n + 1}`)))
      const button = all.findIndex(one => one.key === fold(n))
      expect(progress).toBeGreaterThan(-1)
      expect(button).toBeGreaterThan(progress)
      // Nothing with a label or a press sits between the progress line and the toggle: only the rail's own cells.
      expect(all.slice(progress + 1, button).filter(one => one.type === 'Button' || (one.type === 'Text' && one.text !== '│' && one.text !== ''))).toEqual([])
      expect(all[button]?.type).toBe('Button')
      expect(((await ui.find({ type: 'Button', key: fold(n) }))?.children?.[0] as { props: { color: string } }).props.color).toBe(DARK['line-strong'])
      expect(await labelOf(ui, fold(n))).toBe('▾ HIDE')
    }
    // The hotkey is the terminal's, and the current sprint's (the second) alone.
    expect((await ui.find({ type: 'Button', key: fold(2) }))?.props.hotkey).toBe(surface === 'terminal' ? 'k' : undefined)
    expect((await ui.find({ type: 'Button', key: fold(1) }))?.props.hotkey).toBeUndefined()
    expect((await ui.find({ type: 'Button', key: fold(3) }))?.props.hotkey).toBeUndefined()
    await ui.unmount()
  }
})

test('folding a sprint hides only that sprint\'s rows and counts them; the state is an atom; its rows come back when it is unfolded', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  let ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: SHORT })
  expect(await ui.find({ key: 'st2.1' })).toBeDefined()
  expect(await ui.find({ key: 'st3.1' })).toBeDefined()
  // The rows that sprint draws now: its stories, and Claude's live tasks under the one worked on.
  const hidden = (await ui.findAll({ type: 'Button' })).filter(one => /^(st|t)2[.-]/.test(String(one.key))).length
  expect(hidden).toBeGreaterThanOrEqual(4)
  await ui.press({ key: fold(2) })
  // Sprint 2 shows its header, progress and toggle only; sprints 1 and 3 keep their rows.
  expect(await ui.find({ key: 'st2.1' })).toBeUndefined()
  expect(await ui.find({ key: 'st2.4' })).toBeUndefined()
  expect(await ui.find({ key: 's2' })).toBeDefined()
  expect(await ui.find({ key: 'st3.1' })).toBeDefined()
  expect(await labelOf(ui, fold(2))).toBe(`▸ SHOW ${hidden}`)
  expect(await labelOf(ui, fold(3))).toBe('▾ HIDE')
  // The atom is not the pane's: a pane mounted afterwards draws it folded.
  await ui.unmount()
  ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: SHORT })
  expect(await labelOf(ui, fold(2))).toBe(`▸ SHOW ${hidden}`)
  expect(await ui.find({ key: 'st2.1' })).toBeUndefined()
  await ui.press({ key: fold(2) })
  expect(await ui.find({ key: 'st2.1' })).toBeDefined()
  expect(await labelOf(ui, fold(2))).toBe('▾ HIDE')
  await ui.unmount()
  // With every sprint on view folded the board still draws: each sprint's header, progress and toggle.
  const alone = await $.ui.mount({ ...PANE, surface: 'terminal', props: SHORT })
  await alone.press({ key: fold(1) })
  await alone.press({ key: fold(2) })
  await alone.press({ key: fold(3) })
  expect(await alone.find({ key: 'st1.1' })).toBeUndefined()
  expect(await alone.find({ key: 'st2.1' })).toBeUndefined()
  expect(await alone.find({ key: 'st3.1' })).toBeUndefined()
  for (const n of [1, 2, 3]) expect(await labelOf(alone, fold(n))).toMatch(/^▸ SHOW \d+$/)
  await alone.unmount()
})

test('`k` folds the current sprint: the terminal\'s hotkey sits on its toggle alone', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: SHORT })
  const hotkeys = (await ui.findAll({ type: 'Button' })).filter(one => one.props.hotkey === 'k').map(one => one.key)
  expect(hotkeys).toEqual([fold(2)])
  // `k` is the press of that toggle: it folds the current sprint's rows and no other's.
  await ui.press({ key: fold(2) })
  expect(await ui.find({ key: 'st2.1' })).toBeUndefined()
  expect(await ui.find({ key: 'st3.1' })).toBeDefined()
  await ui.unmount()
})

test('no title bar carries a toggle: the Sprints bar is the panel look, a title, a code and a rule', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface, props: TALL })
    expect(await ui.find({ key: 'toggle-board' })).toBeUndefined()
    expect(await ui.find({ key: 'toggle-cards' })).toBeUndefined()
    // A title bar is the Box holding a bold uppercase title: no ▾ or ▸ Button sits beside the title.
    for (const title of ['SPRINTS']) {
      const bars = (await ui.findAll({ type: 'Box' })).filter(one => (one.children ?? []).some(child => typeof child === 'object' && (child as { type?: string }).type === 'Text' && ((child as { children?: unknown[] }).children ?? []).join('') === title))
      expect(bars.length).toBe(1)
      expect((bars[0]?.children ?? []).filter(child => typeof child === 'object' && (child as { type?: string }).type === 'Button')).toEqual([])
      expect(bars[0]?.text).not.toMatch(/[▾▸]/)
    }
    await ui.unmount()
  }
})

test('the rail passes through the glyph\'s centre: on a desktop both are two cells wide, the rail on their boundary; on the terminal both are the first column', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  const desktop = await $.ui.mount({ ...PANE, surface: 'desktop', props: SHORT })
  const glyphs = await desktop.findAll({ type: 'Box', key: 'glyph' })
  const slots = await desktop.findAll({ type: 'Box', key: 'rail' })
  expect(glyphs.length).toBeGreaterThan(0)
  expect(slots.length).toBeGreaterThan(0)
  // Every glyph is centred in two cells, and every rail slot is as wide, its line the bordered Box's left edge at `left` 1.
  for (const one of glyphs) expect(one.props).toMatchObject({ width: 2, justifyContent: 'center' })
  for (const one of slots) {
    expect(one.props.width).toBe(glyphs[0]?.props.width)
    const line = (one.children ?? []).find(child => typeof child === 'object' && (child as { props?: { borderStyle?: string } }).props?.borderStyle === 'single') as { props: Record<string, unknown> } | undefined
    expect(line?.props).toMatchObject({ position: 'absolute', left: 1 })
  }
  await desktop.unmount()
  const terminal = await $.ui.mount({ ...PANE, surface: 'terminal', props: SHORT })
  // The monospaced `│` is one cell in the first column of its row, as the one-cell glyph is: the same column.
  const rail = (await terminal.findAll({ type: 'Text', text: '│' }))[0]!
  const glyph = (await terminal.findAll({ type: 'Text', text: '◉' }))[0]!
  expect([rail.text?.length, glyph.text?.length]).toEqual([1, 1])
  const box = (await terminal.findAll({ type: 'Box' })).find(one => one.text === '│' && one.props.width === 1)
  expect(box).toBeDefined()
  expect((await terminal.findAll({ type: 'Box', key: 'glyph' })).every(one => one.props.width === undefined && one.props.justifyContent === undefined)).toBe(true)
  await terminal.unmount()
})

test('the board is alone in its pane: it fills the pane\'s rows, draws at any height, and nothing below it is Compass\'s', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  for (const surface of SURFACES) {
    for (const bodyRows of [10, 40, 120]) {
      const ui = await $.ui.mount({ ...PANE, surface, props: { ...PANE.props, scroll: { offset: 0, bodyRows } } })
      // The pane's column is at least the pane tall, so the board's frame is not left floating in a taller pane.
      expect((await ui.findAll({ type: 'Box' }))[0]?.props.minHeight).toBe(bodyRows)
      expect(await ui.find({ key: 'st2.1' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^SPRINTS$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^SESSIONS$/ })).toBeUndefined()
      await ui.unmount()
    }
  }
})

test('a desktop prints the version after the legend; a terminal does not', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  const desktop = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await desktop.find({ text: `COMPASS ${VERSION}` })).toBeDefined()
  await desktop.unmount()
  const terminal = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await terminal.find({ text: /^COMPASS / })).toBeUndefined()
  await terminal.unmount()
})
