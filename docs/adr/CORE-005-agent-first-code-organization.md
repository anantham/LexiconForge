# CORE-005: Agent-First Code Organization Standards

**Date:** 2025-01-13
**Status:** Proposed
**Authors:** Development Team
**Depends on:** DB-001 (Service Decomposition), CORE-004 (Service Architecture)

## Context

### AI-Assisted Development Goals (January 2025)
LexiconForge is designed for collaborative development between human developers and AI assistants (Claude Code, GitHub Copilot, Cursor). To maximize effectiveness of AI-assisted development, the codebase must be structured for:

- **Reliable AI Code Review**: AI assistants can confidently review and suggest changes
- **Safe Automated Refactoring**: AI can make structural improvements without introducing bugs
- **Context-Aware Development**: AI understands domain boundaries and business rules
- **Incremental Feature Development**: AI can add features following established patterns

### Current Codebase Challenges (January 2025)
- **Large Files**: `indexeddb.ts` (2,288 LOC) exceeds AI context windows and review capacity
- **Implicit Contracts**: Business rules and invariants not explicitly documented
- **Mixed Concerns**: Single files handle multiple responsibilities
- **Inconsistent Patterns**: No standardized approach for similar operations
- **Hidden Dependencies**: Implicit coupling makes automated changes risky

### AI Assistant Constraints
- **Context Windows**: Most AI models have ~8K-32K token limits for effective reasoning
- **Pattern Recognition**: AI works best with consistent, predictable patterns
- **Explicit Contracts**: AI needs typed interfaces and documented behaviors
- **Atomic Operations**: AI struggles with large, multi-concern changes

## Decision

**Implement Agent-First Code Organization Standards optimized for reliable AI-assisted development and maintenance.**

### Core Principles

1. **Small, Single-Purpose Files**: Maximum 200 LOC per file, 60 LOC per function
2. **Explicit Contracts**: TypeScript interfaces and Zod schemas at all boundaries
3. **Predictable Structure**: Consistent patterns for similar operations
4. **Self-Documenting Code**: Clear intent through naming and structure
5. **Invariant Documentation**: Business rules and constraints explicitly stated

## Organization Standards

### File Size Limits
```typescript
// File size enforcement in CI
const FILE_SIZE_LIMITS = {
  services: 200,      // Domain services
  components: 250,    // React components
  utils: 150,         // Utility functions
  types: 100,         // Type definitions
  tests: 300,         // Test files (can be larger)
  stories: 150        // Storybook stories
};

// Enforce in pre-commit hook
export function validateFileSize(filePath: string, content: string): ValidationResult {
  const lines = content.split('\n').length;
  const category = categorizeFile(filePath);
  const limit = FILE_SIZE_LIMITS[category];
  
  if (lines > limit) {
    return {
      valid: false,
      message: `${filePath} has ${lines} lines, exceeds ${limit} line limit for ${category}`
    };
  }
  
  return { valid: true };
}
```

### Service File Structure Template
```typescript
/**
 * SERVICE: [ServiceName]
 * PURPOSE: [Single responsibility statement]
 * DEPENDENCIES: [Explicit list of dependencies]
 * PUBLIC_API: [List of exported functions/classes]
 * INVARIANTS: [Business rules this service maintains]
 * 
 * AI_INSTRUCTIONS:
 * - Only modify functions listed in PUBLIC_API section
 * - Preserve all invariants when making changes
 * - Add tests for any new functionality
 * - Update DEPENDENCIES if adding imports
 */

// === TYPES & INTERFACES ===
export interface [ServiceName]Service {
  // Explicit contract definition
}

export interface [Entity] {
  // Domain entity type
}

// === CONSTANTS ===
const INTERNAL_CONSTANTS = {
  // Service-specific constants
} as const;

// === CORE IMPLEMENTATION ===
export const create[ServiceName]Service = (deps: Dependencies): [ServiceName]Service => ({
  // Factory function implementation
});

// === UTILITIES (INTERNAL) ===
function internalHelper(): void {
  // Internal helper functions
}

// === VALIDATION & INVARIANTS ===
export function validate[Entity](entity: [Entity]): ValidationResult {
  // Explicit validation logic
}

// === EXPORTS ===
export type { [Entity], [ServiceName]Service };
export { validate[Entity] };
```

