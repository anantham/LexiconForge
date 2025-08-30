# ADR-003: Version-Centric Data Model with Cascade Delete Strategy

**Date:** 2025-01-13  
**Status:** Proposed  
**Authors:** Development Team  
**Depends on:** ADR-001 (Service Decomposition), ADR-002 (Transaction Boundaries)

## Context

### Current Versioning Challenges (January 2025)
- **Dependency Management**: Each translation version has associated feedback, illustrations, footnotes, and image files
- **Cascade Semantics**: Deleting a version should remove all dependent data, but current implementation is unclear
- **Version Tracking**: Chapter metadata (latest_version, active_language_map) becomes inconsistent after deletions
- **Data Integrity**: No clear foreign key relationships or referential integrity enforcement

### Business Requirements
- **5 translation versions** per chapter in typical production usage
- **Version-Specific Dependencies**: Every version has associated feedback tied to specific text spans, illustration prompts, footnotes, and raw image files
- **Clean Deletion**: Deleting a version must remove all dependent features to avoid orphaned data
- **Span-Based Feedback**: Feedback must be associated with specific character ranges within version text
- **Settings Tracking**: Each version tracks complete generation context (temperature, model, prompt template, cost, timing)

### Current Data Model Issues
- **Weak Relationships**: Implicit rather than explicit foreign key relationships
- **Inconsistent Cascades**: Manual cleanup of dependent data across multiple operations
- **Orphaned Records**: Feedback and images can become orphaned after version deletion
- **Metadata Drift**: Chapter metadata doesn't stay synchronized with actual version data

## Decision

**Implement a version-centric data model using `translation_id` as a stable anchor for all version-dependent data, with explicit cascade delete semantics and referential integrity guarantees.**

### Data Integrity Invariants

The following invariants must be maintained at all times:

