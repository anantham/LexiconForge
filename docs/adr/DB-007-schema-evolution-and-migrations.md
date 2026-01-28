# DB-007: Schema Evolution & Migration Strategy

**Date:** 2025-01-13
**Status:** Proposed
**Authors:** Development Team
**Depends on:** DB-001 (Service Decomposition), DB-003 (Version-Centric Data Model)

## Context

### Schema Evolution Requirements (January 2025)
LexiconForge requires a robust migration system to handle:

- **Monthly Schema Changes**: Regular feature additions requiring database schema updates
- **Backward Compatibility**: Users with existing data must migrate seamlessly
- **Production Data Safety**: Zero data loss during migrations with rollback capability
- **Concurrent Access**: Migrations must handle 2-4 browser tabs accessing same data
- **Large Datasets**: Efficient migration of 1000+ chapters with 5 versions each

### Current Migration Challenges
- **Ad-hoc Migrations**: No standardized process for schema changes
- **Data Loss Risk**: No systematic backup and rollback strategy
- **Performance Impact**: Blocking migrations can freeze user interface
- **Version Tracking**: No explicit schema versioning system
- **Concurrency Issues**: Race conditions when multiple tabs perform migrations

### Business Continuity Requirements
- **Zero Downtime**: Users can continue reading during migrations
- **Gradual Rollout**: Ability to test migrations on subset of data
- **Quick Rollback**: <5 minutes to revert problematic schema changes
- **Data Integrity**: All referential constraints preserved during migration

## Decision

**Implement systematic Schema Evolution & Migration Strategy with versioned migrations, chunked processing, and comprehensive rollback capability.**

### Core Principles

1. **Explicit Schema Versioning**: Every database has tracked `schema_version`
2. **Idempotent Migrations**: Safe to run multiple times without side effects
3. **Chunked Processing**: Large migrations processed in manageable batches
4. **Rollback Safety**: Complete rollback strategy for every migration
5. **Non-Blocking**: Migrations don't freeze user interface

## Schema Version Management

### Version Storage Schema
```typescript
// New meta store for schema tracking
export interface SchemaMetadata {
  schema_version: number;
  last_migration_date: string;
  migration_log: MigrationLogEntry[];
  rollback_data?: RollbackMetadata;
}

export interface MigrationLogEntry {
  version: number;
  applied_at: string;
  duration_ms: number;
  records_affected: number;
  success: boolean;
  error_message?: string;
  rollback_available: boolean;
}

export interface RollbackMetadata {
  target_version: number;
  backup_data: Record<string, any[]>;
  rollback_steps: RollbackStep[];
  created_at: string;
}

// Current schema version in code
export const CURRENT_SCHEMA_VERSION = 7;

// Migration registry
export const MIGRATIONS: Record<number, Migration> = {
  1: createMigration_001_InitialSchema,
  2: createMigration_002_AddImageMetadata,
  3: createMigration_003_VersionAnchorRefactor,
  4: createMigration_004_FeedbackSpanStructure,
  5: createMigration_005_SettingsSignature,
  6: createMigration_006_CascadeDeleteOptimization,
  7: createMigration_007_ConcurrencySupport
} as const;
```

### Migration Interface
```typescript
export interface Migration {
  readonly version: number;
  readonly description: string;
  readonly estimatedDuration: string;
  readonly affectedStores: readonly string[];
  readonly breakingChanges: readonly string[];
  
  // Core migration logic
  up(tx: IDBTransaction, progress: ProgressCallback): Promise<MigrationResult>;
  down(tx: IDBTransaction, rollbackData: any): Promise<void>;
  
  // Validation and safety
  validate(db: IDBDatabase): Promise<ValidationResult>;
  createRollbackData(db: IDBDatabase): Promise<RollbackData>;
  estimateImpact(db: IDBDatabase): Promise<ImpactEstimate>;
}

export interface MigrationResult {
  recordsAffected: number;
  duration: number;
  rollbackData: any;
  warnings: string[];
}

export interface ProgressCallback {
  (completed: number, total: number, message: string): void;
}
```

