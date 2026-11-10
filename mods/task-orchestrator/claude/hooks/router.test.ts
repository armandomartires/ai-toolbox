import { expect, test } from 'claude-code/testing'

import { escalate, fallback, gate, isBlocked, route } from './router'
import { DEFAULT_CONFIG, ROLE_PROFILES, familyOf, mergeConfig, profileName, roleOfProfile, routesUnder } from './routing'
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
  expect(out.notes).toEqual(['model haiku is unavailable here: falling back up to sonnet, which costs more'])
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
  expect(out.notes).toHaveLength(4)
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

test('a role named over the table brings its own row settings, unless a model or effort is named too (TASK-0224)', () => {
  const own = decided(route({ taskClass: 'lookup', role: 'debugger' }, DEFAULT_CONFIG, none))
  expect(own).toMatchObject({ role: 'debugger', model: 'opus', effort: 'high' })
  expect(own.notes).toContain("settings opus/high from role debugger's own row")
  const named = decided(route({ taskClass: 'lookup', role: 'debugger', model: 'sonnet', effort: 'medium' }, DEFAULT_CONFIG, none))
  expect(named).toMatchObject({ role: 'debugger', model: 'sonnet', effort: 'medium' })
})

test('a builder and a debugger have the turns a mod change with its 5-10 minute gate needs; the read-only roles keep theirs (TASK-0260)', () => {
  // 2026-11-08: a debugger and a builder at 60 each stopped mid-step with no report (TASK-0260).
  expect(ROLE_PROFILES.builder.maxTurns).toBe(120)
  expect(ROLE_PROFILES.debugger.maxTurns).toBe(120)
  const readOnly = Object.fromEntries(Object.entries(ROLE_PROFILES).filter(([, one]) => one.readOnly).map(([name, one]) => [name, one.maxTurns]))
  expect(readOnly).toEqual({ utility: 10, scout: 20, investigator: 40, reviewer: 30, planner: 40, 'risk-reviewer': 30 })
})

test('a full model id unavailable falls back to the next family up, never down to haiku', () => {
  expect(fallback('claude-sonnet-5-5', none)).toBe('opus')
  expect(fallback('Sonnet', { unavailable: ['opus'] })).toBe('fable')
  const out = decided(route({ taskClass: 'lookup', model: 'claude-sonnet-5-5' }, DEFAULT_CONFIG, { unavailable: ['claude-sonnet-5-5'] }))
  expect(out.model).toBe('opus')
  expect(out.notes.join(' ')).toContain('falling back up to opus')
})

test('a model with no known family blocks instead of dropping to haiku', () => {
  expect(fallback('mystery-1', none)).toBeUndefined()
  const blocked = route({ taskClass: 'lookup', model: 'mystery-1' }, DEFAULT_CONFIG, { unavailable: ['mystery-1'] })
  expect(isBlocked(blocked) && blocked.blocked).toContain('cannot be placed on the ladder')
  const base = decided(route({ taskClass: 'lookup' }, DEFAULT_CONFIG, none))
  const up = escalate({ ...base, model: 'mystery-1' }, 'model', DEFAULT_CONFIG, none)
  expect(isBlocked(up) && up.blocked).toContain('cannot be placed on the ladder')
})

test('every fable-family id or case is gated behind the frontier opt-in', () => {
  for (const model of ['fable', 'Fable', 'claude-fable-5-1']) {
    expect(gate(model, 'high', DEFAULT_CONFIG)).toContain('opt-in frontier')
    expect(gate(model, 'high', { ...DEFAULT_CONFIG, optIn: { ...DEFAULT_CONFIG.optIn, frontier: true } })).toBeUndefined()
  }
  const blocked = route({ taskClass: 'lookup', model: 'claude-fable-5-1' }, DEFAULT_CONFIG, none)
  expect(isBlocked(blocked) && blocked.blocked).toContain('opt-in frontier')
  expect(gate('claude-sonnet-5-5', 'high', DEFAULT_CONFIG)).toBeUndefined()
})

