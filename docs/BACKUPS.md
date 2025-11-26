# MongoDB Backups & Restore

This document describes how to take backups and restore the MongoDB used by the Trek Tribe API.

Prerequisites
- `mongodump` and `mongorestore` installed on the machine where you run the scripts.
- The `MONGODB_URI` environment variable set.

Backup

Run the provided script (creates a gzip archive):

```bash
cd services/api
export MONGODB_URI="<your-mongo-uri>"
./scripts/backup_mongo.sh
```

Restore

To restore from an archive created by `backup_mongo.sh`:

```bash
cd services/api
export MONGODB_URI="<your-mongo-uri>"
./scripts/restore_mongo.sh /path/to/mongodump-20250101T120000Z
```

Notes
- These scripts are minimal helpers. For production, store backups in an offsite location (S3, GCS), rotate and purge old backups, and test restores regularly.