### Migration Engine
```typescript
export class MigrationEngine {
  constructor(
    private db: IDBDatabase,
    private progressCallback?: ProgressCallback
  ) {}

  async getCurrentSchemaVersion(): Promise<number> {
    const tx = this.db.transaction(['schema_meta'], 'readonly');
    const store = tx.objectStore('schema_meta');
    const metadata = await promisify(store.get('current'));
    return metadata?.schema_version ?? 0;
  }

  async runMigrations(): Promise<MigrationSummary> {
    const currentVersion = await this.getCurrentSchemaVersion();
    const targetVersion = CURRENT_SCHEMA_VERSION;
    
    if (currentVersion >= targetVersion) {
      return { alreadyCurrent: true, currentVersion };
    }

    const migrationsToRun = this.getMigrationsRange(currentVersion, targetVersion);
    const summary: MigrationSummary = {
      startVersion: currentVersion,
      endVersion: targetVersion,
      migrationsRun: [],
      totalDuration: 0,
      success: true
    };

    // Create backup before starting migrations
    await this.createPreMigrationBackup(currentVersion);

    for (const migration of migrationsToRun) {
      try {
        this.progressCallback?.(0, 1, `Starting ${migration.description}`);
        
        const result = await this.runSingleMigration(migration);
        
        summary.migrationsRun.push({
          version: migration.version,
          description: migration.description,
          duration: result.duration,
          recordsAffected: result.recordsAffected,
          success: true
        });
        summary.totalDuration += result.duration;
        
        // Update schema version after each successful migration
        await this.updateSchemaVersion(migration.version, result);
        
      } catch (error) {
        console.error(`Migration ${migration.version} failed:`, error);
        
        // Rollback to previous version
        await this.rollbackToVersion(currentVersion);
        
        summary.success = false;
        summary.error = error.message;
        break;
      }
    }

    return summary;
  }

  private async runSingleMigration(migration: Migration): Promise<MigrationResult> {
    // Pre-migration validation
    const validation = await migration.validate(this.db);
    if (!validation.valid) {
      throw new Error(`Migration ${migration.version} validation failed: ${validation.message}`);
    }

    // Create rollback data before migration
    const rollbackData = await migration.createRollbackData(this.db);
    
    // Run migration in transaction
    const tx = this.db.transaction(migration.affectedStores, 'readwrite');
    const startTime = Date.now();
    
    try {
      const result = await migration.up(tx, this.progressCallback);
      await this.commitTransaction(tx);
      
      return {
        ...result,
        duration: Date.now() - startTime,
        rollbackData
      };
    } catch (error) {
      await this.rollbackTransaction(tx);
      throw error;
    }
  }

  async rollbackToVersion(targetVersion: number): Promise<void> {
    const currentVersion = await this.getCurrentSchemaVersion();
    
    if (targetVersion >= currentVersion) {
      throw new Error(`Cannot rollback to version ${targetVersion} >= current ${currentVersion}`);
    }

    const migrationsToRollback = this.getMigrationsRange(targetVersion, currentVersion).reverse();
    
    for (const migration of migrationsToRollback) {
      const rollbackData = await this.getRollbackData(migration.version);
      
      if (!rollbackData) {
        throw new Error(`No rollback data available for migration ${migration.version}`);
      }

      const tx = this.db.transaction(migration.affectedStores, 'readwrite');
      
      try {
        await migration.down(tx, rollbackData);
        await this.commitTransaction(tx);
        
        // Update schema version
        await this.updateSchemaVersion(migration.version - 1);
        
      } catch (error) {
        console.error(`Rollback of migration ${migration.version} failed:`, error);
        throw error;
      }
    }
  }
}
```

## Chunked Migration Pattern