```typescript
// Explicit invariants (I1-I7) enforced by validation layer
export const DATA_INVARIANTS = {
  // I1: Foreign Key Constraints
  I1_FK_CHAPTERS_NOVELS: 'Every chapters.novel_id must exist in novels table',
  I1_FK_TRANSLATIONS_CHAPTERS: 'Every translations.chapter_id must exist in chapters table', 
  I1_FK_IMAGES_TRANSLATIONS: 'Every images.translation_id must exist in translations table',
  I1_FK_FEEDBACK_TRANSLATIONS: 'Every feedback.translation_id must exist in translations table',

  // I2: Unique Constraints
  I2_UNIQUE_TRANSLATION_VERSION: 'Unique index on (chapter_id, language, version_no) in translations',
  I2_UNIQUE_CHAPTER_INDEX: 'Unique index on (novel_id, index) in chapters',
  I2_UNIQUE_URL_MAPPING: 'Unique index on source_url in url_mappings',

  // I3: Version Consistency  
  I3_LATEST_VERSION_ACCURACY: 'chapters.latest_version = max(version_no) for that chapter or null',
  I3_VERSION_MONOTONIC: 'version_no values must be positive integers starting from 1',
  
  // I4: Active Language Map Integrity
  I4_ACTIVE_LANGUAGE_CONSISTENCY: 'chapters.active_language_map[lang] points to existing translation',
  I4_ACTIVE_VERSION_VALIDITY: 'All active_language_map values must be ≤ latest_version',

  // I5: Cascade Anchor Integrity
  I5_TRANSLATION_ID_REQUIRED: 'Every translation must have a valid translation_id (ULID format)',
  I5_DEPENDENT_DATA_ANCHORED: 'All images and feedback must reference valid translation_id',

  // I6: Settings Signature Consistency  
  I6_SETTINGS_SIGNATURE_FORMAT: 'settings_signature = sha256(JSON.stringify(generation_context))',
  I6_SETTINGS_SIGNATURE_REQUIRED: 'Every translation.meta.settings_signature must be present',

  // I7: Temporal Consistency
  I7_TIMESTAMP_UTC: 'All timestamps stored in UTC ISO 8601 format',
  I7_CREATION_ORDER: 'Higher version_no must have createdAt >= lower version_no for same chapter'
} as const;

// Runtime invariant validator
export class InvariantValidator {
  async validateAll(db: IDBDatabase): Promise<InvariantCheckResult> {
    const results = await Promise.all([
      this.validateI1_ForeignKeys(db),
      this.validateI2_UniqueConstraints(db), 
      this.validateI3_VersionConsistency(db),
      this.validateI4_ActiveLanguageMap(db),
      this.validateI5_CascadeAnchors(db),
      this.validateI6_SettingsSignatures(db),
      this.validateI7_TemporalConsistency(db)
    ]);

    return {
      allValid: results.every(r => r.valid),
      violations: results.flatMap(r => r.violations),
      checkedAt: new Date().toISOString()
    };
  }

  private async validateI1_ForeignKeys(db: IDBDatabase): Promise<ValidationResult> {
    const violations: string[] = [];

    // Check chapters.novel_id references
    const orphanedChapters = await this.findOrphanedReferences(
      db, 'chapters', 'novel_id', 'novels', 'novel_id'
    );
    if (orphanedChapters.length > 0) {
      violations.push(`I1 violation: ${orphanedChapters.length} chapters reference non-existent novels`);
    }

    // Check translations.chapter_id references  
    const orphanedTranslations = await this.findOrphanedReferences(
      db, 'translations', 'chapter_id', 'chapters', 'chapter_id'
    );
    if (orphanedTranslations.length > 0) {
      violations.push(`I1 violation: ${orphanedTranslations.length} translations reference non-existent chapters`);
    }

    // Check images.translation_id references
    const orphanedImages = await this.findOrphanedReferences(
      db, 'images', 'translation_id', 'translations', 'translation_id'
    );
    if (orphanedImages.length > 0) {
      violations.push(`I1 violation: ${orphanedImages.length} images reference non-existent translations`);
    }

    // Check feedback.translation_id references
    const orphanedFeedback = await this.findOrphanedReferences(
      db, 'feedback', 'translation_id', 'translations', 'translation_id'
    );
    if (orphanedFeedback.length > 0) {
      violations.push(`I1 violation: ${orphanedFeedback.length} feedback entries reference non-existent translations`);
    }

    return { valid: violations.length === 0, violations };
  }

  private async validateI3_VersionConsistency(db: IDBDatabase): Promise<ValidationResult> {
    const violations: string[] = [];

    const tx = db.transaction(['chapters', 'translations'], 'readonly');
    const chaptersStore = tx.objectStore('chapters');
    const translationsStore = tx.objectStore('translations');

    const chapters = await promisify(chaptersStore.getAll());

    for (const chapter of chapters) {
      // Get all translations for this chapter
      const chapterTranslations = await promisify(
        translationsStore.index('by_chapter').getAll(chapter.chapter_id)
      );

      if (chapterTranslations.length === 0) {
        // No translations - latest_version should be null
        if (chapter.latest_version !== null) {
          violations.push(
            `I3 violation: Chapter ${chapter.chapter_id} has no translations but latest_version=${chapter.latest_version}`
          );
        }
      } else {
        // Has translations - latest_version should equal max version_no
        const maxVersion = Math.max(...chapterTranslations.map(t => t.version_no));
        if (chapter.latest_version !== maxVersion) {
          violations.push(
            `I3 violation: Chapter ${chapter.chapter_id} latest_version=${chapter.latest_version} but max version_no=${maxVersion}`
          );
        }
      }
    }

    return { valid: violations.length === 0, violations };
  }
}
```

### Enhanced Schema Design

