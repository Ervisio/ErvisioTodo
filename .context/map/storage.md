# Storage and uploads

Purpose: SQLite persistence, schema upgrades, private attachments and consistent backups.
Entry points: lib/server/db.ts:db, transaction, closeDB; lib/server/files.ts:uploadFiles, fileFor; scripts/backup.mjs.
Flow: service → prepared SQLite statement → DATA_DIR/ervisio.sqlite; uploads are BLOBs in the same database.
Invariants:

- Node >=24.13 <25 is required by package.json; storage uses node:sqlite DatabaseSync.
- db() lazily opens one connection with WAL, foreign keys and a 5-second busy timeout; initialization upgrades columns to schema version 3.
- transaction() uses BEGIN IMMEDIATE and synchronous callbacks; do not put asynchronous work inside it or nest it.
- Upload parsing bounds the actual request stream, then validates file sizes, count and destination; quota and inserts share a transaction.
- MIME for raster branding is detected from bytes. Other uploads remain application/octet-stream.
- Files require list access or ownership unless selected as raster list branding; token destination policy still applies.
  Gotchas:
- README requires one application process per database and no network filesystem or replicas sharing its file.
- Use scripts/backup.mjs (SQLite backup API) for a live consistent copy; copying only the live .sqlite loses WAL state.
- Restore with service stopped; preserve current state and remove stale WAL/SHM from the old instance before restart.
  Verification: tests/migration.test.ts covers preservation from schema v1; tests/todo.test.ts covers rollback, private uploads, branding and atomic quotas.
  Related: map/todo.md, map/auth-api.md, map/deployment.md.
