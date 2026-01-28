# IndexedDB Schema Guide

> Database schema reference for LexiconForge

**Database Name:** `lexicon-forge`
**Current Version:** 13

## Overview

LexiconForge uses IndexedDB for client-side persistence with 10 object stores organized by domain.

## Object Stores

### 1. `chapters`

**Key Path:** `url`

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | Primary key - chapter URL |
| `stableId` | string | Stable identifier |
| `title` | string | Chapter title |
| `content` | string | Raw HTML content |
| `nextUrl` | string | Next chapter URL |
| `prevUrl` | string | Previous chapter URL |
| `fanTranslation` | string | Fan translation content |
| `suttaStudio` | object | Sutta Studio packet |
| `chapterNumber` | number | Chapter sequence number |
| `dateAdded` | string | ISO timestamp |

**Indexes:** `stableId`, `title`, `canonicalUrl`, `chapterNumber`, `dateAdded`, `lastAccessed`

### 2. `translations`

**Key Path:** `id`

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Primary key |
| `chapterUrl` | string | Source chapter URL |
| `stableId` | string | Chapter stable ID |
| `version` | number | Version number (1, 2, 3...) |
| `translatedTitle` | string | Translated title |
| `translation` | string | HTML translated content |
| `footnotes` | Array | `[{ marker, text }]` |
| `suggestedIllustrations` | Array | Illustration prompts |
| `provider` | string | AI provider |
| `model` | string | Model name |
| `totalTokens` | number | Tokens used |
| `estimatedCost` | number | USD cost |
| `isActive` | boolean | Active version flag |
| `createdAt` | string | ISO timestamp |

**Indexes:** `chapterUrl`, `stableId`, `version` (compound), `isActive`, `createdAt`

### 3. `settings`

**Key Path:** `key`

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | Setting key |
| `value` | unknown | Setting value |
| `updatedAt` | string | Last update |

### 4. `feedback`

**Key Path:** `id`

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Feedback ID |
| `chapterUrl` | string | Chapter URL |
| `translationId` | string | Translation version ID |
| `type` | string | `'positive'` | `'negative'` | `'suggestion'` |
| `selection` | string | Selected text |
| `comment` | string | User comment |
| `createdAt` | string | ISO timestamp |

**Indexes:** `chapterUrl`, `translationId`, `createdAt`

### 5. `prompt_templates`

**Key Path:** `id`

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Template ID |
| `name` | string | Template name (unique) |
| `content` | string | Template content |
| `isDefault` | boolean | Default template flag |

**Indexes:** `name` (unique), `isDefault`, `createdAt`, `lastUsed`

### 6. `url_mappings`

**Key Path:** `url`

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | URL being mapped |
| `stableId` | string | Mapped stable ID |
| `isCanonical` | boolean | Canonical URL flag |

**Indexes:** `stableId`, `isCanonical`

### 7. `novels`

**Key Path:** `id`

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Novel ID |
| `title` | string | Novel title |
| `source` | string | Source website |
| `chapterCount` | number | Total chapters |

**Indexes:** `source`, `title`, `dateAdded`, `lastAccessed`

### 8. `chapter_summaries`

**Key Path:** `stableId`

Denormalized summaries for quick list views.

| Field | Type | Description |
|-------|------|-------------|
| `stableId` | string | Chapter stable ID |
| `title` | string | Chapter title |
| `translatedTitle` | string | Translation title |
| `hasTranslation` | boolean | Translation exists |
| `hasImages` | boolean | Has illustrations |

**Indexes:** `chapterNumber`, `lastAccessed`, `hasTranslation`

### 9. `amendment_logs`

**Key Path:** `id`

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Log entry ID |
| `timestamp` | number | Milliseconds since epoch |
| `chapterId` | string | Chapter ID |
| `proposal` | object | `{ observation, currentRule, proposedChange, reasoning }` |
| `action` | string | `'accepted'` | `'rejected'` | `'modified'` |

**Indexes:** `timestamp`, `chapterId`, `action`

### 10. `diffResults`

**Key Path:** Compound `['chapterId', 'aiVersionId', 'fanVersionId', 'rawVersionId', 'algoVersion']`

Stores semantic diff analysis results.

**Indexes:** `by_chapter` (chapterId), `by_analyzed_at`

## Relationships

```
chapters (url) ─── 1:N ──→ translations (chapterUrl)
                         └─ one marked isActive

chapters (stableId) ─── 1:1 ──→ chapter_summaries

chapters (url) ─── 1:N ──→ url_mappings (url)

translations ─── 1:N ──→ feedback (translationId)
```

## Migration Patterns

### Adding a New Store

```typescript
function migrateToVN(db: IDBDatabase, transaction: IDBTransaction): void {
  const store = ensureStore(db, transaction, 'my_store', { keyPath: 'id' });
  ensureIndex(store, 'indexName', 'fieldPath');
}

MIGRATIONS[N] = migrateToVN;
SCHEMA_VERSIONS.CURRENT = N;
```

### Adding a New Index

Indexes can be added without recreating the store:

```typescript
ensureIndex(store, 'newIndexName', 'newFieldPath', { unique: false });
```

### Adding a New Field

No schema migration needed - IndexedDB is schemaless. Just update TypeScript interfaces.

## Transaction Patterns

### Read-Only

```typescript
const records = await withReadTxn(
  STORE_NAMES.CHAPTERS,
  async (_txn, stores) => {
    const store = stores[STORE_NAMES.CHAPTERS];
    return await promisifyRequest(store.index('stableId').get(stableId));
  },
  'chapters', 'operations', 'getByStableId'
);
```

### Write

```typescript
await withWriteTxn(
  STORE_NAMES.CHAPTERS,
  async (_txn, stores) => {
    await promisifyRequest(stores[STORE_NAMES.CHAPTERS].put(record));
  },
  'chapters', 'operations', 'storeChapter'
);
```

### Multi-Store

```typescript
await withWriteTxn(
  [STORE_NAMES.TRANSLATIONS, STORE_NAMES.CHAPTER_SUMMARIES],
  async (_txn, stores) => {
    // Both stores available in transaction
  },
  'translations', 'operations'
);
```

## Performance Tips

| Operation | Complexity | Notes |
|-----------|------------|-------|
| Get by key | O(1) | `store.get(key)` |
| Get by index | O(log N + K) | `index.getAll(value)` |
| Range query | O(log N + K) | `IDBKeyRange.bound(min, max)` |
| Cursor | Efficient for batch | `store.openCursor()` |

Use `batchOperation` helper for large bulk inserts.

## Debugging

### Check Schema Health

```typescript
import { validateSchema, exportSchema } from './core/schema';

const isValid = validateSchema(db);
const snapshot = exportSchema(db);
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Missing indexes | Run migration to v13 (schema repair) |
| Store not found | Check STORE_NAMES constant |
| Constraint violation | Check unique index constraints |
| Private browsing blocked | Fallback to memory repository |

## References

- **Connection**: `services/db/core/connection.ts`
- **Schema**: `services/db/core/schema.ts`
- **Migrations**: `services/db/migrationService.ts`
- **Transactions**: `services/db/core/txn.ts`
- **Operations**: `services/db/operations/`