```typescript
// Core Entities
interface Novel {
  novel_id: string;           // Stable identifier
  title: string;
  source: string;             // Origin website
  createdAt: string;          // ISO timestamp
}

interface Chapter {
  chapter_id: string;         // Stable identifier  
  novel_id: string;           // FK to Novel
  index: number;              // Chapter ordering
  title: string;
  source_url: string;         // Original source URL
  latest_version: number | null;  // Highest version_no for this chapter
  active_language_map: Record<string, number>;  // language -> version_no
  createdAt: string;
}

// Version-Centric Anchor
interface Translation {
  translation_id: string;    // PRIMARY KEY - Stable anchor for cascades
  chapter_id: string;        // FK to Chapter
  language: string;          // Target language (e.g., 'english', 'japanese')
  version_no: number;        // Version number within (chapter_id, language)
  text: string;              // Translated content
  meta: TranslationMetadata; // Complete generation context
}

interface TranslationMetadata {
  model: string;             // Model used (e.g., 'gpt-4', 'claude-3')
  settings_signature: string; // Hash of all generation settings
  seed?: number;             // Generation seed for reproducibility
  temperature: number;       // Temperature setting used
  sampling_penalties: Record<string, number>; // All penalty settings
  schema_enforced: boolean;  // Whether JSON schema was enforced
  system_prompt_title: string; // Reference to prompt template used
  cost: number;              // Cost in credits/tokens
  gen_ms: number;            // Generation time in milliseconds  
  createdAt: string;         // When generated
  lastViewedAt: string;      // Last user navigation timestamp
}

// Version-Dependent Entities (cascade delete targets)
interface Image {
  image_id: string;
  chapter_id: string;        // For efficient querying
  translation_id: string;   // FK - CASCADE DELETE
  kind: 'illustration' | 'steering';
  prompt: string;            // Image generation prompt
  negative?: string;         // Negative prompt
  steering_ref?: string;     // Reference to steering image
  blob: Blob;               // Actual image data
  createdAt: string;
}

interface Feedback {
  feedback_id: string;
  translation_id: string;   // FK - CASCADE DELETE  
  span: {                   // Character range in translation text
    start: number;          // Start character position (inclusive)
    end: number;            // End character position (exclusive)
  };
  type: '👍' | '👎' | '?' | '🎨';  // Feedback type
  payload: any;             // Type-specific data (comments, etc.)
  createdAt: string;
}

// Supporting Entities
interface PromptTemplate {
  prompt_id: string;
  title: string;            // Human-readable name
  body: string;             // Actual prompt content
  createdAt: string;
}

interface UrlMapping {
  source_url: string;       // PRIMARY KEY
  novel_id: string;         // FK to Novel
  chapter_id: string;       // FK to Chapter
}

interface Settings {
  key: string;              // Setting identifier
  value: any;               // Setting value (JSON)
}
```

### Referential Integrity Constraints

```typescript
// Foreign Key Relationships (enforced by application)
const INTEGRITY_CONSTRAINTS = {
  // Core relationships
  'chapters.novel_id → novels.novel_id': 'CASCADE DELETE',
  'translations.chapter_id → chapters.chapter_id': 'CASCADE DELETE', 
  'url_mappings.novel_id → novels.novel_id': 'CASCADE DELETE',
  'url_mappings.chapter_id → chapters.chapter_id': 'CASCADE DELETE',
  
  // Version-dependent relationships (key cascade targets)
  'images.translation_id → translations.translation_id': 'CASCADE DELETE',
  'feedback.translation_id → translations.translation_id': 'CASCADE DELETE',
  
  // Unique constraints
  'translations.(chapter_id, language, version_no)': 'UNIQUE',
  'chapters.(novel_id, index)': 'UNIQUE',
  'url_mappings.source_url': 'UNIQUE',
  
  // Data integrity constraints  
  'chapters.latest_version = MAX(translations.version_no) WHERE chapter_id': 'COMPUTED',
  'chapters.active_language_map[lang] ∈ translations.version_no WHERE chapter_id': 'REFERENTIAL',
  'feedback.span.start < feedback.span.end': 'CHECK',
  'translations.version_no > 0': 'CHECK'
};
```

### Database Indexes for Performance

