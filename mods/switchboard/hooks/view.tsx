import { atom, read, update } from 'claude-code'
import type { EngineInterface, RenderInput } from 'claude-code'

import type { Kind } from '../types'
import { KINDS, SELF, isOff, isProtected, pendingNote, shownName, switchText, takesEffect } from './model'
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
  const { Box, Button, Text } = $.ui.resolve(e)
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

    // The name takes the row's width; the switch keeps its own at the end.
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Box flexGrow={1} flexShrink={1}>
            <Text dimColor={!isOn} wrap="truncate-end">{shownName(kind, name, named)}</Text>
          </Box>
          <Box flexShrink={0} marginLeft={1}>
            {isSelf ? (
              <Text dimColor>always on</Text>
            ) : (
              toggle(`${kind}-${name}`, isOn, press)
            )}
          </Box>
        </Box>
        {note !== undefined && (
          <Text color="warning" size="caption">{`  ${note}`}</Text>
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
    const counts = `${names.length}${offCount > 0 ? ` · ${offCount} off` : ''}`

    return (
      <Box flexDirection="column" marginBottom={1}>
        <Button key={`section-${kind}`} plain onPress={flip}>
          <Text bold>{`${isOpen ? '▾' : '▸'} ${HEADINGS[kind]}  ${counts}`}</Text>
        </Button>
        {isOpen && <Text dimColor size="caption" wrap="wrap">{`Takes effect ${takesEffect[kind]}.`}</Text>}
        {isOpen && names.length === 0 && <Text dimColor>None seen yet in this session.</Text>}
        {isOpen && names.map(name => row(kind, name))}
      </Box>
    )
  }

  return (
    <Box flexDirection="column" minHeight={e.props.scroll.bodyRows}>
      {KINDS.map(section)}
    </Box>
  )
}
