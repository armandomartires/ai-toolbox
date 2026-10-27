import { atom, update } from 'claude-code'
import type { On } from 'claude-code'

import { addSeen, refusal } from '../model'
import { loadOff } from '../store'

const seen = atom({ plugin: 'switchboard', key: 'seen' } as const, { mod: [], skill: [], connector: [] })

/**
 * Mods and other plugins: an off one's hooks module is refused as it is
 * about to join the chain. The engine asks the plugins admitted before it,
 * so a plugin that loads before this one is not refused (ADR-0042).
 *
 * No `.catch`: a judge that fails lets the plugin join, which is the safe
 * way for a switch to fail.
 */
export const registerMods = (on: On) => {
  on('plugin.register', async ($, e, next) => {
    await update($, seen, held => addSeen(held, 'mod', [e.name])).catch(() => undefined)
    const refuse = refusal(await loadOff($), e.name)
    if (refuse !== undefined) return { refuse }

    return next(e)
  })
}
