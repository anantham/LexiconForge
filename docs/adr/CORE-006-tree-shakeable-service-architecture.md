# CORE-006: Tree-Shakeable Service Architecture with Bundle Optimization

**Date:** 2025-01-13
**Status:** Proposed
**Authors:** Development Team
**Depends on:** DB-001 (Service Decomposition), CORE-004 (Service Architecture), CORE-005 (Agent-First Organization)

## Context

### Bundle Size Requirements (January 2025)
LexiconForge targets optimal loading performance for translation workflows with specific size constraints:

- **App Shell (Critical Path)**: ≤200-250 KB gzipped for reader-only functionality
- **Feature Chunks**: ≤80-120 KB gzipped per lazy-loaded feature
- **CSS Bundle**: ≤50 KB gzipped for critical styling
- **Total Payload**: First meaningful paint within 2 seconds on 3G connections

### Current Bundle Analysis (January 2025)
```javascript
// Current bundle composition (estimated)
CURRENT_BUNDLE = {
  indexeddb: '~180 KB',         // Monolithic database service
  epub_generation: '~150 KB',   // JSZip, HTML transforms, EPUB utilities  
  image_generation: '~120 KB',  // Canvas utils, image processing, model SDKs
  ui_components: '~200 KB',     // React components and Tailwind CSS
  translation_engine: '~90 KB', // Core translation logic
  navigation: '~60 KB',         // Chapter navigation and caching
  total: '~800 KB'              // Far exceeds 200-250 KB target
};
```

### Tree Shaking Challenges
- **Barrel Exports**: `export * from './services'` prevents dead code elimination
- **Side Effects**: Auto-instantiated services and singletons block tree shaking
- **Circular Dependencies**: Prevent bundlers from optimizing imports
- **Dynamic Imports**: Not utilized for heavy features like EPUB/image generation

### User Journey Analysis
Based on usage patterns, we can prioritize loading:

1. **Critical Path (Always Needed)**: Chapter reading, basic navigation
2. **Common Features (Often Needed)**: Translation toggle, settings modal  
3. **Heavy Features (Occasionally Needed)**: EPUB export, image generation, bulk import

## Decision

**Implement Tree-Shakeable Service Architecture with aggressive bundle splitting and lazy loading for optimal performance.**

### Core Principles

1. **Pure ESM Architecture**: No CommonJS, no side effects at module level
2. **Factory Pattern**: Services created on-demand, not auto-instantiated
3. **Feature-Based Code Splitting**: Heavy features loaded asynchronously
4. **Granular Exports**: Named exports only, no barrel re-exports
5. **Bundle Size Budgets**: Automated enforcement of size limits

## Architecture Design

### Bundle Structure Strategy
```typescript
// Target bundle architecture
export const BUNDLE_ARCHITECTURE = {
  // Critical app shell (200-250 KB)
  core: {
    navigation: 'chapter reading, basic controls',
    ui_primitives: 'buttons, modals, basic components', 
    translation_display: 'text rendering, language switching',
    settings: 'user preferences, modal'
  },
  
  // Lazy-loaded feature chunks
  features: {
    epub_export: '80 KB',      // JSZip, EPUB generation
    image_generation: '120 KB', // Canvas, image models
    bulk_import: '90 KB',       // File processing, validation  
    analytics: '60 KB',         // Usage metrics, charts
    advanced_settings: '40 KB'  // Power user features
  }
} as const;
```

### Service Factory Pattern
```typescript
// Tree-shakeable service design
export interface ServiceFactory<T> {
  create(dependencies: ServiceDependencies): T;
  dependencies: readonly string[];
  size: 'critical' | 'feature';
}

// Example: ChapterDataService factory
export const ChapterServiceFactory: ServiceFactory<ChapterDataService> = {
  create: (deps: ServiceDependencies) => ({
    async get(chapterId: string, tx?: Tx): Promise<Chapter | undefined> {
      const store = tx ? tx.stores['chapters'] : 
        deps.db.transaction(['chapters'], 'readonly').objectStore('chapters');
      return await promisify(store.get(chapterId));
    },
    // ... other methods
  }),
  dependencies: ['database', 'validation'] as const,
  size: 'critical'
};

// Tree-shakeable export - bundler can eliminate unused factories
export const DATABASE_SERVICES = {
  chapters: ChapterServiceFactory,
  translations: TranslationServiceFactory,
  images: ImageServiceFactory,
  // ... other services
} as const;
```