```typescript
// IndexedDB Index Definitions
const INDEXES = {
  // Primary lookups
  translations: [
    'by_ch_lang_ver: [chapter_id, language, version_no]', // Unique key lookup
    'by_chapter: chapter_id',                             // List versions for chapter
    'by_translation_id: translation_id'                   // Direct access
  ],
  
  images: [
    'by_translation: translation_id',     // Cascade delete lookup
    'by_chapter: chapter_id'              // Chapter image listing
  ],
  
  feedback: [
    'by_translation: translation_id',     // Cascade delete lookup
    'by_type: type'                       // Filter by feedback type
  ],
  
  chapters: [
    'by_novel: novel_id',                 // List chapters for novel
    'by_novel_index: [novel_id, index]'   // Ordered chapter listing
  ],
  
  // Performance indexes
  translations: [
    'by_settings_sig: meta.settings_signature',  // Deduplication
    'by_last_viewed: meta.lastViewedAt',         // Recent activity
    'by_cost: meta.cost'                         // Cost analysis
  ]
};
```

## Rationale

### Version-Centric Design Benefits

1. **Clear Cascade Semantics**
   - `translation_id` serves as stable anchor for all version-dependent data
   - Single cascade operation removes translation + images + feedback atomically
   - No orphaned data possible with proper cascade implementation

2. **Referential Integrity**
   - Explicit foreign key relationships prevent data inconsistencies
   - Application-enforced constraints catch integrity violations
   - Computed fields (latest_version) stay synchronized with actual data

3. **Span-Based Feedback Precision**
   - Character-level spans tied to specific translation text
   - Version deletion automatically removes associated feedback
   - No ambiguity about which version feedback applies to

4. **Complete Generation Context**
   - Settings signature enables deduplication and analytics
   - Full metadata trail for debugging generation issues
   - Performance tracking (cost, timing) per version

### Cascade Delete Strategy

```typescript
// Cascade delete implementation
export class CascadeService {
  async deleteTranslation(translationId: string, tx: Tx): Promise<void> {
    // 1. Collect cascade targets before deletion
    const images = await imagesService.listByTranslationId(translationId, tx);
    const feedback = await feedbackService.listByTranslationId(translationId, tx);
    
    // 2. Delete dependents first (leaf nodes)
    for (const image of images) {
      await imagesService.delete(image.image_id, tx);
    }
    
    for (const fb of feedback) {
      await feedbackService.delete(fb.feedback_id, tx);
    }
    
    // 3. Delete the translation (anchor node)
    await translationsService.delete(translationId, tx);
    
    // 4. Update chapter metadata (parent node)
    await this.recomputeChapterMetadata(translation.chapter_id, tx);
  }
  
  async deleteChapter(chapterId: string, tx: Tx): Promise<void> {
    // 1. Cascade delete all translations (and their dependents)
    const translations = await translationsService.listByChapter(chapterId, tx);
    for (const translation of translations) {
      await this.deleteTranslation(translation.translation_id, tx);
    }
    
    // 2. Delete the chapter
    await chaptersService.delete(chapterId, tx);
  }
  
  private async recomputeChapterMetadata(chapterId: string, tx: Tx): Promise<void> {
    const translations = await translationsService.listByChapter(chapterId, tx);
    const chapter = await chaptersService.get(chapterId, tx);
    
    if (translations.length === 0) {
      // No versions left
      chapter.latest_version = null;
      chapter.active_language_map = {};
    } else {
      // Recompute from remaining translations
      chapter.latest_version = Math.max(...translations.map(t => t.version_no));
      
      // Rebuild active language map, preferring highest version per language
      chapter.active_language_map = {};
      for (const translation of translations) {
        const currentActive = chapter.active_language_map[translation.language];
        if (!currentActive || translation.version_no > currentActive) {
          chapter.active_language_map[translation.language] = translation.version_no;
        }
      }
    }
    
    await chaptersService.put(chapter, tx);
  }
}
```

### Settings Signature for Deduplication

