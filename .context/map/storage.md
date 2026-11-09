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

External backup storage (admin, Settings → Archiviazione, /settings/storage):
Entry points: lib/server/remote-storage.ts (S3, SFTP, SMB drivers, AES-GCM sealing of secrets with a key derived from AUTH_SECRET), lib/server/backups.ts (config in settings key "backup", runBackup, restoreBackup, scheduler), instrumentation.ts (starts the scheduler, checks every 5 min), /api/admin/storage/{config,test,backups,backup,restore}.
Flow: SQLite backup API → gzip → driver.put as ervisio-<ISO>.sqlite.gz; retention prunes beyond `keep`; restore downloads, validates (integrity_check, required tables, user_version <= 3), saves data/backups/pre-restore-*.sqlite, closes the connection, swaps the file and keeps this installation's backup settings.
Invariants: secrets never leave the server (blank field on save keeps the stored one); only names matching backupName are listed or removed; one backup/restore at a time; restore signs everyone out.
Traps: the live database is never placed on the remote share; zod `.default()` inside `.optional()` patch schemas resets omitted fields (use bare validators). SFTP and SMB drivers are untested against real servers (S3 is covered by tests/backups.test.ts with a fake S3). ssh2, ssh2-sftp-client and @marsaud/smb2 are in serverExternalPackages.
