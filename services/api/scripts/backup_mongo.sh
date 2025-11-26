#!/usr/bin/env bash
# Simple MongoDB backup using mongodump. Requires MONGODB_URI and BACKUP_DIR env vars.

set -euo pipefail

if [ -z "$MONGODB_URI" ]; then
  echo "MONGODB_URI must be set"
  exit 2
fi

BACKUP_DIR=${BACKUP_DIR:-"./backups"}
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
FILENAME="$BACKUP_DIR/mongodump-$TIMESTAMP"

mkdir -p "$BACKUP_DIR"

echo "Starting mongodump to $FILENAME"
mongodump --uri="$MONGODB_URI" --archive="$FILENAME" --gzip

echo "Backup complete: $FILENAME"
