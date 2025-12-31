#!/bin/bash
# WORKLOG Auto-Cycling Script
# Archives WORKLOG entries when the file exceeds a token threshold
# Run this before starting work or add to pre-commit hook

WORKLOG="docs/WORKLOG.md"
ARCHIVE_DIR="docs/archive"
MAX_TOKENS=22000  # Archive when exceeding this threshold
TOKENS_PER_LINE=40  # Rough estimate for line -> token conversion

# Check if WORKLOG exists
if [ ! -f "$WORKLOG" ]; then
    echo "WORKLOG not found at $WORKLOG"
    exit 0
fi

# Count lines and estimate tokens
LINE_COUNT=$(wc -l < "$WORKLOG")
ESTIMATED_TOKENS=$((LINE_COUNT * TOKENS_PER_LINE))

echo "[WORKLOG] Lines: $LINE_COUNT, Estimated tokens: $ESTIMATED_TOKENS"

if [ $ESTIMATED_TOKENS -lt $MAX_TOKENS ]; then
    echo "[WORKLOG] Under threshold ($MAX_TOKENS tokens). No action needed."
    exit 0
fi

echo "[WORKLOG] Exceeds threshold. Archiving older entries..."

# Create archive directory if needed
mkdir -p "$ARCHIVE_DIR"

# Find the first line of entries from last month (approximate)
CURRENT_MONTH=$(date +"%Y-%m")
LAST_MONTH=$(date -v-1m +"%Y-%m" 2>/dev/null || date -d "1 month ago" +"%Y-%m")

# Find where current month entries end
CUTOFF_LINE=$(grep -n "^$LAST_MONTH\|^$CURRENT_MONTH" "$WORKLOG" | tail -1 | cut -d: -f1)

if [ -z "$CUTOFF_LINE" ] || [ "$CUTOFF_LINE" -lt 10 ]; then
    # Fallback: keep last 100 lines
    CUTOFF_LINE=$((LINE_COUNT - 100))
    if [ $CUTOFF_LINE -lt 10 ]; then
        CUTOFF_LINE=10
    fi
fi

# Extract header (recent entries)
head -n "$CUTOFF_LINE" "$WORKLOG" > /tmp/worklog_recent.md

# Extract older entries for archive
ARCHIVE_NAME="WORKLOG-$(date +%Y-%m-%d)-archive.md"
tail -n +$((CUTOFF_LINE + 1)) "$WORKLOG" > "$ARCHIVE_DIR/$ARCHIVE_NAME"
ARCHIVED_LINES=$(wc -l < "$ARCHIVE_DIR/$ARCHIVE_NAME")

# Replace WORKLOG with recent entries + archive reference
mv /tmp/worklog_recent.md "$WORKLOG"
echo "" >> "$WORKLOG"
echo "--- Archived entries available at $ARCHIVE_DIR/$ARCHIVE_NAME ---" >> "$WORKLOG"

echo "[WORKLOG] Archived $ARCHIVED_LINES lines to $ARCHIVE_DIR/$ARCHIVE_NAME"
echo "[WORKLOG] WORKLOG now has $(wc -l < "$WORKLOG") lines"
