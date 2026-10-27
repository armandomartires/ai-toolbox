import { atom, read, update } from 'claude-code'
import type { EngineInterface, RenderInput } from 'claude-code'

import type { Kind } from '../types'
import { KINDS, SELF, isOff, isProtected, pendingNote, shownName, switchText, takesEffect } from './model'
import type { ListOutput } from './model'
import { STATUS, color, kit, recall } from './sigma'
import { saveOff } from './store'

// The same $.state values the hooks write: the engine lists a module's reads
// and writes from atoms declared in that file.
const off = atom({ plugin: 'switchboard', key: 'off' } as const, { mod: [], skill: [], connector: [] })
const seen = atom({ plugin: 'switchboard', key: 'seen' } as const, { mod: [], skill: [], connector: [] })
const refused = atom({ plugin: 'switchboard', key: 'refused' } as const, [])
const open = atom({ plugin: 'switchboard', key: 'open' } as const, ['mod'])
const hints = atom({ plugin: 'switchboard', key: 'hints' } as const, {})

export const PANE = 'switchboard'
export const TITLE = 'Switchboard'

const HEADINGS: Record<Kind, string> = { mod: 'Mods', skill: 'Skills', connector: 'Connectors' }

/**
 * The pane: one section per kind, Mods open and the others behind their
 * header, and a row per item with a switch that flips it.
 *
 * The switch is a `Button`, filled while on, with a knob drawn in text at
 * the end it stands at. Only a `Button` takes a press and it holds only
 * text, and a `Client` draws no `Svg`, so no surface can press an SVG
 * switch (`TASK-0187`). The label names the control for a reader.
 */
export const renderPane = async ($: EngineInterface, e: RenderInput<'Pane'>) => {
  const ui = $.ui.resolve(e)
  const { Box, Button, Text } = ui
  const { label, panel } = kit(ui, e.surface)
  const [held, known, gone, shown, named] = await Promise.all([
    read($, off),
    read($, seen),
    read($, refused),
    read($, open),
    read($, hints),
  ])

  const toggle = (key: string, isOn: boolean, press: () => void) => (
    <Button key={key} label={isOn ? 'On' : 'Off'} variant={isOn ? 'primary' : 'secondary'} onPress={press}>
      {switchText(isOn)}
    </Button>
  )

  const row = (kind: Kind, name: string) => {
    const isSelf = kind === 'mod' && name === SELF
    const isOn = !isOff(held, kind, name)
    const note = kind === 'mod' && !isSelf ? pendingNote(held, gone, name) : undefined
    const press = () => void saveOff($, kind, name, isOn).catch(() => undefined)

    // The state's glyph, then the name, which takes the row's width; the
    // switch keeps its own at the end. On is nominal, off is offline.
    const state = STATUS[isOn ? 'nominal' : 'offline']
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Box flexShrink={0}>
            <Text color={color(state.token)}>{`${state.glyph} `}</Text>
          </Box>
          <Box flexGrow={1} flexShrink={1}>
            <Text color={color(isOn ? 'text-1' : 'text-3')} wrap="truncate-end">{shownName(kind, name, named)}</Text>
          </Box>
          <Box flexShrink={0} marginLeft={1}>
            {isSelf ? label('always on') : toggle(`${kind}-${name}`, isOn, press)}
          </Box>
        </Box>
        {note !== undefined && (
          <Box flexDirection="row">
            <Text color={color('status-caution')} size="caption">{`  ${STATUS.caution.glyph}`}</Text>
            <Text color={color('status-caution')} size="caption">{` ${note}`}</Text>
          </Box>
        )}
      </Box>
    )
  }

  const section = (kind: Kind) => {
    const names = [...new Set([...known[kind], ...held[kind]])]
      .filter(name => !(kind === 'connector' && isProtected(name)))
      .sort((a, b) => a.localeCompare(b))
    const offCount = names.filter(name => isOff(held, kind, name)).length
    const isOpen = shown.includes(kind)
    const flip = () =>
      void update($, open, list => (list.includes(kind) ? list.filter(k => k !== kind) : [...list, kind])).catch(() => undefined)
    const counts = `${names.length}${offCount > 0 ? ` · ${offCount} OFF` : ''}`

    return (
      <Box flexDirection="column" marginTop={1}>
        <Button key={`section-${kind}`} plain onPress={flip}>
          <Text color={color('text-1')} weight="semibold">{`${isOpen ? '▾' : '▸'} ${HEADINGS[kind].toUpperCase()}  ${counts}`}</Text>
        </Button>
        {isOpen && <Text color={color('text-3')} size="caption" wrap="wrap">{`Takes effect ${takesEffect[kind]}.`}</Text>}
        {isOpen && names.length === 0 && <Text color={color('text-3')}>None seen yet in this session.</Text>}
        {isOpen && names.map(name => row(kind, name))}
      </Box>
    )
  }

  const allOff = KINDS.reduce((sum, kind) => sum + held[kind].length, 0)
  return (
    <Box flexDirection="column" minHeight={e.props.scroll.bodyRows}>
      {panel({ title: 'Switchboard', code: allOff > 0 ? `${allOff} off` : 'all on', width: Math.max(20, e.props.bodyColumns) }, <Box flexDirection="column">{KINDS.map(section)}</Box>)}
    </Box>
  )
}

/**
 * `/switchboard list` as a panel per kind; none for a row this session did
 * not answer (a resume, a reload), which the engine draws as text. A
 * declaration: the engine follows `$` past an import only into one.
 */
export function renderOutput($: EngineInterface, e: RenderInput<'CommandOutput'>) {
  if (e.props.isErrored) return undefined
  const kinds = recall<ListOutput>(e.props.text)
  if (kinds === undefined) return undefined
  const ui = $.ui.resolve(e)
  const { Box, Text } = ui
  const { badge, label, panel } = kit(ui, e.surface)
  const width = Math.min(64, e.viewport?.columns ?? 64)

  return (
    <Box flexDirection="column" rowGap={1}>
      {kinds.map(one =>
        panel(
          { title: HEADINGS[one.kind], code: `${one.rows.filter(row => !row.isOn).length} off`, width },
          <Box flexDirection="column">
            <Text color={color('text-3')} size="caption">{`Takes effect ${one.takesEffect}.`}</Text>
            {one.rows.length === 0 && <Text color={color('text-3')}>None seen yet.</Text>}
            {one.rows.map(row => (
              <Box flexDirection="row" columnGap={2}>
                <Box width={8} flexShrink={0}>
                  {row.isSelf ? label('always') : badge(row.isOn ? 'nominal' : 'offline', row.isOn ? 'on' : 'off')}
                </Box>
                <Text color={color(row.isOn ? 'text-1' : 'text-3')} wrap="truncate-end">{row.name}</Text>
              </Box>
            ))}
          </Box>,
        ),
      )}
    </Box>
  )
}
