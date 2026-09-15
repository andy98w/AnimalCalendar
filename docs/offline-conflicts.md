# Offline edits and reconnect conflicts

Calendar edits now save a draft to IndexedDB before returning to the editor. The
calendar overlays pending edits on an account-scoped cached snapshot; pending
deletions disappear locally. Drafts and snapshots survive page reloads/browser
restarts in the same browser profile, subject to browser storage eviction or the
user clearing site data. This is local device storage, not a cloud backup or an
encrypted local vault. Signing out clears visible state; retained drafts are only
loaded when that account signs back in.

The queue flushes when Firebase reports a connection, after saving, on tab focus,
or through Retry sync. Network/auth failures leave drafts pending. Realtime server
updates refresh the cached snapshot. A transaction compares the version originally
edited to the current server version. A competing edit or deletion becomes a
visible conflict: the server version is displayed and the unsynced draft's title
and times remain in the conflict panel. The user can explicitly keep the server
version and discard the draft, then edit again if needed. There is no automatic
field merge, overwrite button, or resurrection of deleted events.

One unresolved draft per event is permitted across tabs. Another edit to that
event is rejected until it syncs or its conflict is resolved; this avoids replacing
a write that may already be in flight. Different events can queue independently.
IndexedDB read/write transactions serialize queue changes. Completion/deletion
checks the operation ID, so an old flush cannot delete a newer draft at the same key.

Each server mutation carries a stable `operationId`. If the server commits but the
client loses the acknowledgement, replay recognizes the last accepted operation
and removes the local draft without incrementing the event twice. If another
mutation has already replaced that marker, a retry conservatively reports conflict.
This is not an unbounded exactly-once receipt log. Tombstones remain indefinitely.
No browser-online hint is treated as a successful save; Firebase acknowledgement
is needed to remove the draft. A transaction begun before disconnect may finish
on reconnect; database ownership rules still apply if authentication changes.

## Tests

```sh
npm ci --legacy-peer-deps
npx tsc --noEmit -p tsconfig.app.json
npx tsx --test tests/dates.test.ts tests/offline-queue.test.ts
npx firebase emulators:exec --project demo-animalcalendar --only database,firestore 'node --import tsx --test tests/rules.test.mjs tests/offline-emulator.test.ts'
```

Local queue tests use fake-indexeddb to execute the actual storage transactions,
including reload via a second queue instance, per-account access, multiple tabs,
late completion, retained failures and explicit conflict resolution. This models
the IndexedDB API, not browser eviction or a full browser-network test.

Emulator scenarios use two authenticated Firebase clients for the same user: one
disconnects and saves a local draft, the other edits/deletes the event, then the
first reconnects. They also replay a committed operation after an intentionally
lost acknowledgement. Existing owner-only, validation and concurrent-transaction
rules tests continue to run. Test environments refuse live Firebase endpoints.

## Rollout

This branch does not deploy Firebase rules or the client. The new client requires
the rules change allowing the bounded `operationId` string; ship compatible rules
before the client. Existing clients/records without the optional marker remain
valid, but do not supply the new replay acknowledgement. Existing version and
legacy-date migration requirements in `calendar-reliability.md` still apply.
All-day events, recurrence, automatic merges, background service-worker sync,
cache retention/eviction policy, framework upgrades and production load testing
are outside this milestone.