### Large Dataset Migration
```typescript
// Example: Migrate 1000+ chapters to new structure
export const createMigration_003_VersionAnchorRefactor: Migration = {
  version: 3,
  description: "Refactor to use translation_id as primary cascade anchor",
  estimatedDuration: "2-5 minutes for 5000 translations",
  affectedStores: ['translations', 'images', 'feedback'],
  breakingChanges: ['images.translation_ref renamed to translation_id'],

  async up(tx: IDBTransaction, progress: ProgressCallback): Promise<MigrationResult> {
    const CHUNK_SIZE = 100;
    let totalProcessed = 0;
    let recordsAffected = 0;

    // 1. Migrate translations table first
    const translationsStore = tx.objectStore('translations');
    const translationsCursor = translationsStore.openCursor();
    const translationsToUpdate: Translation[] = [];

    await new Promise<void>((resolve, reject) => {
      translationsCursor.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const translation = cursor.value;
          
          // Add translation_id if missing
          if (!translation.translation_id) {
            translation.translation_id = generateULID();
            translationsToUpdate.push(translation);
          }
          
          cursor.continue();
        } else {
          resolve();
        }
      };
      translationsCursor.onerror = () => reject(translationsCursor.error);
    });

    // Process translations in chunks
    for (let i = 0; i < translationsToUpdate.length; i += CHUNK_SIZE) {
      const chunk = translationsToUpdate.slice(i, i + CHUNK_SIZE);
      
      for (const translation of chunk) {
        await promisify(translationsStore.put(translation));
        recordsAffected++;
      }
      
      totalProcessed += chunk.length;
      progress(totalProcessed, translationsToUpdate.length, 'Updating translations');
      
      // Yield to event loop to prevent blocking UI
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // 2. Update dependent records (images, feedback) to use translation_id
    await this.migrateDependentRecords(tx, progress);

    return { recordsAffected, duration: 0, rollbackData: null, warnings: [] };
  },

  async down(tx: IDBTransaction, rollbackData: any): Promise<void> {
    // Restore previous structure using rollback data
    const { originalTranslations, originalImages, originalFeedback } = rollbackData;
    
    // Restore in reverse dependency order
    await this.restoreStore(tx, 'feedback', originalFeedback);
    await this.restoreStore(tx, 'images', originalImages);
    await this.restoreStore(tx, 'translations', originalTranslations);
  },

  async createRollbackData(db: IDBDatabase): Promise<RollbackData> {
    // Snapshot current state before migration
    const [translations, images, feedback] = await Promise.all([
      this.snapshotStore(db, 'translations'),
      this.snapshotStore(db, 'images'),
      this.snapshotStore(db, 'feedback')
    ]);

    return {
      originalTranslations: translations,
      originalImages: images,
      originalFeedback: feedback,
      createdAt: new Date().toISOString()
    };
  },

  async validate(db: IDBDatabase): Promise<ValidationResult> {
    // Check pre-migration conditions
    const issues: string[] = [];
    
    // Verify all required stores exist
    if (!db.objectStoreNames.contains('translations')) {
      issues.push('translations store missing');
    }
    
    // Check for data integrity issues
    const translationsCount = await this.countRecords(db, 'translations');
    if (translationsCount === 0) {
      issues.push('No translations to migrate');
    }

    return {
      valid: issues.length === 0,
      issues,
      preRequisites: ['Schema version >= 2']
    };
  }
};
```

### Idempotent Migration Design
```typescript
// Migrations must be safely re-runnable
export abstract class IdempotentMigration implements Migration {
  abstract version: number;
  abstract description: string;

  async up(tx: IDBTransaction, progress: ProgressCallback): Promise<MigrationResult> {
    // Check if migration already applied
    if (await this.isAlreadyApplied(tx)) {
      return {
        recordsAffected: 0,
        duration: 0,
        rollbackData: null,
        warnings: ['Migration already applied - skipping']
      };
    }

    // Perform actual migration
    return await this.performMigration(tx, progress);
  }

  protected abstract isAlreadyApplied(tx: IDBTransaction): Promise<boolean>;
  protected abstract performMigration(tx: IDBTransaction, progress: ProgressCallback): Promise<MigrationResult>;
}

// Example idempotent migration
export class Migration_005_SettingsSignature extends IdempotentMigration {
  version = 5;
  description = "Add settings_signature to translations";
  affectedStores = ['translations'] as const;

  protected async isAlreadyApplied(tx: IDBTransaction): Promise<boolean> {
    const store = tx.objectStore('translations');
    const cursor = store.openCursor();
    
    return new Promise((resolve) => {
      cursor.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const translation = cursor.value;
          // Check if settings_signature field exists
          resolve('meta' in translation && 'settings_signature' in translation.meta);
        } else {
          resolve(false); // No records, migration not applied
        }
      };
    });
  }

  protected async performMigration(tx: IDBTransaction, progress: ProgressCallback): Promise<MigrationResult> {
    const store = tx.objectStore('translations');
    const allTranslations = await promisify(store.getAll());
    let recordsAffected = 0;

    for (let i = 0; i < allTranslations.length; i++) {
      const translation = allTranslations[i];
      
      if (!translation.meta.settings_signature) {
        // Compute settings signature
        translation.meta.settings_signature = this.computeSettingsSignature(translation.meta);
        await promisify(store.put(translation));
        recordsAffected++;
      }

      progress(i + 1, allTranslations.length, 'Adding settings signatures');
    }

    return { recordsAffected, duration: 0, rollbackData: null, warnings: [] };
  }

  private computeSettingsSignature(meta: any): string {
    const sigData = {
      model: meta.model,
      temperature: meta.temperature,
      penalties: meta.penalties,
      schema: meta.schema,
      system_prompt_title: meta.system_prompt_title,
      seed: meta.seed
    };
    return sha256(JSON.stringify(sigData));
  }
}
```

