import { expect, test } from 'claude-code/testing'

import { greeting } from './register'

test('the greeting names whoever the command was given, and counts', () => {
  expect(greeting('', 1)).toBe('Hello from my-mod (1 so far).')
  expect(greeting(' Ada ', 2)).toBe('Hello from my-mod, Ada (2 so far).')
})
