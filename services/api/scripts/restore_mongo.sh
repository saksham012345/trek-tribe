#!/usr/bin/env bash
# Restore MongoDB archive created by mongodump --archive --gzip

set -euo pipefail

if [ -z "$MONGODB_URI" ]; then
  echo "MONGODB_URI must be set"
  exit 2
fi

if [ $# -lt 1 ]; then
  echo "Usage: $0 /path/to/backup.archive"
  exit 2
fi

ARCHIVE_PATH="$1"

if [ ! -f "$ARCHIVE_PATH" ]; then
  echo "Archive not found: $ARCHIVE_PATH"
  exit 2
fi

echo "Restoring $ARCHIVE_PATH to $MONGODB_URI"
mongorestore --uri="$MONGODB_URI" --archive="$ARCHIVE_PATH" --gzip --drop

echo "Restore complete"