## Storage Quota & Retention Policy

### Quota Management
```typescript
export interface QuotaPolicy {
  maxDatabaseSize: number;        // 500 MB
  maxImageBlobSize: number;       // 50 MB total
  retentionDays: number;          // 90 days
  evictionStrategy: 'lru' | 'fifo' | 'size-based';
}

export class QuotaManager {
  constructor(private policy: QuotaPolicy) {}

  async checkQuotaUsage(): Promise<QuotaUsage> {
    const estimate = await navigator.storage?.estimate();
    
    return {
      used: estimate?.usage ?? 0,
      available: estimate?.quota ?? 0,
      percentage: estimate ? (estimate.usage / estimate.quota) * 100 : 0,
      withinPolicy: estimate ? estimate.usage < this.policy.maxDatabaseSize : true
    };
  }

  async enforceRetentionPolicy(): Promise<RetentionResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.policy.retentionDays);

    // Remove old image blobs first (largest space consumers)
    const imagesToRemove = await this.findExpiredImages(cutoffDate);
    await this.removeImages(imagesToRemove);

    // Remove old feedback data
    const feedbackToRemove = await this.findExpiredFeedback(cutoffDate);
    await this.removeFeedback(feedbackToRemove);

    // Clean up orphaned translations (no active version references)
    const orphanedTranslations = await this.findOrphanedTranslations();
    await this.removeTranslations(orphanedTranslations);

    return {
      imagesRemoved: imagesToRemove.length,
      feedbackRemoved: feedbackToRemove.length,
      translationsRemoved: orphanedTranslations.length,
      spaceReclaimed: await this.calculateSpaceReclaimed()
    };
  }

  // Emergency quota enforcement for Safari/iOS limits
  async handleQuotaExceeded(): Promise<void> {
    console.warn('Storage quota exceeded - performing emergency cleanup');
    
    // Remove oldest image blobs first
    await this.removeOldestImages(100);
    
    // Remove old feedback data
    await this.removeOldFeedback(200);
    
    // Compact database
    await this.compactDatabase();
  }
}
```

### Identity & Ordering Standards
```typescript
// Standardize on ULID for all IDs (lexicographically sortable by time)
import { ulid } from 'ulidx';

export function generateULID(): string {
  return ulid();
}

export function generateTranslationId(): string {
  return `tl_${ulid()}`;
}

export function generateChapterId(): string {
  return `ch_${ulid()}`;
}

export function generateImageId(): string {
  return `img_${ulid()}`;
}

// Version numbering (monotonic per chapter per language)
export function computeNextVersion(
  chapterId: string,
  language: string,
  existingVersions: number[]
): number {
  return Math.max(0, ...existingVersions) + 1;
}

// Timestamp utilities (always UTC)
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

export function parseTimestamp(timestamp: string): Date {
  return new Date(timestamp);
}
```

## Concurrency Contract