### Component File Structure Template
```typescript
/**
 * COMPONENT: [ComponentName]
 * PURPOSE: [UI responsibility statement]
 * PROPS: [List of required and optional props]
 * STATE: [Local state management description]
 * DEPENDENCIES: [External dependencies]
 * 
 * AI_INSTRUCTIONS:
 * - Follow existing prop patterns when adding features
 * - Maintain accessibility standards (ARIA labels, keyboard nav)
 * - Update prop documentation if interface changes
 * - Add Storybook story for new variants
 */

import React from 'react';
import type { ComponentProps } from './types';

// === TYPES ===
export interface [ComponentName]Props {
  // Explicit prop interface
}

// === COMPONENT ===
export const [ComponentName]: React.FC<[ComponentName]Props> = (props) => {
  // Component implementation
  return <div>{/* JSX */}</div>;
};

// === VARIANTS (if applicable) ===
export const [ComponentName]Variant = /* variant implementations */;

// === EXPORTS ===
export type { [ComponentName]Props };
export default [ComponentName];
```

### Naming Conventions
```typescript
// File naming patterns
const FILE_NAMING = {
  services: 'camelCase.service.ts',           // userService.ts
  components: 'PascalCase.tsx',               // UserProfile.tsx
  hooks: 'camelCase.hook.ts',                 // useUserData.hook.ts
  utils: 'camelCase.util.ts',                 // validation.util.ts
  types: 'camelCase.types.ts',                // user.types.ts
  constants: 'SCREAMING_SNAKE_CASE.ts',       // API_ENDPOINTS.ts
  tests: '[filename].test.ts',                // userService.test.ts
  stories: '[ComponentName].stories.tsx'     // UserProfile.stories.tsx
};

// Function naming patterns
const FUNCTION_NAMING = {
  creators: 'create[Thing]',                  // createUserService
  validators: 'validate[Thing]',              // validateUser
  transformers: 'transform[Input]To[Output]', // transformUserToProfile
  predicates: 'is[Condition]',                // isValidUser
  getters: 'get[Thing]',                      // getUserById
  handlers: 'handle[Event]',                  // handleUserClick
  builders: 'build[Thing]',                   // buildQuery
  formatters: 'format[Input]',                // formatDate
};
```

### Directory Structure
```
services/
├── db/                           # Database layer
│   ├── core/                     # Core DB utilities
│   │   ├── connection.service.ts
│   │   ├── transaction.service.ts
│   │   └── migration.service.ts
│   ├── domain/                   # Domain-specific services
│   │   ├── chapter.service.ts
│   │   ├── translation.service.ts
│   │   └── image.service.ts
│   ├── orchestrators/            # Business logic coordination
│   │   ├── navigation.orchestrator.ts
│   │   └── translation.orchestrator.ts
│   └── index.ts                  # Clean re-exports
├── api/                          # External API services
├── validation/                   # Validation utilities
├── formatting/                   # Data formatting
└── types/                        # Shared types

components/
├── layout/                       # Layout components
├── forms/                        # Form components  
├── navigation/                   # Navigation components
├── content/                      # Content display
└── ui/                           # Basic UI primitives

utils/
├── date/                         # Date utilities
├── string/                       # String utilities
├── array/                        # Array utilities
└── validation/                   # Validation helpers

types/
├── api.types.ts                  # API interfaces
├── database.types.ts             # Database schemas
├── ui.types.ts                   # UI component types
└── business.types.ts             # Business domain types
```

### Explicit Contract Enforcement
```typescript
// Every service must export its contract
export interface ServiceContract {
  readonly name: string;
  readonly version: string;
  readonly dependencies: readonly string[];
  readonly publicMethods: readonly string[];
  readonly invariants: readonly string[];
}

// Example implementation
export const ChapterServiceContract: ServiceContract = {
  name: 'ChapterService',
  version: '1.0.0',
  dependencies: ['TransactionService', 'ValidationService'],
  publicMethods: ['get', 'put', 'delete', 'listByNovel'],
  invariants: [
    'Every chapter.novel_id must exist in novels table',
    'Chapter.index must be unique within novel',
    'Chapter.latest_version must equal max version_no or null'
  ]
} as const;

// Runtime contract validation
export function validateServiceContract(
  service: any,
  contract: ServiceContract
): ValidationResult {
  const missingMethods = contract.publicMethods.filter(
    method => typeof service[method] !== 'function'
  );
  
  if (missingMethods.length > 0) {
    return {
      valid: false,
      message: `Service ${contract.name} missing methods: ${missingMethods.join(', ')}`
    };
  }
  
  return { valid: true };
}
```

