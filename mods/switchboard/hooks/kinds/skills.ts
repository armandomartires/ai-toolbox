import { atom, update } from 'claude-code'
import type { On } from 'claude-code'

import { addSeen, denyText, dropSkills, isOff, listedSkills } from '../model'
import { loadOff } from '../store'

const seen = atom({ plugin: 'switchboard', key: 'seen' } as const, { mod: [], skill: [], connector: [] })

/**
 * Skills: hidden from the listing the model reads, refused at the Skill
 * tool, and answered in place of their prompt when typed as `/name`.
 */
export const registerSkills = (on: On) => {
  // The listing is where the session learns its skills, so it is read before
  // any is dropped.
  on('prompt.attachment', { type: 'skill_listing' }, async ($, e, next) => {
    const done = await next(e)
    const names = listedSkills(e.text)
    await update($, seen, held => addSeen(held, 'skill', names)).catch(() => undefined)
    const off = await loadOff($)
    if (done.text === null || off.skill.length === 0) return done

    return { ...done, text: dropSkills(done.text, off.skill) }
  })

  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    if (isOff(await loadOff($), 'skill', e.skill)) return { deny: denyText('skill', e.skill) }

    return next(e)
  })

  on('skill.prompt', async ($, e, next) => {
    if (isOff(await loadOff($), 'skill', e.skill)) return { text: denyText('skill', e.skill) }

    return next(e)
  })
}