### BroadcastChannel Event Schema
```typescript
// Fixed event schema for cross-tab coordination
export interface DbEvent {
  store: 'chapters' | 'translations' | 'images' | 'feedback' | 'settings' | 'novels' | 'prompts' | 'url_mappings';
  op: 'put' | 'delete' | 'clear';
  ids: string[];
  rev?: number;           // Optional revision number for optimistic concurrency
  traceId?: string;       // For debugging and observability  
  ts: number;             // Unix timestamp
  tabId: string;          // Originating tab identifier
}

// Broadcast service for cross-tab coordination
export class DatabaseBroadcastService {
  private channel: BroadcastChannel;
  private tabId: string;
  private listeners = new Map<string, Set<DbEventListener>>();

  constructor() {
    this.channel = new BroadcastChannel('db-events');
    this.tabId = `tab_${ulid()}`;
    this.channel.addEventListener('message', this.handleBroadcastMessage.bind(this));
  }

  // Emit database change events
  emitChange(event: Omit<DbEvent, 'ts' | 'tabId'>): void {
    const fullEvent: DbEvent = {
      ...event,
      ts: Date.now(),
      tabId: this.tabId
    };

    // Don't broadcast to self
    this.channel.postMessage(fullEvent);
    
    // Log for debugging
    console.debug('DB event emitted:', fullEvent);
  }

  // Listen for specific store changes
  onStoreChange(store: DbEvent['store'], listener: DbEventListener): void {
    if (!this.listeners.has(store)) {
      this.listeners.set(store, new Set());
    }
    this.listeners.get(store)!.add(listener);
  }

  private handleBroadcastMessage(event: MessageEvent<DbEvent>): void {
    const dbEvent = event.data;
    
    // Ignore events from this tab
    if (dbEvent.tabId === this.tabId) return;
    
    // Notify relevant listeners
    const storeListeners = this.listeners.get(dbEvent.store);
    if (storeListeners) {
      storeListeners.forEach(listener => {
        try {
          listener(dbEvent);
        } catch (error) {
          console.error('DB event listener error:', error);
        }
      });
    }
  }
}

// Guarantee read-your-writes in current tab; eventual consistency across tabs
export interface ConsistencyGuarantees {
  readYourWrites: true;           // Changes visible immediately in same tab
  eventualConsistency: '< 250ms'; // Changes propagate across tabs within 250ms
  conflictResolution: 'last-write-wins'; // Simple conflict resolution
}

export type DbEventListener = (event: DbEvent) => void;
```

## Success Metrics

### Migration Performance
- **Migration Speed**: <2 minutes for 5000 translations (chunked processing)
- **Rollback Time**: <30 seconds to previous schema version
- **Zero Data Loss**: 100% data preservation during migrations
- **Uptime**: Migrations don't block user interface >500ms

### Schema Evolution
- **Monthly Cadence**: Support regular schema changes without breaking existing functionality
- **Backward Compatibility**: New versions work with previous schema during migration window
- **Automated Testing**: All migrations tested against production-sized datasets

### Storage Management
- **Quota Compliance**: Stay within 500 MB database size limit
- **Retention Effectiveness**: Automatic cleanup maintains <90 day data lifecycle
- **Emergency Handling**: Graceful degradation when quota limits reached

## Implementation Strategy

### Phase 1: Migration Infrastructure (Week 1)
```typescript
// 1. Implement schema versioning system
// 2. Create migration engine with chunked processing
// 3. Add rollback capability with data snapshots
// 4. Set up quota management system
```

### Phase 2: Existing Data Migration (Week 2)
```typescript
// 1. Create migrations for current schema to versioned system
// 2. Migrate existing user data safely
// 3. Add comprehensive testing for migration edge cases
// 4. Validate rollback procedures
```

### Phase 3: BroadcastChannel Integration (Week 3)
```typescript
// 1. Implement cross-tab event coordination
// 2. Add consistency guarantees and conflict resolution
// 3. Test concurrent migration scenarios
// 4. Add observability and debugging tools
```

### Phase 4: Production Validation (Week 4)
```typescript
// 1. Test migrations with large datasets
// 2. Validate performance targets
// 3. Confirm quota enforcement
// 4. Document migration procedures
```

## Consequences

### Positive Outcomes
1. **Reliable Schema Evolution**: Systematic approach to database changes
2. **Data Safety**: Comprehensive backup and rollback procedures
3. **Performance**: Non-blocking migrations with progress feedback
4. **Scalability**: Handles large datasets efficiently
5. **Developer Experience**: Clear migration authoring patterns

### Trade-offs and Challenges
1. **Complexity**: More sophisticated migration system vs ad-hoc changes
2. **Storage Overhead**: Rollback data requires additional storage space
3. **Development Time**: Migration authoring takes more upfront effort
4. **Testing Burden**: Need comprehensive migration testing strategy

### Risk Mitigation
1. **Gradual Rollout**: Test migrations on development data first
2. **Monitoring**: Comprehensive logging and error tracking
3. **Emergency Procedures**: Quick rollback for critical issues
4. **User Communication**: Clear progress indication during migrations

## Follow-up Requirements
- **Migration Testing Framework**: Automated testing with various dataset sizes
- **Documentation**: Migration authoring guide and troubleshooting procedures
- **Monitoring Dashboard**: Real-time migration progress and health metrics
- **Emergency Procedures**: Incident response plan for migration failures

## Review Schedule

- **Month 1**: Evaluate migration system effectiveness and user impact
- **Month 3**: Assess schema evolution velocity and developer experience
- **Month 6**: Review long-term data management and storage optimization
- **Month 12**: Comprehensive analysis of system reliability and scalability