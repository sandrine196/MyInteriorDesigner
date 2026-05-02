#!/bin/bash
# EU Migration Script
# Run once when moving the production deployment from UK/US to EU.
# Prerequisites: psql, rclone, jq, curl

set -euo pipefail

echo "╔══════════════════════════════════════╗"
echo "║  My Interior Designer – EU Migration ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Required env vars ─────────────────────────────────────────────────────────
: "${SOURCE_DATABASE_URL:?Set SOURCE_DATABASE_URL (current Postgres DSN)}"
: "${EU_DATABASE_URL:?Set EU_DATABASE_URL (target Postgres DSN)}"
: "${SOURCE_HEALTH_URL:?Set SOURCE_HEALTH_URL (e.g. https://api.myinteriordesigner.co.uk)}"
: "${EU_HEALTH_URL:?Set EU_HEALTH_URL (e.g. https://api-eu.myinteriordesigner.co.uk)}"

# Optional: set these to migrate file storage
MIGRATE_STORAGE="${MIGRATE_STORAGE:-false}"
RCLONE_SOURCE="${RCLONE_SOURCE:-}"   # e.g. r2-us:my-bucket
RCLONE_DEST="${RCLONE_DEST:-}"       # e.g. scaleway-eu:my-eu-bucket

BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql"

# ── Step 1: Verify source is healthy ─────────────────────────────────────────
echo "→ Checking source deployment..."
STATUS=$(curl -sf "${SOURCE_HEALTH_URL}/health" | jq -r '.status')
if [ "$STATUS" != "ok" ]; then
  echo "✗ Source health check failed (status: $STATUS). Aborting."
  exit 1
fi
echo "  ✓ Source is healthy"

# ── Step 2: Export source database ───────────────────────────────────────────
echo ""
echo "→ Exporting source database to ${BACKUP_FILE}..."
pg_dump "$SOURCE_DATABASE_URL" > "$BACKUP_FILE"
echo "  ✓ Exported $(wc -c < "$BACKUP_FILE" | tr -d ' ') bytes"

# ── Step 3: Import to EU database ────────────────────────────────────────────
echo ""
echo "→ Importing to EU database..."
psql "$EU_DATABASE_URL" < "$BACKUP_FILE"
echo "  ✓ Import complete"

# ── Step 4: Migrate file storage (optional) ───────────────────────────────────
if [ "$MIGRATE_STORAGE" = "true" ]; then
  echo ""
  echo "→ Syncing storage: ${RCLONE_SOURCE} → ${RCLONE_DEST}..."
  if ! command -v rclone &>/dev/null; then
    echo "  ✗ rclone not found. Install from https://rclone.org and configure remotes."
    exit 1
  fi
  rclone sync "$RCLONE_SOURCE" "$RCLONE_DEST" --progress
  echo "  ✓ Storage sync complete"
else
  echo ""
  echo "→ Skipping storage migration (set MIGRATE_STORAGE=true to enable)"
fi

# ── Step 5: Verify EU deployment ─────────────────────────────────────────────
echo ""
echo "→ Checking EU deployment health..."
EU_STATUS=$(curl -sf "${EU_HEALTH_URL}/health" | jq -r '.status' || echo "unreachable")
EU_REGION=$(curl -sf "${EU_HEALTH_URL}/health" | jq -r '.region' || echo "?")
if [ "$EU_STATUS" = "ok" ]; then
  echo "  ✓ EU deployment is healthy (region: ${EU_REGION})"
else
  echo "  ✗ EU health check failed (status: ${EU_STATUS})"
  echo "    Check that the EU backend is running and DATABASE_URL points to the new DB."
  exit 1
fi

# ── Step 6: Reminders ────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  Migration data transfer complete!"
echo "══════════════════════════════════════════"
echo ""
echo "Remaining manual steps:"
echo "  1. Update DNS: point api.myinteriordesigner.co.uk → EU load balancer"
echo "  2. Set DEPLOYMENT_REGION=EU, STRICT_GDPR=true on the EU backend"
echo "  3. Set STORAGE_PROVIDER and storage credentials for EU bucket"
echo "  4. Update NEXT_PUBLIC_API_URL and NEXT_PUBLIC_REGION in the frontend deploy"
echo "  5. Monitor /health and error rates for 30 minutes after cutover"
echo "  6. Keep source deployment running for 24h in case rollback is needed"
echo ""
echo "Backup saved to: ${BACKUP_FILE}"
