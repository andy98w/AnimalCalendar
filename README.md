# AnimalCalendar

An earlier Angular calendar project with email and Google sign-in, password
recovery, and draggable events. Firebase Authentication identifies the user;
Realtime Database stores each user's events and Firestore stores their profile.

## Recent correctness work

Event reads now use the authenticated SDK. Drag and delete changes persist
through version-checked transactions instead of only changing the screen.
Database rules restrict events and profiles to their owner. Timed events store
epoch milliseconds, with tests for spring-forward and repeated fall-back hours.

See [the implementation and test notes](docs/calendar-reliability.md) for the
conflict behavior, deletion tombstones, emulator commands and rollout limits.
These rules have not been deployed to the original Firebase project.

## Local development

The app uses Angular 16. Install dependencies with `npm ci --legacy-peer-deps`.
Before opening the app, replace the legacy configuration in `src/environments/`
with your own Firebase project. Do not use the original project for testing.

Run `npm start` for the Angular development server or `npm run build` to compile.
The focused rules tests use a separate `demo-animalcalendar` emulator project
and require no real user credentials or calendar records.

## Limits

All-day and recurring events need dedicated date models. Legacy records with
ambiguous date strings need review before migration. The old Angular dependency
tree also needs a security/upgrade pass before a new public deployment.