### Lazy Loading Implementation
```typescript
// Feature loading with dynamic imports
export class FeatureLoader {
  private loadedFeatures = new Map<string, any>();
  
  async loadEpubExport(): Promise<EpubExportService> {
    if (this.loadedFeatures.has('epub')) {
      return this.loadedFeatures.get('epub');
    }
    
    // Dynamic import with Vite code splitting
    const { createEpubExportService } = await import('./features/epub/index.js');
    const service = createEpubExportService();
    
    this.loadedFeatures.set('epub', service);
    return service;
  }
  
  async loadImageGeneration(): Promise<ImageGenerationService> {
    if (this.loadedFeatures.has('imageGen')) {
      return this.loadedFeatures.get('imageGen');
    }
    
    const { createImageGenerationService } = await import('./features/image-generation/index.js');
    const service = createImageGenerationService();
    
    this.loadedFeatures.set('imageGen', service);
    return service;
  }
  
  // Preload commonly used features
  async preloadCommonFeatures(): Promise<void> {
    // Load in background after critical path
    setTimeout(async () => {
      try {
        await Promise.allSettled([
          import('./features/analytics/index.js'),
          import('./features/advanced-settings/index.js')
        ]);
      } catch (error) {
        console.warn('Failed to preload features:', error);
      }
    }, 2000); // After initial render
  }
}
```

### Bundle Splitting Configuration
```typescript
// Vite configuration for optimal splitting
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Critical services (included in main bundle)
          'database-core': [
            'services/db/core/connection.service.ts',
            'services/db/core/transaction.service.ts'
          ],
          
          // Feature chunks (lazy loaded)
          'epub-export': [
            'jszip',
            'services/features/epub/**'
          ],
          'image-generation': [
            'services/features/image-generation/**',
            'canvas-related-deps'
          ],
          'analytics': [
            'chart.js',
            'services/features/analytics/**'
          ],
          
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['@headlessui/react', '@heroicons/react']
        },
        
        // Optimize chunk loading
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId 
            ? chunkInfo.facadeModuleId.split('/').pop().replace(/\.\w+$/, '') 
            : 'chunk';
          return `${facadeModuleId}-[hash].js`;
        }
      }
    },
    
    // Bundle size limits  
    chunkSizeWarningLimit: 200, // Warn if chunk > 200 KB
    assetsDir: 'assets',
    sourcemap: false // Disable in production
  },
  
  // Bundle analyzer plugin
  plugins: [
    bundleAnalyzer({
      analyzerMode: 'static',
      openAnalyzer: false,
      reportFilename: 'bundle-report.html'
    })
  ]
});
```

### Tree-Shaking Optimization
```typescript
// Package.json optimizations
{
  "type": "module",
  "sideEffects": false, // Enable aggressive tree shaking
  "exports": {
    "./services/*": "./dist/services/*.js",
    "./components/*": "./dist/components/*.js"
  }
}

// Service exports (no barrel files)
// ❌ Bad: Barrel export prevents tree shaking
export * from './database/index.js'; 

// ✅ Good: Direct imports enable tree shaking
import { ChapterServiceFactory } from './database/chapter.service.js';
import { TranslationServiceFactory } from './database/translation.service.js';

// Conditional feature loading
export const createAppServices = (features: string[] = []) => {
  const services = {
    // Always include critical services
    chapters: ChapterServiceFactory.create(deps),
    translations: TranslationServiceFactory.create(deps)
  };
  
  // Conditionally include feature services
  if (features.includes('epub')) {
    // Dynamic import only when needed
    services.epub = () => import('./features/epub/service.js');
  }
  
  return services;
};
```

