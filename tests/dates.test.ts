import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeEvent, decodeEvent } from '../src/app/shared/services/event-record';

test('spring-forward preserves elapsed time rather than wall-clock subtraction', () => {
  const event = { title: 'Walk', start: new Date('2026-03-08T01:30:00-08:00'), end: new Date('2026-03-08T03:30:00-07:00') };
  const saved = encodeEvent(event);
  assert.equal(saved.end - saved.start, 3600000);
  assert.equal(decodeEvent('a', saved).start.toISOString(), '2026-03-08T09:30:00.000Z');
});
test('fall-back repeated hours remain distinct instants', () => {
  const saved = encodeEvent({ title: 'Walk', start: new Date('2026-11-01T01:30:00-07:00'), end: new Date('2026-11-01T01:30:00-08:00') });
  assert.equal(saved.end - saved.start, 3600000);
});
test('preserves existing event colors during timestamp conversion', () => {
  const color = { primary: '#ad2121', secondary: '#FAE3E3' };
  assert.deepEqual(encodeEvent(decodeEvent('a', { title: 'Walk', start: 0, end: 1000, color })).color, color);
});
test('rejects ambiguous legacy dates, invalid ranges and unsupported all-day events', () => {
  assert.throws(() => decodeEvent('a', { title: 'Walk', start: '2026-11-01T01:30:00' }));
  assert.throws(() => encodeEvent({ title: 'Walk', start: new Date(2), end: new Date(1) }));
  assert.throws(() => encodeEvent({ title: 'Walk', start: new Date(), allDay: true }));
});
