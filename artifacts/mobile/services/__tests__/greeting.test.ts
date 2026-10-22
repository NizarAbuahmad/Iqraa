import { test } from 'node:test';
import assert from 'node:assert/strict';
import { greetingKey } from '../greeting.ts';

test('morning until noon, afternoon until five, evening after', () => {
  assert.equal(greetingKey(5), 'homeGreetMorning');
  assert.equal(greetingKey(11), 'homeGreetMorning');
  assert.equal(greetingKey(12), 'homeGreetAfternoon');
  assert.equal(greetingKey(16), 'homeGreetAfternoon');
  assert.equal(greetingKey(17), 'homeGreetEvening');
  assert.equal(greetingKey(23), 'homeGreetEvening');
});

test('the small hours are evening, not morning', () => {
  assert.equal(greetingKey(0), 'homeGreetEvening');
  assert.equal(greetingKey(4), 'homeGreetEvening');
});
