import { atom, read } from 'claude-code'
import type { EngineInterface, RenderInput } from 'claude-code'

import type { Kind } from '../types'
import { KINDS, SELF, isOff, takesEffect } from './model'
import { saveOff } from './store'

// The same $.state values the hooks write: the engine lists a module's reads
// and writes from atoms declared in that file.
const off = atom({ plugin: 'switchboard', key: 'off' } as const, { mod: [], skill: [], connector: [] })
const seen = atom({ plugin: 'switchboard', key: 'seen' } as const, { mod: [], skill: [], connector: [] })

export const PANE = 'switchboard'
export const TITLE = 'Switchboard'

const HEADINGS: Record<Kind, string> = { mod: 'Mods', skill: 'Skills', connector: 'Connectors' }

/** The pane: one section per kind, a row per item, each pressed to turn it off or on. */
export const renderPane = async ($: EngineInterface, e: RenderInput<'Pane'>) => {
  const { Box, Button, Text } = $.ui.resolve(e)
  const [held, known] = await Promise.all([read($, off), read($, seen)])

  const row = (kind: Kind, name: string) => {
    const isSelf = kind === 'mod' && name === SELF
    const isOn = !isOff(held, kind, name)
    const press = () => void saveOff($, kind, name, isOn).catch(() => undefined)

    // The mark's color sits outside the Button: a desktop drops the colors
    // of a Text inside one.
    return (
      <Box flexDirection="row">
        <Box flexShrink={0}>
          <Text color={isOn ? 'success' : 'inactive'}>{isOn ? '● ' : '○ '}</Text>
        </Box>
        {isSelf ? (
          <Text wrap="truncate-end">{`${name} (always on)`}</Text>
        ) : (
          <Button key={`${kind}-${name}`} plain dimColor={!isOn} onPress={press}>
            <Text wrap="truncate-end">{`${name}${isOn ? '' : ' (off)'}`}</Text>
          </Button>
        )}
      </Box>
    )
  }

  const section = (kind: Kind) => {
    const names = [...new Set([...known[kind], ...held[kind]])].sort((a, b) => a.localeCompare(b))
    const offCount = names.filter(name => isOff(held, kind, name)).length

    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>{offCount > 0 ? `${HEADINGS[kind]}  ${offCount} off` : HEADINGS[kind]}</Text>
        <Text dimColor size="caption" wrap="wrap">{`Takes effect ${takesEffect[kind]}.`}</Text>
        {names.length === 0 && <Text dimColor>None seen yet in this session.</Text>}
        {names.map(name => row(kind, name))}
      </Box>
    )
  }

  return (
    <Box flexDirection="column" minHeight={e.props.scroll.bodyRows}>
      {KINDS.map(section)}
    </Box>
  )
}
