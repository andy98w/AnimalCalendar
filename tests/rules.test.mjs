import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, set, get, runTransaction } from 'firebase/database';
import { doc, setDoc, getDoc } from 'firebase/firestore';

if (!process.env.FIREBASE_DATABASE_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run through firebase emulators:exec; never against live Firebase.');
}
let env;
const record = { title: 'Vet appointment', start: 1772960400000, end: 1772964000000, version: 1, deleted: false };
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-animalcalendar',
    database: { rules: readFileSync('database.rules.json', 'utf8') },
    firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
after(async () => { await env?.cleanup(); });

test('owner-only calendar access, including anonymous and cross-user denials', async () => {
  const alice = env.authenticatedContext('alice').database();
  await assertSucceeds(set(ref(alice, 'alice/events/access'), record));
  await assertSucceeds(get(ref(alice, 'alice/events')));
  for (const context of [env.authenticatedContext('bob'), env.unauthenticatedContext()]) {
    await assertFails(get(ref(context.database(), 'alice/events')));
    await assertFails(set(ref(context.database(), 'alice/events/access'), { ...record, version: 2 }));
  }
});

test('invalid dates, unknown fields and stale versions are rejected', async () => {
  const event = ref(env.authenticatedContext('alice').database(), 'alice/events/validation');
  await assertFails(set(event, { ...record, end: record.start - 1 }));
  await assertFails(set(event, { ...record, title: '' }));
  await assertFails(set(event, { ...record, admin: true }));
  await assertSucceeds(set(event, record));
  await assertFails(set(event, { ...record, title: 'stale edit' }));
  await assertSucceeds(set(event, { ...record, version: 2, deleted: true }));
  await assertFails(set(event, { ...record, version: 3 }));
  await assertFails(set(event, null));
});

test('two concurrent editors cannot both commit the same version', async () => {
  const a = ref(env.authenticatedContext('alice').database(), 'alice/events/race');
  const b = ref(env.authenticatedContext('alice').database(), 'alice/events/race');
  await set(a, record);
  const update = current => current && current.version !== 1 ? undefined : { ...record, version: 2 };
  const results = await Promise.all([runTransaction(a, update), runTransaction(b, update)]);
  assert.equal(results.filter(result => result.committed).length, 1);
  assert.equal((await get(a)).val().version, 2);
});

test('profiles cannot be read or overwritten by another user', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  await assertSucceeds(setDoc(doc(alice, 'users/alice'), { uid: 'alice', displayName: 'Alice' }));
  await assertFails(setDoc(doc(alice, 'users/alice'), { uid: 'bob' }));
  const bob = env.authenticatedContext('bob').firestore();
  await assertFails(getDoc(doc(bob, 'users/alice')));
  await assertFails(setDoc(doc(bob, 'users/alice'), { uid: 'alice' }));
});