### Documentation Standards
```typescript
/**
 * AI-FRIENDLY FUNCTION DOCUMENTATION
 * 
 * @purpose One-sentence description of what this does
 * @input Describe input parameters and their constraints
 * @output Describe return value and its guarantees
 * @sideEffects List any side effects (DB writes, API calls, etc.)
 * @invariants Business rules that must hold before/after
 * @examples Provide concrete usage examples
 * @ai_notes Special instructions for AI when modifying
 */

// Example implementation
/**
 * @purpose Creates a new translation version for a chapter
 * @input chapterId: valid chapter ID, settings: translation configuration
 * @output Promise<Translation> with generated content and metadata
 * @sideEffects Writes to translations table, updates chapter.latest_version
 * @invariants Chapter must exist, version_no must be incremental
 * @examples
 *   const translation = await generateTranslation('ch-123', { language: 'en', temperature: 0.7 });
 * @ai_notes Always validate chapter exists before creating translation
 */
export async function generateTranslation(
  chapterId: string,
  settings: TranslationSettings
): Promise<Translation> {
  // Implementation with clear error paths
}
```

### Error Handling Patterns
```typescript
// Standardized error types for AI recognition
export enum ServiceErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR', 
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly type: ServiceErrorType,
    public readonly service: string,
    public readonly operation: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

// Standardized error handling wrapper
export async function withServiceErrorHandling<T>(
  service: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error; // Re-throw service errors as-is
    }
    
    // Wrap unknown errors with context
    throw new ServiceError(
      `${service}.${operation} failed: ${error.message}`,
      ServiceErrorType.UNKNOWN_ERROR,
      service,
      operation,
      { originalError: error }
    );
  }
}
```

### Testing Patterns for AI
```typescript
// Standardized test structure that AI can extend
describe('ServiceName', () => {
  // === SETUP ===
  let service: ServiceType;
  let mockDependencies: MockDependencies;
  
  beforeEach(() => {
    mockDependencies = createMockDependencies();
    service = createService(mockDependencies);
  });
  
  // === CONTRACT TESTS ===
  describe('contract compliance', () => {
    it('should implement all required methods', () => {
      expect(validateServiceContract(service, CONTRACT)).toEqual({ valid: true });
    });
  });
  
  // === HAPPY PATH TESTS ===
  describe('happy path operations', () => {
    it('should [specific behavior]', async () => {
      // Arrange
      const input = createValidInput();
      
      // Act
      const result = await service.operation(input);
      
      // Assert
      expect(result).toMatchExpected();
      expect(mockDependencies.dependency).toHaveBeenCalledWith(expectedArgs);
    });
  });
  
  // === ERROR PATH TESTS ===
  describe('error handling', () => {
    it('should throw ValidationError for invalid input', async () => {
      // Arrange
      const invalidInput = createInvalidInput();
      
      // Act & Assert
      await expect(service.operation(invalidInput))
        .rejects.toThrow(ServiceError);
    });
  });
  
  // === INVARIANT TESTS ===
  describe('invariant preservation', () => {
    it('should maintain [specific invariant]', async () => {
      // Test that business rules are preserved
    });
  });
});
```

## AI Development Guidelines

### Safe Modification Patterns
```typescript
// AI should follow these patterns when modifying code

// 1. ADDITIVE CHANGES ONLY
// ✅ Good: Add new methods or properties
export interface UserService {
  get(id: string): Promise<User>;
  // ✅ AI can safely add new methods here
  create(user: NewUser): Promise<User>;
}

// ❌ Bad: Modify existing method signatures
export interface UserService {
  get(id: string, options?: GetOptions): Promise<User>; // Breaks existing callers
}

// 2. PRESERVE INVARIANTS
// ✅ Good: Check invariants before making changes
function updateUser(user: User): Promise<void> {
  validateUserInvariants(user); // Explicit invariant check
  // ... rest of implementation
}

// 3. EXPLICIT VALIDATION
// ✅ Good: Use Zod schemas for validation
const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email()
});

// AI can safely modify by extending schema
const ExtendedCreateUserSchema = CreateUserSchema.extend({
  age: z.number().min(0).optional()
});
```