### Critical Path Optimization
```typescript
// Prioritize critical resources
export const CRITICAL_FEATURES = [
  'chapter-navigation',
  'translation-display', 
  'basic-settings'
] as const;

export const OPTIONAL_FEATURES = [
  'epub-export',
  'image-generation',
  'bulk-import',
  'advanced-analytics'
] as const;

// App initialization with progressive loading
export async function initializeApp(): Promise<AppServices> {
  // 1. Load critical services first
  const criticalServices = await loadCriticalServices();
  
  // 2. Render app shell immediately  
  renderAppShell(criticalServices);
  
  // 3. Load optional features in background
  loadOptionalFeatures();
  
  return criticalServices;
}

async function loadCriticalServices(): Promise<CoreServices> {
  // Only load what's needed for initial render
  return {
    database: await import('./services/db/core/index.js'),
    navigation: await import('./services/navigation/index.js'),
    translation: await import('./services/translation/index.js')
  };
}
```

### Bundle Size Monitoring
```typescript
// Automated bundle size monitoring
export interface BundleSizeReport {
  bundles: Array<{
    name: string;
    size: number;
    gzipSize: number;
    limit: number;
    status: 'pass' | 'warn' | 'fail';
  }>;
  totalSize: number;
  recommendations: string[];
}

export async function generateBundleReport(): Promise<BundleSizeReport> {
  const bundleStats = await analyzeBundles();
  
  return {
    bundles: bundleStats.map(bundle => ({
      ...bundle,
      status: bundle.gzipSize > bundle.limit ? 'fail' : 
               bundle.gzipSize > bundle.limit * 0.8 ? 'warn' : 'pass'
    })),
    totalSize: bundleStats.reduce((total, bundle) => total + bundle.gzipSize, 0),
    recommendations: generateOptimizationRecommendations(bundleStats)
  };
}

// CI integration
export function validateBundleSizes(report: BundleSizeReport): void {
  const failures = report.bundles.filter(b => b.status === 'fail');
  
  if (failures.length > 0) {
    console.error('❌ Bundle size limits exceeded:');
    failures.forEach(bundle => {
      console.error(`  ${bundle.name}: ${bundle.gzipSize}KB > ${bundle.limit}KB`);
    });
    process.exit(1);
  }
  
  console.log('✅ All bundles within size limits');
}
```

## Implementation Strategy

### Phase 1: Service Extraction & Factories (Week 1)
```typescript
// 1. Convert existing services to factories
export const migrateToFactories = async () => {
  // Extract each service from monolithic indexeddb.ts
  // Convert to factory pattern
  // Add tree-shaking annotations
  // Remove side effects
};

// 2. Eliminate barrel exports
export const eliminateBarrelExports = async () => {
  // Replace export * patterns
  // Create direct import paths
  // Update all consumer imports
};
```

### Phase 2: Feature Splitting (Week 2)
```typescript
// 1. Identify heavy features for lazy loading
export const HEAVY_FEATURES = {
  epub: {
    modules: ['jszip', 'epub-gen', 'html-to-epub'],
    estimatedSize: '150 KB'
  },
  imageGeneration: {
    modules: ['canvas-api', 'image-processing', 'model-sdks'],
    estimatedSize: '120 KB'  
  },
  bulkImport: {
    modules: ['file-processing', 'json-validation', 'progress-tracking'],
    estimatedSize: '90 KB'
  }
};

// 2. Implement dynamic imports
export const implementLazyLoading = async () => {
  // Create feature loader service
  // Update component calls to use dynamic imports
  // Add loading states for async features
};
```

### Phase 3: Bundle Configuration (Week 3)
```typescript
// 1. Configure Vite for optimal splitting
// 2. Set up bundle size monitoring
// 3. Add CI checks for size limits
// 4. Create bundle analysis dashboard
```

### Phase 4: Performance Validation (Week 4)
```typescript
// 1. Measure actual bundle sizes
// 2. Test loading performance on various connections
// 3. Validate tree shaking effectiveness
// 4. Optimize based on real-world metrics
```

## Bundle Size Budgets

### Critical Path Budgets (Gzipped)
```typescript
export const BUNDLE_BUDGETS = {
  // Core app shell - must stay under 250 KB
  core: {
    'app-shell': { limit: 80, critical: true },
    'database-core': { limit: 60, critical: true },
    'ui-primitives': { limit: 70, critical: true },
    'navigation': { limit: 40, critical: true },
    total: { limit: 250, critical: true }
  },
  
  // Feature chunks - lazy loaded
  features: {
    'epub-export': { limit: 120, critical: false },
    'image-generation': { limit: 150, critical: false },
    'bulk-import': { limit: 100, critical: false },
    'analytics': { limit: 80, critical: false },
    'advanced-settings': { limit: 60, critical: false }
  },
  
  // CSS budgets
  styles: {
    'critical-css': { limit: 30, critical: true },
    'component-css': { limit: 20, critical: true },
    'feature-css': { limit: 40, critical: false }
  }
} as const;
```