```typescript
// Generate deterministic hash of all generation settings
export function generateSettingsSignature(settings: TranslationSettings): string {
  const normalized = {
    provider: settings.provider,
    model: settings.model,
    temperature: settings.temperature,
    top_p: settings.top_p,
    frequency_penalty: settings.frequency_penalty,
    presence_penalty: settings.presence_penalty,
    max_tokens: settings.max_tokens,
    schema_enforced: settings.schema_enforced,
    system_prompt_title: settings.activePromptTemplate?.title || 'default',
    // Exclude non-deterministic fields like timestamp, cost
  };
  
  // Sort keys for deterministic hashing
  const sortedJson = JSON.stringify(normalized, Object.keys(normalized).sort());
  return sha256(sortedJson).substring(0, 16); // 16-char hex
}

// Deduplication service
export class DeduplicationService {
  async findExistingTranslation(
    chapterId: string, 
    language: string, 
    settingsSignature: string
  ): Promise<Translation | null> {
    const candidates = await translationsService.listByChapter(chapterId);
    return candidates.find(t => 
      t.language === language && 
      t.meta.settings_signature === settingsSignature
    ) || null;
  }
}
```

### Integrity Validation

```typescript
// Runtime integrity checking
export class IntegrityService {
  async validateIntegrity(): Promise<IntegrityReport> {
    const violations: IntegrityViolation[] = [];
    
    // FK1: Every translations.chapter_id exists in chapters
    const orphanedTranslations = await this.findOrphanedTranslations();
    violations.push(...orphanedTranslations.map(t => ({
      type: 'FK_VIOLATION',
      entity: 'translation',
      id: t.translation_id,
      violation: `references non-existent chapter: ${t.chapter_id}`
    })));
    
    // FK2: Every feedback.translation_id exists in translations  
    const orphanedFeedback = await this.findOrphanedFeedback();
    violations.push(...orphanedFeedback.map(f => ({
      type: 'FK_VIOLATION', 
      entity: 'feedback',
      id: f.feedback_id,
      violation: `references non-existent translation: ${f.translation_id}`
    })));
    
    // UNIQ: Unique constraint on (chapter_id, language, version_no)
    const duplicateVersions = await this.findDuplicateVersions();
    violations.push(...duplicateVersions.map(d => ({
      type: 'UNIQUE_VIOLATION',
      entity: 'translation',
      violation: `duplicate version: ${d.chapter_id}/${d.language}/${d.version_no}`
    })));
    
    // LV: chapters.latest_version = max(version_no) for chapter
    const staleLatestVersions = await this.findStaleLatestVersions();
    violations.push(...staleLatestVersions.map(c => ({
      type: 'COMPUTED_FIELD_STALE',
      entity: 'chapter',
      id: c.chapter_id,
      violation: `latest_version ${c.latest_version} != actual max ${c.actualMax}`
    })));
    
    return {
      valid: violations.length === 0,
      violations,
      checkedAt: new Date().toISOString()
    };
  }
}
```

## Implementation Strategy

### Phase 1: Schema Migration (Week 1)
1. **Add New Fields**: Extend existing records with new required fields
2. **Compute Missing Data**: Generate `translation_id`, `settings_signature` for existing translations
3. **Build Indexes**: Create performance indexes for new query patterns
4. **Integrity Baseline**: Run integrity validation on migrated data

### Phase 2: Cascade Service Implementation (Week 2)  
1. **CascadeService**: Implement atomic cascade delete operations
2. **IntegrityService**: Runtime constraint validation
3. **DeduplicationService**: Settings-based duplicate detection
4. **Migration Testing**: Verify cascade behavior on test data

### Phase 3: Service Integration (Week 3)
1. **Update Domain Services**: Use new cascade operations in domain services
2. **Transaction Integration**: Embed cascade operations in atomic boundaries
3. **Metadata Synchronization**: Auto-update chapter metadata after version changes
4. **Performance Testing**: Validate index performance on realistic data sizes

### Phase 4: Integrity Enforcement (Week 4)
1. **Constraint Validation**: Add integrity checks to all write operations
2. **Background Validation**: Periodic integrity validation job
3. **Recovery Procedures**: Automated repair for detected integrity violations
4. **Monitoring Dashboard**: Admin interface for integrity status