test('familyOf matches the family word as a whole token', () => {
  expect(familyOf('claude-fable-5-1')).toBe('fable')
  expect(familyOf('Fable')).toBe('fable')
  expect(familyOf('claude-haiku-5-5')).toBe('haiku')
  expect(familyOf('OPUS')).toBe('opus')
  expect(familyOf('claude-sonnet-5-5')).toBe('sonnet')
  expect(familyOf('unfabled')).toBeUndefined()
  expect(familyOf('sonnetish')).toBeUndefined()
  expect(familyOf('gpt-5')).toBeUndefined()
  expect(familyOf('')).toBeUndefined()
})

test('escalate by model works from a full id', () => {
  const base = decided(route({ taskClass: 'lookup', model: 'claude-haiku-5-5' }, DEFAULT_CONFIG, none))
  const up = decided(escalate(base, 'model', DEFAULT_CONFIG, none))
  expect(up.model).toBe('sonnet')
  const top = escalate({ ...base, model: 'claude-opus-5' }, 'model', DEFAULT_CONFIG, none)
  expect(isBlocked(top) && top.blocked).toContain('opt-in frontier')
})

test('the full 11-class by 3-policy table', () => {
  const balanced: Record<string, string[]> = {
    extraction: ['utility', 'haiku', 'low'], lookup: ['scout', 'haiku', 'low'], exploration: ['investigator', 'sonnet', 'medium'],
    documentation: ['documentation', 'haiku', 'medium'], implementation: ['builder', 'sonnet', 'medium'], testing: ['tester', 'sonnet', 'medium'],
    review: ['reviewer', 'sonnet', 'high'], architecture: ['planner', 'opus', 'high'], debugging: ['debugger', 'opus', 'high'],
    'risk-review': ['risk-reviewer', 'opus', 'high'], frontier: ['frontier-specialist', 'fable', 'high'],
  }
  const patch: Record<string, Record<string, [string, string]>> = {
    economy: { exploration: ['haiku', 'medium'], documentation: ['haiku', 'low'], review: ['sonnet', 'medium'], architecture: ['sonnet', 'high'], debugging: ['sonnet', 'high'] },
    quality: { lookup: ['sonnet', 'low'], exploration: ['sonnet', 'high'], documentation: ['sonnet', 'medium'], implementation: ['sonnet', 'high'], testing: ['sonnet', 'high'], review: ['opus', 'high'] },
  }
  const classes = Object.keys(balanced)
  expect(classes).toHaveLength(11)
  for (const policy of ['economy', 'balanced', 'quality'] as const) {
    const table = routesUnder({ ...DEFAULT_CONFIG, policy })
    for (const name of classes) {
      const row = table[name as keyof typeof table]
      const over = patch[policy]?.[name]
      const base = balanced[name]!
      expect([row.role, row.model, row.effort], `${policy} ${name}`).toEqual(over ? [base[0], over[0], over[1]] : base)
    }
  }
})

test('a limit of 0 concurrent workers is refused, and a __proto__ providers key is ignored (R5)', () => {
  const zero = mergeConfig(DEFAULT_CONFIG, { limits: { maxConcurrent: 0, maxRetries: 0 } })
  expect(zero.config.limits.maxConcurrent).toBe(DEFAULT_CONFIG.limits.maxConcurrent)
  expect(zero.refused).toEqual(['limits.maxConcurrent must be at least 1'])
  // Zero retries is a valid limit.
  expect(zero.config.limits.maxRetries).toBe(0)
  const proto = mergeConfig(DEFAULT_CONFIG, JSON.parse('{"providers":{"__proto__":{"enabled":true},"openai":{"enabled":true}}}'))
  expect(Object.getPrototypeOf(proto.config.providers)).toBe(Object.prototype)
  expect(({} as Record<string, unknown>).enabled).toBeUndefined()
  expect(proto.config.providers.openai).toEqual({ enabled: true })
  expect(Object.keys(proto.config.providers)).toEqual(['openai', 'grok'])
  expect(proto.refused).toEqual(['providers.__proto__: not a provider id'])
})
