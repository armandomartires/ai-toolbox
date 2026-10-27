import { expect, test } from 'claude-code/testing'
import type { ConfigRow, On } from 'claude-code'

import { IDENTITY, STATUS, TOKENS, agentState, elapsed, hms, kit, recall, remember, segments, themeOf } from './sigma'

test('every token has a hex in both themes, aliases resolved', () => {
  for (const id of ['dark', 'light'] as const) {
    for (const [name, hex] of Object.entries(TOKENS[id])) expect([name, /^#[0-9a-f]{6}$/.test(hex)]).toEqual([name, true])
  }
  expect(TOKENS.dark.cyan).toBe('#7fe7ff')
  expect(TOKENS.light.cyan).toBe('#00708a')
  expect(TOKENS.dark['status-critical']).toBe(TOKENS.dark.red)
  expect(TOKENS.light['seq-4']).toBe('#000000')
  expect(Object.keys(TOKENS.dark).length).toBe(34)
})

test('any light theme family is Daylight; the rest, and no value, Night ops', () => {
  expect(themeOf('light')).toBe('light')
  expect(themeOf('light-daltonized')).toBe('light')
  expect(themeOf('dark-ansi')).toBe('dark')
  expect(themeOf('auto')).toBe('dark')
  expect(themeOf(undefined)).toBe('dark')
})

test('identity glyphs are single, distinct, and never a status glyph', () => {
  const glyphs = IDENTITY.flat()
  expect(new Set(glyphs).size).toBe(glyphs.length)
  for (const g of glyphs) expect([g, g.length, '●○◌◐◑▲◆'.includes(g)]).toEqual([g, 1, false])
  expect(agentState('running').token).toBe('cyan')
  expect(agentState('failed')).toEqual({ token: 'red', word: 'FAILED' })
  expect(agentState('killed').word).toBe('STOPPED')
  expect(STATUS.caution.glyph).toBe('▲')
})

test('times, durations and meters', () => {
  expect(hms(3_723_000)).toBe('01:02:03')
  expect(hms(0)).toBe('00:00:00')
  expect(elapsed(12_000)).toBe('12s')
  expect(elapsed(65_000)).toBe('1m05s')
  expect(elapsed(3_840_000)).toBe('1h04m')
  expect(segments(3, 5, 10)).toEqual({ on: '▰▰▰▰▰▰', off: '▱▱▱▱' })
  expect(segments(0, 0, 3)).toEqual({ on: '', off: '▱▱▱' })
})

test('a remembered result is found by its text, with or without the plugin prefix, and only the last 50', () => {
  remember('first answer', { n: 0 })
  expect(recall<{ n: number }>('first answer')).toEqual({ n: 0 })
  expect(recall<{ n: number }>('my-mod: first answer')).toEqual({ n: 0 })
  expect(recall('never said')).toBeUndefined()
  for (let i = 1; i <= 50; i++) remember(`answer ${i}`, { n: i })
  expect(recall('first answer')).toBeUndefined()
  expect(recall<{ n: number }>('answer 50')).toEqual({ n: 50 })
})

/** The engine beneath the template: a theme row, commands, and its own row drawing. */
const engine = (on: On, themeRow: { value: string | Error }) => {
  on('config.list', () => {
    if (themeRow.value instanceof Error) throw themeRow.value
    return { value: [{ key: 'theme', label: 'Theme', kind: 'choice', value: themeRow.value } as unknown as ConfigRow] }
  })
  on('config.set', (_, e) => ({ value: e.value }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
}

const OUTPUT = (text: string) => ({
  plugin: 'my-mod',
  component: 'CommandOutput',
  props: { command: 'hello', args: 'Ada', text, isErrored: false },
}) as const

test('/hello draws as a panel in the theme the host is set to, and follows a change', async ($, on) => {
  const themeRow = { value: 'dark' as string | Error }
  engine(on, themeRow)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const { text } = (await $.command.run({ command: 'hello', args: 'Ada' } as never)) as { text: string }

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...OUTPUT(text), surface })
    expect((await ui.find({ type: 'Text', text: /^GREETING$/ }))?.props.color).toBe(TOKENS.dark['text-1'])
    expect((await ui.find({ type: 'Text', text: /^MY-MOD$/ }))?.props.color).toBe(TOKENS.dark['text-3'])
    expect((await ui.find({ type: 'Text', text: /^Ada$/ }))?.props.tabular).toBe(true)
    expect((await ui.find({ type: 'Text', text: /SO FAR/ }))?.props.color).toBe(TOKENS.dark['text-3'])
    await ui.unmount()
  }

  await $.config.set({ key: 'theme', value: 'light' } as never)
  const ui = await $.ui.mount({ ...OUTPUT(text), surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^GREETING$/ }))?.props.color).toBe(TOKENS.light['text-1'])
  expect((await ui.find({ type: 'Text', text: /^─+$/ }))?.props.color).toBe(TOKENS.light.line)
  await ui.unmount()

  // A row this session never answered stays the engine's text.
  const old = await $.ui.mount({ ...OUTPUT('Hello from my-mod (9 so far).'), surface: 'terminal' })
  expect((await old.find({ type: 'Text' }))?.text).toBe('engine')
  await old.unmount()
})

test('a light setting at the start draws Daylight; a failed read keeps Night ops', async ($, on) => {
  const themeRow = { value: 'light-daltonized' as string | Error }
  engine(on, themeRow)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const { text } = (await $.command.run({ command: 'hello', args: '' } as never)) as { text: string }
  let ui = await $.ui.mount({ ...OUTPUT(text), surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^GREETING$/ }))?.props.color).toBe(TOKENS.light['text-1'])
  await ui.unmount()

  themeRow.value = new Error('no config')
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  ui = await $.ui.mount({ ...OUTPUT(text), surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^GREETING$/ }))?.props.color).toBe(TOKENS.dark['text-1'])
  await ui.unmount()
})

test('a card panel is framed square on a desktop and bordered on the terminal', async ($, on) => {
  // Drawn by the engine stub itself, so the kit is tested apart from any mod.
  on('ui.render', ($, e) => {
    const ui = $.ui.resolve(e)
    const { panel } = kit(ui, e.surface)
    return panel({ title: 'Card', width: 20, card: { height: 5, fill: 'surface' } }, <ui.Text>body</ui.Text>)
  })
  const PANE = { plugin: 'my-mod', component: 'Pane', requestId: 'card', props: { title: 'x', isFocused: false, bodyColumns: 30, placement: 'dock', scroll: { offset: 0, bodyRows: 10 }, view: {} } } as const

  const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const outer = (await term.findAll({ type: 'Box' }))[0]
  expect([outer?.props.borderStyle, outer?.props.borderColor, outer?.props.backgroundColor]).toEqual(['single', TOKENS.dark.line, undefined])
  await term.unmount()

  const desk = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const boxes = await desk.findAll({ type: 'Box' })
  expect(boxes[0]?.props.borderStyle).toBeUndefined()
  expect(boxes[0]?.props.backgroundColor).toBe(TOKENS.dark.surface)
  // Four clipped strips, each one cell thick, around the 20 × 5 card.
  const strips = boxes.filter(box => box.props.overflow === 'hidden').map(box => [box.props.width, box.props.height])
  expect(strips).toEqual([[20, 1], [20, 1], [1, 5], [1, 5]])
  await desk.unmount()
})
