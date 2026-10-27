import { atom, read } from 'claude-code'
import type { Register } from 'claude-code'

import { registerConnectors } from './kinds/connectors'
import { registerMods } from './kinds/mods'
import { registerSkills } from './kinds/skills'
import { refreshInventory } from './inventory'
import { USAGE, listText, parseArgs, takesEffect } from './model'
import { loadOff, saveOff, syncOff } from './store'
import { PANE, TITLE, renderPane } from './view'

// The engine lists a module's $.state reads and writes from the atoms declared
// in that same file, so each module declares the atoms it uses.
const seen = atom({ plugin: 'switchboard', key: 'seen' } as const, { mod: [], skill: [], connector: [] })
const hints = atom({ plugin: 'switchboard', key: 'hints' } as const, {})

export const register: Register = on => {
  registerMods(on)
  registerSkills(on)
  registerConnectors(on)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'switchboard',
      description: 'Turn mods, skills and connectors on or off for this project',
      argumentHint: '[list | on|off mod|skill|connector <name>]',
    })
    await syncOff($).catch(() => undefined)
    await refreshInventory($).catch(() => undefined)

    return next(e)
  })

  on('command.run', { command: 'switchboard' }, async ($, e) => {
    const ask = parseArgs(e.args)
    if (ask.kind === 'usage') return { text: `${ask.why}. ${USAGE}` }
    if (ask.kind === 'list') {
      await refreshInventory($)
      return { text: listText(await syncOff($), await read($, seen), await read($, hints)) }
    }
    if (ask.kind === 'set') {
      await saveOff($, ask.target, ask.name, ask.wantOff)
      return { text: `${ask.target} ${ask.name} is ${ask.wantOff ? 'off' : 'on'} for this project; takes effect ${takesEffect[ask.target]}.` }
    }
    await syncOff($)
    await refreshInventory($)
    const { isPlaced } = await $.ui.open({ id: PANE, title: TITLE })

    return { text: isPlaced ? 'Switchboard opened.' : `This surface shows no panes.\n${listText(await loadOff($), await read($, seen), await read($, hints))}` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, renderPane)
}
