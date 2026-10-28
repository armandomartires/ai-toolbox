import { expect, test } from 'claude-code/testing'

import { escalate, fallback, gate, isBlocked, route } from './router'
import { DEFAULT_CONFIG, mergeConfig, profileName, roleOfProfile, routesUnder } from './routing'
import type { Config } from './routing'

const none = { unavailable: [] as string[] }

const decided = (value: ReturnType<typeof route>) => {
  if (isBlocked(value)) throw new Error(`blocked: ${value.blocked}`)
  return value
}

test('the table routes extraction to haiku/low, implementation to sonnet/medium and architecture to opus/high', () => {
  expect(decided(route({ taskClass: 'extraction' }, DEFAULT_CONFIG, none))).toMatchObject({ role: 'utility', model: 'haiku', effort: 'low' })
  expect(decided(route({ taskClass: 'implementation' }, DEFAULT_CONFIG, none))).toMatchObject({ role: 'builder', model: 'sonnet', effort: 'medium' })
  expect(decided(route({ taskClass: 'architecture' }, DEFAULT_CONFIG, none))).toMatchObject({ role: 'planner', model: 'opus', effort: 'high' })
  expect(decided(route({ taskClass: 'review' }, DEFAULT_CONFIG, none))).toMatchObject({ role: 'reviewer', model: 'sonnet', effort: 'high' })
})

test('a missing model falls back one step up the ladder, visibly, or blocks', () => {
  const out = decided(route({ taskClass: 'lookup' }, DEFAULT_CONFIG, { unavailable: ['haiku'] }))
  expect(out.model).toBe('sonnet')
  expect(out.notes).toEqual(['model haiku is unavailable here: falling back to sonnet'])
  const blocked = route({ taskClass: 'architecture' }, DEFAULT_CONFIG, { unavailable: ['opus', 'fable'] })
  expect(isBlocked(blocked) && blocked.blocked).toContain('unavailable here and no model above it')
  // The ladder never falls back onto a gated model without the opt-in.
  const gated = route({ taskClass: 'architecture' }, DEFAULT_CONFIG, { unavailable: ['opus'] })
  expect(isBlocked(gated) && gated.blocked).toContain('fallback fable is gated')
  expect(fallback('fable', none)).toBeUndefined()
})

test('an effort outside the five levels is never sent, and xhigh, max and fable need the opt-in', () => {
  const bad = route({ taskClass: 'extraction', effort: 'ultra' }, DEFAULT_CONFIG, none)
  expect(isBlocked(bad) && bad.blocked).toContain('nothing was sent')
  const xhigh = route({ taskClass: 'review', effort: 'xhigh' }, DEFAULT_CONFIG, none)
  expect(isBlocked(xhigh) && xhigh.blocked).toContain('opt-in high-effort')
  const frontier = route({ taskClass: 'frontier' }, DEFAULT_CONFIG, none)
  expect(isBlocked(frontier) && frontier.blocked).toContain('opt-in frontier')
  const optedIn: Config = { ...DEFAULT_CONFIG, optIn: { highEffort: true, frontier: true } }
  expect(decided(route({ taskClass: 'frontier' }, optedIn, none))).toMatchObject({ model: 'fable', effort: 'high' })
  expect(decided(route({ taskClass: 'review', effort: 'max' }, optedIn, none)).effort).toBe('max')
  expect(gate('sonnet', 'medium', DEFAULT_CONFIG)).toBeUndefined()
})

test('the coordinator may override role, model and effort, each noted; unknown names block', () => {
  const out = decided(route({ taskClass: 'documentation', model: 'sonnet', effort: 'high', role: 'builder' }, DEFAULT_CONFIG, none))
  expect(out).toMatchObject({ role: 'builder', model: 'sonnet', effort: 'high' })
  expect(out.notes).toHaveLength(3)
  expect(isBlocked(route({ taskClass: 'poetry' }, DEFAULT_CONFIG, none))).toBe(true)
  expect(isBlocked(route({ taskClass: 'lookup', role: 'wizard' }, DEFAULT_CONFIG, none))).toBe(true)
})

test('escalation goes one step, effort or model, and stops at the gate or the top', () => {
  const base = decided(route({ taskClass: 'implementation' }, DEFAULT_CONFIG, none))
  const effort = escalate(base, 'effort', DEFAULT_CONFIG, none)
  expect(!isBlocked(effort) && effort.effort).toBe('high')
  const again = escalate(decided(effort), 'effort', DEFAULT_CONFIG, none)
  expect(isBlocked(again) && again.blocked).toContain('opt-in high-effort')
  const model = escalate(base, 'model', DEFAULT_CONFIG, none)
  expect(!isBlocked(model) && model.model).toBe('opus')
  const top = escalate(decided(model), 'model', DEFAULT_CONFIG, none)
  expect(isBlocked(top) && top.blocked).toContain('opt-in frontier')
})

test('policies change the table without code, and an override file is merged with its refusals named', () => {
  expect(routesUnder(DEFAULT_CONFIG, 'economy').architecture.model).toBe('sonnet')
  expect(routesUnder(DEFAULT_CONFIG, 'economy')['risk-review']).toEqual(DEFAULT_CONFIG.routes['risk-review'])
  expect(routesUnder(DEFAULT_CONFIG, 'quality').review.model).toBe('opus')
  const { config, refused } = mergeConfig(DEFAULT_CONFIG, {
    policy: 'quality',
    routes: { lookup: { model: 'sonnet', effort: 'medium' }, poetry: {}, review: { effort: 'ultra' } },
    limits: { maxConcurrent: 2, maxRetries: 'two' },
    optIn: { frontier: true },
    providers: { openai: { enabled: 'yes' } },
  })
  expect(config.policy).toBe('quality')
  expect(config.routes.lookup).toEqual({ role: 'scout', model: 'sonnet', effort: 'medium' })
  expect(config.routes.review.effort).toBe('high')
  expect(config.limits).toMatchObject({ maxConcurrent: 2, maxRetries: 2 })
  expect(config.optIn.frontier).toBe(true)
  expect(config.providers.openai?.enabled).toBe(false)
  expect(refused).toEqual([
    'routes.poetry: no such task class',
    'routes.review.effort "ultra" is not one of low|medium|high|xhigh|max',
    'limits.maxRetries must be a whole number',
    'providers.openai.enabled must be true or false',
  ])
  expect(mergeConfig(DEFAULT_CONFIG, 'nope').refused).toEqual(['the override is not a JSON object'])
})

test("a role's own profile holds the table's settings; other settings get a profile of their own", () => {
  expect(profileName(DEFAULT_CONFIG, 'builder', 'sonnet', 'medium', false)).toBe('builder')
  expect(profileName(DEFAULT_CONFIG, 'builder', 'sonnet', 'high', false)).toBe('builder--sonnet-high')
  expect(profileName(DEFAULT_CONFIG, 'builder', 'sonnet', 'medium', true)).toBe('builder--sonnet-medium-wt')
  expect(profileName(DEFAULT_CONFIG, 'risk-reviewer', 'claude-sonnet-5-5[1m]', 'high', false)).toBe('risk-reviewer--claude-sonnet-5-5-1m-high')
  // Under economy the planner's table settings are sonnet/high: that is its own name.
  expect(profileName({ ...DEFAULT_CONFIG, policy: 'economy' }, 'planner', 'sonnet', 'high', false)).toBe('planner')
  expect(roleOfProfile('builder')).toBe('builder')
  expect(roleOfProfile('risk-reviewer--claude-sonnet-5-5-1m-high')).toBe('risk-reviewer')
  expect(roleOfProfile('general-purpose')).toBeUndefined()
})
