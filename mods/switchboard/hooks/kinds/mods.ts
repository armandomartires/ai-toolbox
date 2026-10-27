import { atom, update } from 'claude-code'
import type { On } from 'claude-code'

import { addSeen, refusal } from '../model'
import { loadOff } from '../store'

const seen = atom({ plugin: 'switchboard', key: 'seen' } as const, { mod: [], skill: [], connector: [] })
const refused = atom({ plugin: 'switchboard', key: 'refused' } as const, [])

/**
 * Mods and other plugins: an off one's hooks module is refused as it is
 * about to join the chain. The engine asks the plugins admitted before it,
 * so a plugin that loads before this one is not refused (ADR-0042). Only a
 * person's own plugins (tier `user`) are judged.
 *
 * No `.catch`: a judge that fails lets the plugin join, which is the safe
 * way for a switch to fail.
 */
export const registerMods = (on: On) => {
  on('plugin.register', async ($, e, next) => {
    // A managed plugin is the administrator's, never this switch's.
    if (e.tier !== 'user') return next(e)
    await update($, seen, held => addSeen(held, 'mod', [e.name])).catch(() => undefined)
    const refuse = refusal(await loadOff($), e.name)
    if (refuse !== undefined) {
      await update($, refused, list => (list.includes(e.name) ? list : [...list, e.name])).catch(() => undefined)
      return { refuse }
    }

    return next(e)
  })
}