### AI Modification Boundaries
```typescript
// Files AI can modify freely (marked with AI_SAFE)
export const AI_SAFE_MODIFICATIONS = {
  // Pure functions without side effects
  utils: ['string.util.ts', 'date.util.ts', 'validation.util.ts'],
  
  // Component styling and layout
  styles: ['*.module.css', 'tailwind variants'],
  
  // Test files (encouraged to extend)
  tests: ['*.test.ts', '*.spec.ts'],
  
  // Type definitions (additive only)
  types: ['*.types.ts']
} as const;

// Files requiring human approval (marked with HUMAN_REVIEW)
export const HUMAN_REVIEW_REQUIRED = {
  // Business logic and orchestration
  orchestrators: ['*.orchestrator.ts'],
  
  // Database migrations and schema changes
  migrations: ['migrations/*.ts'],
  
  // Security-related code
  security: ['auth/**', 'validation/security/**'],
  
  // Configuration and environment
  config: ['*.config.ts', '.env*']
} as const;
```

## Implementation Strategy

### Phase 1: File Size Enforcement (Week 1)
```bash
# Add pre-commit hook for file size validation
#!/bin/bash
echo "Checking file sizes..."
node scripts/validate-file-sizes.js

# Exit if validation fails
if [ $? -ne 0 ]; then
  echo "❌ File size validation failed"
  exit 1
fi
```

### Phase 2: Service Restructuring (Week 2-3)
```typescript
// Migrate large files following the template structure
// 1. Extract services/indexeddb.ts into domain services
// 2. Apply consistent naming conventions
// 3. Add explicit contracts and documentation
// 4. Create comprehensive test suites
```

### Phase 3: Documentation & Standards (Week 4)
```typescript
// 1. Document all service contracts
// 2. Create AI development guidelines
// 3. Set up automated contract validation
// 4. Training materials for team
```

### Phase 4: Validation & Testing (Week 5)
```typescript
// 1. Validate all services follow standards
// 2. Test AI modification scenarios
// 3. Measure development velocity improvements
// 4. Refine based on feedback
```

## Success Metrics

### Code Organization Metrics
- **File Size Compliance**: 100% of files under size limits
- **Contract Coverage**: All services have explicit contracts
- **Documentation Quality**: Every public function has AI-friendly documentation
- **Naming Consistency**: 100% compliance with naming conventions

### AI Development Effectiveness
- **AI Review Accuracy**: >95% accurate code reviews by AI assistants
- **Safe Modification Rate**: >90% of AI-generated changes require no human fixes
- **Development Velocity**: 30% improvement in feature development speed
- **Bug Introduction Rate**: <5% regression rate from AI-assisted changes

### Developer Experience
- **Onboarding Time**: New developers productive in <2 days (vs current 1 week)
- **Context Switching**: <30 seconds to understand any service (vs current 5+ minutes)
- **Maintenance Burden**: 50% reduction in time spent understanding existing code

## Consequences

### Positive Outcomes
1. **Reliable AI Assistance**: AI can confidently review and modify code
2. **Faster Development**: Consistent patterns enable rapid feature development
3. **Better Testing**: Small, focused files are easier to test comprehensively
4. **Easier Maintenance**: Clear structure reduces cognitive load
5. **Knowledge Transfer**: Self-documenting code reduces dependency on individuals

### Trade-offs and Challenges
1. **Initial Migration Effort**: Significant upfront work to restructure existing code
2. **Increased File Count**: More files to navigate and maintain
3. **Rigid Standards**: May feel restrictive compared to flexible approaches
4. **Learning Curve**: Team needs to adopt new patterns and conventions

### Long-term Benefits
1. **Scalable Codebase**: Structure supports continued growth
2. **AI-Native Development**: Optimized for future AI capabilities
3. **Reduced Technical Debt**: Proactive prevention of code quality issues
4. **Enhanced Collaboration**: Clear boundaries enable parallel development

## Follow-up Requirements
- **Development Guidelines Document**: Comprehensive guide for AI-assisted development
- **Code Quality Tools**: Automated enforcement of standards
- **Training Program**: Team education on new patterns and practices
- **Monitoring Dashboard**: Track compliance and effectiveness metrics

## Review Schedule

- **Month 1**: Evaluate file size compliance and initial service extraction
- **Month 3**: Assess AI development effectiveness and developer satisfaction
- **Month 6**: Review long-term impact on development velocity and code quality
- **Month 12**: Comprehensive analysis of AI-native development benefits