## Data Migration Strategy

### Backward Compatibility Approach
```typescript
// Migration function for existing data
export async function migrateToVersionCentricModel(): Promise<void> {
  const allTranslations = await translationsService.getAll();
  
  for (const translation of allTranslations) {
    // Generate missing translation_id if not present
    if (!translation.translation_id) {
      translation.translation_id = `trans-${generateId()}`;
    }
    
    // Generate settings signature from existing metadata
    if (!translation.meta?.settings_signature) {
      translation.meta = {
        ...translation.meta,
        settings_signature: generateSettingsSignature(deriveSettings(translation))
      };
    }
    
    // Ensure required metadata fields
    translation.meta = {
      model: translation.meta?.model || 'unknown',
      cost: translation.meta?.cost || 0,
      gen_ms: translation.meta?.gen_ms || 0,
      createdAt: translation.meta?.createdAt || new Date().toISOString(),
      lastViewedAt: translation.meta?.lastViewedAt || new Date().toISOString(),
      ...translation.meta
    };
    
    await translationsService.put(translation);
  }
  
  // Update dependent records with translation_id references
  await migrateDependentRecords();
  
  // Rebuild chapter metadata
  await rebuildAllChapterMetadata();
  
  // Validate integrity after migration
  const report = await integrityService.validateIntegrity();
  if (!report.valid) {
    throw new Error(`Migration integrity check failed: ${report.violations.length} violations`);
  }
}
```

### Rollback Strategy
- **Schema Versioning**: Maintain schema version in metadata store
- **Reversible Migrations**: All field additions are non-breaking
- **Data Preservation**: Original data structures preserved during migration
- **Validation Gates**: Integrity checks prevent corrupted migrations from completing

## Success Metrics

### Data Integrity
- **Zero Orphaned Records**: No feedback or images without valid translation references
- **Metadata Consistency**: Chapter metadata always reflects actual translation state
- **Cascade Completeness**: Version deletion removes 100% of dependent records

### Performance  
- **Cascade Delete Speed**: <500ms for typical version (5 feedback, 3 images)
- **Integrity Validation**: <2s for full database integrity check
- **Deduplication Lookup**: <100ms to check for duplicate translation settings

### Developer Experience
- **Clear Relationships**: Explicit foreign key relationships in code and documentation
- **Predictable Cascades**: Version deletion behavior is deterministic and well-documented
- **Debugging Support**: Integrity violations provide actionable error messages

## Consequences

### Positive Outcomes
1. **Data Consistency**: Referential integrity prevents inconsistent states
2. **Predictable Deletion**: Clear cascade semantics eliminate orphaned data
3. **Performance Optimization**: Proper indexes support efficient queries
4. **Analytics Foundation**: Settings signatures enable deduplication and performance analysis

### Trade-offs
1. **Migration Complexity**: Existing data requires careful migration with integrity validation
2. **Storage Overhead**: Additional metadata and indexes increase storage requirements
3. **Write Performance**: Integrity checks add overhead to write operations
4. **Complexity**: More sophisticated data model increases implementation complexity

### Mitigation Strategies
- **Gradual Rollout**: Migrate data in small batches with validation at each step
- **Performance Monitoring**: Track impact of integrity checks on write performance
- **Background Validation**: Run expensive integrity checks asynchronously
- **Recovery Tools**: Automated repair procedures for detected integrity violations

## Follow-up Requirements

- **ADR-004**: Service Layer Architecture must support cascade operations and integrity validation
- **ADR-005**: Agent-First Code Organization should include integrity checking in development workflow
- **Performance Testing**: Validate cascade delete performance with realistic data volumes
- **Documentation**: Update API documentation with new referential integrity guarantees

## Review Schedule

- **Month 1**: Verify migration completed successfully with zero data loss
- **Month 3**: Assess impact on write performance and user experience
- **Month 6**: Evaluate effectiveness of integrity validation in preventing data corruption