### Performance Targets
```typescript
export const PERFORMANCE_TARGETS = {
  // Loading performance
  firstContentfulPaint: '< 1.5s on 3G',
  largestContentfulPaint: '< 2.0s on 3G',
  timeToInteractive: '< 3.0s on 3G',
  
  // Bundle metrics
  coreBundle: '< 250 KB gzipped',
  featureChunks: '< 120 KB gzipped each',
  totalJavaScript: '< 800 KB gzipped',
  
  // Runtime performance
  chapterNavigation: '< 100ms',
  translationToggle: '< 200ms',
  featureLoading: '< 500ms from trigger'
} as const;
```

## Success Metrics

### Bundle Size Metrics
- **Core Bundle**: ≤250 KB gzipped (currently ~800 KB)
- **Feature Chunks**: Individual chunks ≤120 KB gzipped  
- **Tree Shaking Effectiveness**: >60% dead code elimination
- **Load Time**: First Contentful Paint <1.5s on 3G

### Development Experience
- **Build Time**: <30 seconds for development builds
- **Hot Reload**: <2 seconds for service changes
- **Feature Development**: Add new features without affecting core bundle
- **CI Validation**: Automated bundle size checks prevent regressions

### User Experience
- **Initial Load**: Reader-ready within 2 seconds
- **Feature Loading**: Smooth transitions with loading states
- **Offline Support**: Critical features work without network
- **Progressive Enhancement**: Advanced features enhance without blocking

## Rationale

### Why Tree Shaking is Critical
1. **Performance**: Reduces initial load time for better user experience
2. **Maintenance**: Forces modular architecture with clear dependencies  
3. **Scalability**: New features don't bloat core bundle
4. **Development**: Faster builds and hot reloading

### Why Factory Pattern Over Singletons
1. **Tree Shaking**: Unused services completely eliminated from bundle
2. **Testing**: Easy to mock dependencies and isolate tests
3. **Flexibility**: Services can be configured differently per context
4. **Memory**: Services created only when needed

### Bundle Splitting Strategy
1. **Critical Path**: Only load what's needed for core functionality
2. **User Behavior**: Heavy features used by <30% of users
3. **Network Conditions**: Optimize for slower connections
4. **Caching**: Feature chunks cached separately for better updates

## Consequences

### Positive Outcomes
1. **Faster Loading**: 70% reduction in initial bundle size
2. **Better Caching**: Feature chunks update independently  
3. **Scalable Architecture**: New features don't affect core performance
4. **Improved Development**: Faster builds and clearer dependencies
5. **Better User Experience**: Progressive loading with immediate feedback

### Trade-offs and Challenges
1. **Complexity**: More sophisticated build configuration required
2. **Loading States**: Need to handle async feature loading in UI
3. **Bundle Management**: More chunks to monitor and optimize
4. **Development Overhead**: Factory pattern adds boilerplate

### Risk Mitigation
1. **Fallback Strategy**: Core features always available even if features fail to load
2. **Progressive Enhancement**: App remains functional without optional features
3. **Monitoring**: Comprehensive bundle size and performance monitoring
4. **Rollback Plan**: Can revert to synchronous loading if issues arise

## Follow-up Requirements
- **Performance Monitoring**: Real-time bundle size and loading metrics
- **Developer Tools**: Bundle analysis and optimization tooling  
- **Documentation**: Guide for adding new features without bundle bloat
- **Testing Strategy**: Validate tree shaking and lazy loading in CI

## Review Schedule

- **Month 1**: Evaluate bundle size reduction and loading performance improvements
- **Month 3**: Assess development experience and feature loading effectiveness  
- **Month 6**: Review scalability and long-term maintainability of architecture
- **Month 12**: Comprehensive analysis of performance gains and user experience impact