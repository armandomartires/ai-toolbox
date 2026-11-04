import { expect, test } from 'claude-code/testing'

import { otlpPayload, spanIdOf, taskSpan, traceIdOf } from './telemetry'
import type { Task } from '../types'

const task = (id: string, patch: Partial<Task> = {}): Task => ({
  id, taskClass: 'lookup', role: 'scout', objective: 'SECRET objective', description: 'SECRET description',
  deps: [], allowedFiles: [], isWriter: false, isolated: false, status: 'completed',
  requested: { model: 'haiku', effort: 'low' }, retries: 0, escalations: 0, createdAt: 1000,
  ...patch,
} as Task)

test('a started task becomes one invoke_agent span with GenAI attributes', () => {
  const s = taskSpan('r1', task('t1', { startedAt: 2000, endedAt: 5000, tokens: 1234, resolvedModel: 'claude-haiku' }))!
  expect(s.name).toBe('invoke_agent scout')
  expect(s.traceId).toMatch(/^[0-9a-f]{32}$/)
  expect(s.spanId).toBe(spanIdOf('r1', 't1', 0))
  const a = Object.fromEntries(s.attributes.map(x => [x.key, Object.values(x.value)[0]]))
  expect(a['gen_ai.operation.name']).toBe('invoke_agent')
  expect(a['gen_ai.request.model']).toBe('haiku')
  expect(a['gen_ai.usage.total_tokens']).toBe('1234')
  expect(s.endTimeUnixNano).toBe('5000000000')
})

test('a task that never started has no span, and a failed one is an error', () => {
  expect(taskSpan('r1', task('q', { status: 'queued' }))).toBeUndefined()
  expect(taskSpan('r1', task('f', { status: 'failed', startedAt: 1 }))!.status.code).toBe(2)
})

test('the payload is one trace with a root span and never carries task text', () => {
  const body = otlpPayload('r1', [task('a', { startedAt: 1100 }), task('b')], 'svc', 9000)
  const spans = body.resourceSpans[0].scopeSpans[0].spans
  expect(spans.length).toBe(2)
  expect(new Set(spans.map(s => s.traceId)).size).toBe(1)
  expect(spans[1].parentSpanId).toBe(spans[0].spanId)
  expect(traceIdOf('r1')).not.toBe(traceIdOf('r2'))
  expect(JSON.stringify(body)).not.toContain('SECRET')
})
