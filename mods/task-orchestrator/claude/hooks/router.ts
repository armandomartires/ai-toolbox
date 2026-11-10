// Pure routing: a task class and the coordinator's overrides in, one decision
// out, with every substitution named. Nothing here touches the engine.

import { EFFORTS, GATED_EFFORTS, GATED_MODELS, MODEL_LADDER, ROLES, TASK_CLASSES, familyOf, routesUnder } from './routing'
import type { Config, Effort, Role, TaskClass } from './routing'

export type RouteRequest = {
  taskClass: string
  role?: string
  model?: string
  effort?: string
}

/** What the router knows about this installation's models. */
export type Availability = {
  /** Aliases or ids a spawn refused, so the ladder skips them. */
  unavailable: readonly string[]
}

export type Decision = {
  taskClass: TaskClass
  role: Role
  model: string
  effort: Effort
  /** Every substitution and caveat, for the person to read. */
  notes: string[]
}

export type Blocked = { blocked: string; notes: string[] }

export const isEffort = (value: unknown): value is Effort => (EFFORTS as readonly string[]).includes(String(value))

const isTaskClass = (value: unknown): value is TaskClass => (TASK_CLASSES as readonly string[]).includes(String(value))

const isRole = (value: unknown): value is Role => (ROLES as readonly string[]).includes(String(value))

/** The gate a model or effort must pass: an explicit opt-in, or a block. */
export const gate = (model: string, effort: Effort, config: Config): string | undefined => {
  if (GATED_EFFORTS.includes(effort) && !config.optIn.highEffort)
    return `effort "${effort}" needs an explicit opt-in: /orchestrate opt-in high-effort`
  if (GATED_MODELS.includes(familyOf(model) ?? '') && !config.optIn.frontier)
    return `model "${model}" needs an explicit opt-in: /orchestrate opt-in frontier`
  return undefined
}

/** The next family up the ladder that is not unavailable, or undefined; also undefined for a model whose family is unknown. */
export const fallback = (model: string, availability: Availability): string | undefined => {
  const family = familyOf(model)
  if (family === undefined) return undefined
  const gone = new Set(availability.unavailable.map(one => familyOf(one)).filter(one => one !== undefined))
  for (const candidate of MODEL_LADDER.slice(MODEL_LADDER.indexOf(family) + 1)) {
    if (!availability.unavailable.includes(candidate) && !gone.has(candidate)) return candidate
  }
  return undefined
}

export const route = (request: RouteRequest, config: Config, availability: Availability): Decision | Blocked => {
  const notes: string[] = []
  if (!isTaskClass(request.taskClass)) return { blocked: `"${request.taskClass}" is not a task class (${TASK_CLASSES.join(', ')})`, notes }
  const base = routesUnder(config)[request.taskClass]
  let role: Role = base.role
  let model = base.model
  let effort: Effort = base.effort
  if (request.role !== undefined) {
    if (!isRole(request.role)) return { blocked: `"${request.role}" is not a role (${ROLES.join(', ')})`, notes }
    role = request.role
    if (role !== base.role) {
      notes.push(`role ${role} requested over the table's ${base.role}`)
      // A role brings its own row's model and effort, unless those were named too (TASK-0224).
      const own = Object.values(routesUnder(config)).find(one => one.role === role)
      if (own && (own.model !== model || own.effort !== effort)) {
        model = own.model
        effort = own.effort
        notes.push(`settings ${own.model}/${own.effort} from role ${role}'s own row`)
      }
    }
  }
  if (request.model !== undefined) {
    if (typeof request.model !== 'string' || !request.model.trim()) return { blocked: 'model must be an alias or id', notes }
    if (request.model.trim() !== base.model) notes.push(`model ${request.model.trim()} requested over the table's ${base.model}`)
    model = request.model.trim()
  }
  if (request.effort !== undefined) {
    if (!isEffort(request.effort)) return { blocked: `effort "${String(request.effort)}" is not one of ${EFFORTS.join('|')}; nothing was sent`, notes }
    effort = request.effort
    if (effort !== base.effort) notes.push(`effort ${effort} requested over the table's ${base.effort}`)
  }
  const gated = gate(model, effort, config)
  if (gated) return { blocked: gated, notes }
  if (availability.unavailable.includes(model)) {
    const next = fallback(model, availability)
    if (familyOf(model) === undefined) return { blocked: `model ${model} is unavailable here and cannot be placed on the ladder (${MODEL_LADDER.join(', ')}): name a model alias or id of one of those families`, notes }
    if (next === undefined) return { blocked: `model ${model} is unavailable here and no model above it on the ladder is either`, notes }
    const gatedNext = gate(next, effort, config)
    if (gatedNext) return { blocked: `model ${model} is unavailable here; the fallback ${next} is gated: ${gatedNext}`, notes }
    notes.push(`model ${model} is unavailable here: falling back up to ${next}, which costs more`)
    model = next
  }
  return { taskClass: request.taskClass, role, model, effort, notes }
}

/** One step up: the next effort level, or the next model on the ladder. */
export const escalate = (decision: Decision, kind: 'effort' | 'model', config: Config, availability: Availability): Decision | Blocked => {
  const notes = [...decision.notes]
  if (kind === 'effort') {
    const at = EFFORTS.indexOf(decision.effort)
    const next = EFFORTS[at + 1]
    if (next === undefined) return { blocked: `effort is already ${decision.effort}`, notes }
    const gated = gate(decision.model, next, config)
    if (gated) return { blocked: gated, notes }
    notes.push(`effort escalated ${decision.effort} → ${next}`)
    return { ...decision, effort: next, notes }
  }
  const next = fallback(decision.model, availability)
  if (familyOf(decision.model) === undefined) return { blocked: `model ${decision.model} cannot be placed on the ladder (${MODEL_LADDER.join(', ')}): nothing to escalate to`, notes }
  if (next === undefined) return { blocked: `no model above ${decision.model} is available`, notes }
  const gated = gate(next, decision.effort, config)
  if (gated) return { blocked: gated, notes }
  notes.push(`model escalated ${decision.model} → ${next}`)
  return { ...decision, model: next, notes }
}

export const isBlocked = (value: Decision | Blocked): value is Blocked => 'blocked' in value
