// artifacts/mobile/services/__tests__/sseParser.test.ts
/**
 * The chat's stream reader, minus the network: frames arrive as text chunks
 * cut anywhere — mid-line, mid-JSON, several events in one chunk — and the
 * parser must hand back whole events and nothing else. The throttle keeps a
 * 1200-token reply from re-rendering the bubble on every token.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createDeltaThrottle, createSseParser } from '../ai/sseParser.ts';

describe('createSseParser', () => {
  it('parses one complete event', () => {
    const p = createSseParser();
    assert.deepEqual(p.push('data: {"type":"delta","text":"مرحبًا"}\n\n'), [
      { type: 'delta', text: 'مرحبًا' },
    ]);
  });

  it('holds a partial line until the rest arrives', () => {
    const p = createSseParser();
    assert.deepEqual(p.push('data: {"type":"delta","te'), []);
    assert.deepEqual(p.push('xt":"أ"}\n'), []);
    assert.deepEqual(p.push('\n'), [{ type: 'delta', text: 'أ' }]);
  });

  it('returns several events from one chunk, in order', () => {
    const p = createSseParser();
    const events = p.push(
      'data: {"type":"delta","text":"a"}\n\ndata: {"type":"delta","text":"b"}\n\ndata: {"type":"done","content":"ab"}\n\n',
    );
    assert.deepEqual(events, [
      { type: 'delta', text: 'a' },
      { type: 'delta', text: 'b' },
      { type: 'done', content: 'ab' },
    ]);
  });

  it('accepts CRLF line endings', () => {
    const p = createSseParser();
    assert.deepEqual(p.push('data: {"type":"delta","text":"x"}\r\n\r\n'), [{ type: 'delta', text: 'x' }]);
  });

  it('ignores comments, unknown fields, blank events and malformed JSON', () => {
    const p = createSseParser();
    const events = p.push(': keep-alive\n\nevent: ping\n\ndata: not json\n\ndata: {"type":"delta","text":"ok"}\n\n');
    assert.deepEqual(events, [{ type: 'delta', text: 'ok' }]);
  });

  it('drops an event whose type is not one of the three', () => {
    const p = createSseParser();
    assert.deepEqual(p.push('data: {"type":"usage","tokens":3}\n\n'), []);
  });

  it('flush() yields an event that ended without the trailing blank line', () => {
    const p = createSseParser();
    assert.deepEqual(p.push('data: {"type":"done","content":"end"}'), []);
    assert.deepEqual(p.flush(), [{ type: 'done', content: 'end' }]);
    assert.deepEqual(p.flush(), []);
  });
});

describe('createDeltaThrottle', () => {
  it('emits the first value at once, coalesces within the interval, flushes the last', () => {
    let clock = 1000;
    const seen: string[] = [];
    const th = createDeltaThrottle(full => seen.push(full), 80, () => clock);
    th.push('a');
    th.push('ab');            // 0ms later: held
    clock += 50; th.push('abc'); // still inside the window: held, replaces 'ab'
    clock += 40; th.push('abcd'); // 90ms since first emit: emitted
    th.push('abcde');          // held
    th.flush();                // emitted
    th.flush();                // nothing pending: silent
    assert.deepEqual(seen, ['a', 'abcd', 'abcde']);
  });
});
