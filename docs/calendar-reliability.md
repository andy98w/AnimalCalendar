# Calendar persistence and ownership

The original calendar read events through unauthenticated REST calls. Dragging
and deleting only changed the local array. The new service uses the signed-in
Firebase SDK and saves changes before updating the displayed event.

Realtime Database rules restrict each `/uid/events` tree to that user. Event
writes require a title, numeric start/end instants, a monotonically increasing
version and a deletion flag. Profile documents in Firestore are owner-only too.
The app's local-storage login flag is not treated as database authorization.

Concurrent edits use a Firebase transaction and the version that the editor
loaded. A stale edit asks the user to reload. Deletions leave a tombstone so an
older editor cannot resurrect the event. Tombstone retention is currently
indefinite; a retention policy needs a separate design.

Timed events are stored as epoch milliseconds and displayed in the browser's
timezone. Tests cover the spring-forward gap and repeated fall-back hour using
explicit offsets. This is not recurring-event scheduling or an all-day date
model. Ambiguous legacy date strings and all-day records are rejected rather
than silently shifted. Review/export existing data before rolling this out.

## Verification

```sh
npm ci --legacy-peer-deps
npx tsc --noEmit -p tsconfig.app.json
npx tsx --test tests/dates.test.ts
npx firebase emulators:exec --project demo-animalcalendar --only database,firestore 'node --test tests/rules.test.mjs'
```

The emulator command requires Java; CI installs Java 21. Tests use a `demo-`
project and refuse to run without emulator environment variables. They verify
unauthenticated/cross-user denial, record validation, stale versions, concurrent
edit conflicts and profile ownership. No live Firebase data is used.

## Deployment boundary

This branch has not changed deployed rules. Deploying rules and the updated
client together requires a backup and review of legacy event shapes. Read-only
records with explicit-offset dates can be decoded; editing rewrites them into
the new timed-event format. Recurrence and all-day events need dedicated models.

The repository still uses Angular 16 and an old dependency tree with security
advisories. The emulator CLI also adds development-only dependencies. These
targeted correctness tests are not a production security certification or a
completed framework upgrade.
