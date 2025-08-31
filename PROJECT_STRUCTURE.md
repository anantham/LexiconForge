# LexiconForge - Project Structure & File Roles

## 📁 **Project Architecture Overview**

LexiconForge follows a modular React architecture with TypeScript, utilizing ES modules and a component-based design for maintainability and scalability.

```
LexiconForge/
├── 🔧 Configuration & Setup
├── 📱 Core Application 
├── 🧩 Components (UI)
├── 🪝 Custom Hooks
├── 🔌 Services (AI & Scraping)
├── 🗄️ State Management
├── 📚 Documentation
└── 🏗️ Architecture Evolution (2025)
```

## 🚨 **Critical Architectural State (January 2025)**

**REFACTORING IN PROGRESS**: LexiconForge is currently undergoing architectural modernization to implement agent-first development principles per [ADR-005](docs/ADR-005-Agent-First-Code-Organization.md).

### **Immediate Blockers (Violate 200-250 LOC Limits)**
1. **services/indexeddb.ts** (2,288 lines) - Database monolith blocking AI assistance
2. **services/epubService.ts** (1,653 lines) - EPUB generation with mixed concerns
3. **services/aiService.ts** (1,324 lines) - AI routing with multiple responsibilities
4. **components/SettingsModal.tsx** (1,301 lines) - UI component exceeding maintainability threshold

### **Decomposition Status**
- ✅ **ADRs Created**: 7 comprehensive architecture decision records established
- 🏗️ **Migration Strategy**: Service decomposition patterns defined in ADR-001
- ⏳ **Implementation**: Pending completion of documentation updates
- 🎯 **Target**: All services ≤200 LOC, components ≤250 LOC per ADR-005

### **Agent-First Development Goals**
- **File Size Compliance**: 100% of files under ADR-005 limits
- **Context Window Optimization**: Enable reliable AI code review and modification
- **Service Boundaries**: Clear single-responsibility services with explicit contracts
- **Testing Isolation**: Independent service testing with mock dependencies

## 🔧 **Configuration & Setup Files**

### **package.json**
- **Role**: Dependency management and script definitions
- **Key Dependencies**: React 19, Zustand 5.0.7, Gemini/OpenAI/Claude SDKs, TypeScript, Vite, epub-gen
- **Scripts**: Development server, build, and preview commands

### **package-lock.json**
- **Role**: Locked dependency versions for reproducible builds
- **Ensures**: Consistent installations across environments

### **tsconfig.json**
- **Role**: TypeScript configuration with strict typing
- **Features**: Bundler resolution, ES2022 target, path mapping (@/*), JSON module imports (resolveJsonModule)
- **Safety**: Strict type checking for production reliability

### **vite.config.ts**
- **Role**: Vite development server configuration
- **Features**: Environment variable injection, path aliases
- **Purpose**: Fast development with hot module replacement

### **.gitignore**
- **Role**: Version control exclusions
- **Protects**: node_modules, .env files, build outputs, OS files

### **metadata.json**
- **Role**: Application metadata for AI Studio deployment
- **Contains**: App name, description, permissions

## 📱 **Core Application Files**

### **index.html**
- **Role**: Application entry point with ES module importmap
- **Critical Features**:
  - Early error logging system for debugging
  - Importmap configuration (fixed Zustand version conflicts)
  - Tailwind CSS CDN integration
  - Font loading (Inter, Lora)
- **Key Fix**: Resolved module duplication issues causing "useRef null" errors

### **index.tsx**
- **Role**: React application bootstrap
- **Purpose**: Mounts App component to DOM with StrictMode

### **App.tsx**
- **Role**: Main application orchestrator and state coordinator
- **Key Features**:
  - useShallow optimization for performance
  - Proactive chapter preloading system
  - Translation pipeline orchestration (gated by language view mode)
  - Amendment proposal management
- **Architecture**: Connects all major components and manages global state

## 🧩 **Component Architecture**

### **Core Reading Interface**

#### **components/ChapterView.tsx**
- **Role**: Main reading interface with synchronized text display
- **Features**: 
  - Side-by-side original/translated text
  - Text selection for feedback
  - Typography controls integration
  - Loading states and error handling

#### **components/InputBar.tsx**
- **Role**: URL input and navigation controls
- **Features**:
  - Novel URL input with validation
  - Fetch and translate buttons
  - Language toggle (original/translated)
  - Navigation breadcrumbs

#### **components/SessionInfo.tsx**
- **Role**: Translation status and session information
- **Features**:
  - Current chapter info
  - Translation progress
  - Cost tracking display
  - Session statistics
  - Export format selection (JSON/EPUB)
  - Professional export modal interface

### **Settings & Configuration**

#### **components/SettingsModal.tsx** (1,301 lines - NEEDS DECOMPOSITION)
- **Role**: Comprehensive settings interface
- **Current State**: MONOLITHIC - Violates ADR-005's 250 LOC component limit by 5x
- **Decomposition Priority**: HIGH - Blocking component maintainability
- **Key Concerns Mixed Together**:
  - General settings tab with model/temperature controls (lines 1-350)
  - Export settings with chapter ordering and options (lines 350-650)
  - Template management with EPUB customization (lines 650-950)
  - Advanced settings with debug and API keys (lines 950-1301)
- **Planned Decomposition** (per ADR-005):
  - `components/settings/GeneralTab.tsx` (≤250 LOC)
  - `components/settings/ExportTab.tsx` (≤250 LOC)  
  - `components/settings/TemplatesTab.tsx` (≤250 LOC)
  - `components/settings/AdvancedTab.tsx` (≤250 LOC)
  - `components/SettingsModal.tsx` (≤150 LOC - tab orchestration only)

### **Feedback & Collaboration**

#### **components/FeedbackDisplay.tsx**
- **Role**: User feedback collection and management
- **Features**:
  - Feedback list with edit/delete
  - 👍/👎/? rating system
  - Comment management
  - Feedback persistence

#### **components/FeedbackPopover.tsx**
- **Role**: Text selection feedback interface
- **Features**:
  - Contextual feedback popover
  - Quick rating buttons
  - Comment input field
  - Position-aware display

#### **components/AmendmentModal.tsx**
- **Role**: Translation rule amendment proposals
- **Features**:
  - AI-suggested rule changes
  - Accept/reject workflow
  - System prompt evolution
  - Rule change reasoning

### **Advanced Image Generation System**

#### **components/Illustration.tsx**
- **Role**: Comprehensive AI-generated illustration system with advanced controls
- **Architecture**: Looks up illustrations by placement marker from chapter's translationResult
- **Key Features**:
  - Smart marker matching (`[ILLUSTRATION-1]`, `[ILLUSTRATION-2]`, etc.)
  - Base64 image rendering with error handling and retry functionality
  - Contextual captions with inline editing (pencil icon)
  - Conditional feature visibility (only shows advanced controls for Flux models)
  - State management per illustration (steering images, LoRA, negative prompts)
- **Integration**: Seamlessly embedded in parseAndRender() text processing pipeline

#### **components/AdvancedImageControls.tsx**
- **Role**: Collapsible advanced image generation parameter controls
- **Key Features**:
  - **Collapsible Interface**: Starts collapsed for distraction-free reading
  - **Negative Prompt Control**: Textarea for specifying unwanted elements
  - **Guidance Scale**: 1.5-5.0 slider balancing creativity vs prompt adherence
  - **LoRA Integration**: Embedded LoRASelector component
  - **Reset to Defaults**: One-click parameter reset functionality
  - **Model-Aware**: Only appears for Flux models that support advanced features
- **UI/UX**: Professional styling with dark mode support and animated expand/collapse

#### **components/LoRASelector.tsx**
- **Role**: LoRA (Low-Rank Adaptation) model selection and strength control
- **Architecture**: 21 hardcoded models from XLabs (7) and CivitAI (14) collections
- **Key Features**:
  - **Category Organization**: Disabled headers with indented selectable options
  - **Model Metadata**: Display names, descriptions, sources, and categories
  - **Strength Control**: 0.1-2.0 slider for fine-tuning artistic influence
  - **Collapsible Strength**: Show/hide advanced strength controls
  - **Model Information**: Links to source repositories and detailed descriptions
- **Browser Compatibility**: Uses disabled options instead of optgroups for better support

#### **components/SteeringImageDropdown.tsx**
- **Role**: img2img steering image selection for consistent character/scene styling  
- **Architecture**: Dynamic loading from `/public/steering/` directory
- **Key Features**:
  - Image preview on hover/selection
  - Base64 conversion for API transmission
  - Graceful error handling for missing images
  - "None" option for standard text2img generation
- **Integration**: Seamlessly switches between text2img and img2img modes

### **Utility Components**

#### **components/Loader.tsx**
- **Role**: Loading state indicators
- **Features**: Consistent loading animations

#### **components/icons/***
- **Role**: Complete icon system (7 icons)
- **Icons**: Pencil, Question, Refresh, Settings, ThumbsUp, ThumbsDown, Trash
- **Purpose**: UI consistency and accessibility

## 🪝 **Custom Hooks**

### **hooks/useTextSelection.ts**
- **Role**: Text selection detection for collaborative feedback
- **Features**:
  - Mouse-up event handling
  - Selection boundary detection
  - Cleanup on scroll/outside clicks
  - Performance optimization with useCallback

### **hooks/usePersistentState.ts**
- **Role**: localStorage persistence utilities
- **Features**: State synchronization with localStorage

## 🛠️ **Scripts & Utilities**

### **scripts/merge-fan-translations.ts**
- **Role**: Fan translation integration utility for enhanced AI context
- **Purpose**: Merges existing fan translations into session JSON files to provide AI models with reference material for improved translation quality
- **Key Features**:
  - **Chapter Matching**: Automatically matches fan translations to chapters by extracting numbers from filenames (e.g., `Chapter-0147-*.txt` → Chapter 147)
  - **Coverage Analysis**: Reports matching statistics and identifies chapters without fan translations
  - **JSON Enhancement**: Adds `fanTranslation` field to matching chapters in session data
  - **Quality Context**: Provides AI models with established character voices, terminology, and narrative pacing
- **Usage**: `npm run merge-fan-translations <session.json> <fan-translation-dir> [output.json]`
- **Integration**: Enhanced sessions automatically enable 3-way toggle (Original | Fan | English) in UI and pass fan translations as contextual reference to all AI providers

### **services/imageUtils.ts**
- **Role**: Image processing utilities for advanced generation features
- **Key Functions**:
  - `imageFileToBase64()`: Browser-compatible image conversion using fetch() and FileReader
  - `getSteeringImages()`: Dynamic steering image discovery from `/public/steering/` directory  
- **Browser Compatibility**: Uses HTTP fetch instead of Node.js fs for client-side image processing

### **utils/imageModelUtils.ts**  
- **Role**: Image model capability detection and feature gating
- **Key Functions**:
  - `isFluxModel()`: Detects Flux models that support advanced features (Qubico/flux*)
  - `supportsLoRA()`: LoRA model compatibility checking
  - `supportsImg2Img()`: Steering image support detection
  - `supportsNegativePrompt()`: Negative prompt capability detection
  - `supportsGuidanceScale()`: Guidance scale parameter support
- **Purpose**: Conditional UI rendering based on selected image model capabilities

### **constants/loraModels.ts**
- **Role**: Comprehensive LoRA model definitions and metadata
- **Architecture**: 21 hardcoded models from XLabs (7) and CivitAI (14) collections
- **Key Features**:
  - **Model Metadata**: Display names, descriptions, sources, categories
  - **Helper Functions**: `getLoRAModelsByCategory()`, `getLoRAModelById()`
  - **Configuration Constants**: `DEFAULT_LORA_STRENGTH`, `MIN_LORA_STRENGTH`, `MAX_LORA_STRENGTH`
- **Collections**:
  - **XLabs Collection**: anime, art, disney, furry, mjv6, realism, scenery
  - **CivitAI Collection**: collage-artstyle, creepcute, cyberpunk-anime, deco-pulse, deep-sea-particles, faetastic-details, fractal-geometry, galactixy-illustrations, geometric-woman, graphic-portrait, mat-miller-art, moebius-style, ob3d-isometric-3d-room, paper-quilling
- **Integration**: TypeScript interfaces with strong typing for model selection and validation

## 🔌 **Services Layer**

### **services/aiService.ts** (1,324 lines - NEEDS DECOMPOSITION)
- **Role**: Unified AI translation router and coordinator
- **Current State**: MONOLITHIC - Violates ADR-005's 200 LOC limit by 6x
- **Decomposition Priority**: HIGH - Critical for agent-first development
- **Key Concerns Mixed Together**:
  - Multi-provider routing and fallback logic (lines 1-300)
  - Context building and history management (lines 300-600)
  - Request/response validation and sanitization (lines 600-900)
  - Cost tracking and usage metrics (lines 900-1200)
  - Error handling and retry mechanisms (lines 1200-1324)
- **Planned Decomposition** (per ADR-005):
  - `services/ai/ProviderRouter.ts` (≤200 LOC)
  - `services/ai/ContextBuilder.ts` (≤200 LOC)
  - `services/ai/ResponseValidator.ts` (≤200 LOC)
  - `services/ai/CostTracker.ts` (≤200 LOC)
  - `services/ai/RetryHandler.ts` (≤200 LOC)
  - `services/ai/index.ts` (orchestration)

### **services/explanationService.ts** 
- **Role**: "?" emoji explanation footnote generation
- **Key Features**:
  - Generates contextual explanations for selected text passages
  - Multi-provider support (OpenAI, DeepSeek, OpenRouter compatible APIs)
  - Uses centralized `config/prompts.json` explanation templates
  - Integrates with text selection feedback system
- **Functions**: `generateExplanationFootnote()` - creates detailed translation choice explanations

### **services/illustrationService.ts**
- **Role**: "🎨" emoji illustration prompt generation  
- **Key Features**:
  - Converts selected text into detailed image generation prompts
  - Context-aware scene description from surrounding chapter content
  - Multi-provider AI support for prompt enhancement
  - Integrates with advanced image generation pipeline
- **Functions**: `generateIllustrationForSelection()` - creates contextual image prompts

### **services/navigationService.ts** (520 lines)
- **Role**: Chapter navigation, URL resolution, and preloading orchestration
- **Key Features**:
  - Smart URL mapping and normalization across novel sites
  - Lazy chapter loading from IndexedDB with hydration
  - Browser history management and navigation state
  - In-flight fetch deduplication to prevent concurrent requests
  - Chapter adapter detection for supported novel sites
- **Functions**: `navigateToChapter()`, `preloadChapters()`, `hydrateChapterData()`

### **services/sessionManagementService.ts** (364 lines)
- **Role**: Session state, settings persistence, and prompt template management
- **Key Features**:
  - Settings persistence with localStorage integration
  - Prompt template CRUD operations with IndexedDB storage
  - Session clearing and initialization procedures
  - Default settings bootstrapping and migration
  - Advanced image generation defaults management
- **Functions**: `loadSettings()`, `saveSettings()`, `managePromptTemplates()`

### **services/rateLimitService.ts**
- **Role**: API rate limiting and request queuing system
- **Key Features**:
  - Provider-specific rate limit enforcement (OpenRouter per_request_limits)
  - Request queuing with backoff strategies
  - Dynamic rate limit detection from model capabilities
  - Prevents API throttling and ensures respectful usage
- **Functions**: `canMakeRequest()`, `trackRequest()`, `processQueue()`

### **services/importTransformationService.ts** (284 lines)
- **Role**: Session JSON import processing and data transformation
- **Key Features**:
  - Backward compatibility for legacy session formats
  - Chapter data normalization and validation
  - URL mapping reconstruction from imported data
  - Progressive enhancement of imported chapters
- **Functions**: `transformImportedSession()`, `validateSessionData()`

### **services/stableIdService.ts** (326 lines)  
- **Role**: Stable ID generation and URL normalization
- **Key Features**:
  - Deterministic chapter ID generation from URLs
  - Aggressive URL normalization for deduplication
  - Enhanced chapter data structure management
  - Cross-session stable identifier maintenance
- **Functions**: `generateStableId()`, `normalizeUrlAggressively()`

### **services/workerService.ts**
- **Role**: Background processing and task management
- **Key Features**:
  - Preloading orchestration without blocking UI
  - Background translation processing
  - Task queuing and priority management
- **Functions**: `scheduleBackgroundTask()`, `processTaskQueue()`

### **services/capabilityService.ts** (251 lines)
- **Role**: AI provider and model capability detection
- **Key Features**:
  - Dynamic model feature detection (temperature support, JSON mode, etc.)
  - Provider-specific capability mapping
  - Rate limit information extraction
  - Model compatibility checking for advanced features
- **Functions**: `getModelCapabilities()`, `getModelLimits()`, `supportsJsonMode()`

### **claudeService.ts**
- **Role**: Claude API integration
- **Notes**: Uses the same centralized prompts; includes local fallback validators for illustrations/footnotes

### **services/imageService.ts**
- **Role**: Comprehensive multi-provider AI image generation system with advanced controls
- **Provider Support**:
  - **PiAPI (Flux Models)**: Qubico/flux1-dev, flux1-schnell, flux1-dev-advanced with full LoRA support
  - **Google Imagen**: 3.0 and 4.0 models via Vertex AI
  - **Gemini Vision**: Native image generation capabilities
  - **OpenRouter**: Extended model access for specialized use cases
- **Advanced Features**:
  - **LoRA Integration**: 21 style models with strength control (0.1-2.0)
  - **img2img Support**: Steering images for consistent character/scene styling
  - **Negative Prompts**: Fine-grained control over unwanted elements
  - **Guidance Scale**: Creativity vs prompt adherence balance (1.5-5.0)
  - **Intelligent Fallback**: Automatic provider switching on failures
  - **Cost Tracking**: Real-time pricing across all providers
- **Core Functions**:
  - `generateImage()`: Multi-provider image generation with conditional parameters
  - `calculateImageCost()`: Provider-specific cost calculation
  - `validateAndFixIllustrations()`: Smart validation system with 5 auto-recovery strategies
  - `dlog()` / `dlogFull()`: Debug utilities gated behind LF_AI_DEBUG flags
- **Key Features**:
  - **Multi-Model Support**: Gemini Flash, Imagen 3, Imagen 4 (Standard/Ultra)
  - **Schema Enforcement**: Validates `suggestedIllustrations` array structure
  - **Marker System**: Automatic `[ILLUSTRATION-1]`, `[ILLUSTRATION-2]` placement validation
  - **5 Recovery Strategies**: Missing illustrations, marker mismatches, invalid schemas, API failures
  - **Base64 Processing**: Converts API responses to browser-compatible data URLs
  - **Cost Tracking**: Real-time image generation cost calculation

### **Centralized Prompts**
- **config/prompts.json**
- **Role**: Single source for natural-language schema descriptions and prompt prefaces
- **Used by**: aiService.ts and claudeService.ts for schemas, fan reference, history, and translate instructions

### **services/adapters.ts**
- **Role**: Universal web novel scraping system
- **Supported Sites**:
  - **Kakuyomu** (kakuyomu.jp) - Japanese novels
  - **Dxmwx** (dxmwx.org) - Chinese novels
  - **Kanunu** (kanunu8.com) - Chinese literature
  - **Novelcool** (novelcool.com) - Multi-language
- **Features**:
  - Proxy rotation with failover
  - Content extraction and cleaning
  - Navigation link detection
  - Error handling and retry logic

### **services/epubService.ts** (1,653 lines - NEEDS DECOMPOSITION)
- **Role**: Professional EPUB generation with comprehensive statistics
- **Current State**: MONOLITHIC - Violates ADR-005's 200 LOC limit by 8x
- **Decomposition Priority**: HIGH - Blocking agent-friendly development
- **Key Concerns Mixed Together**:
  - XHTML/XML sanitization and conversion utilities (lines 1-240)
  - Data collection and statistics aggregation (lines 240-500)  
  - Template management and customization (lines 500-700)
  - Chapter content processing and conversion (lines 700-1200)
  - EPUB file generation with JSZip (lines 1200-1653)
- **Planned Decomposition** (per ADR-005):
  - `services/epub/XhtmlSanitizer.ts` (≤200 LOC)
  - `services/epub/StatsCalculator.ts` (≤200 LOC)
  - `services/epub/TemplateManager.ts` (≤200 LOC)
  - `services/epub/ContentProcessor.ts` (≤200 LOC)
  - `services/epub/EpubGenerator.ts` (≤200 LOC)
  - `services/epub/index.ts` (clean re-exports)

## 🎨 **Comprehensive Illustration System Architecture**

### **🖼️ AI-Generated Illustrations Pipeline**

LexiconForge features a sophisticated illustration system that automatically generates contextual artwork for pivotal story moments, seamlessly integrated into the translation pipeline.

#### **Core Architecture Components**

**1. Illustration Generation Flow**
```
Translation Request → AI Provider → suggestedIllustrations Array → Image Generation → Validation → Base64 Storage
```

**2. Key Technical Components**
- **services/imageService.ts**: Core image generation and validation engine
- **components/Illustration.tsx**: React component for rendering illustrations in text
- **utils/parseAndRender()**: Text parsing pipeline with illustration marker detection
- **Schema Validation**: Enforces `suggestedIllustrations` array structure across all AI providers

#### **🔧 Image Generation Process**

**Step 1: Translation Phase**
- AI providers return `suggestedIllustrations` array in their translation response
- Each suggestion contains: `marker`, `imagePrompt`, `placement` metadata
- Markers follow format: `[ILLUSTRATION-1]`, `[ILLUSTRATION-2]`, etc.

**Step 2: Validation & Recovery (`validateAndFixIllustrations`)**
The system implements 5 intelligent recovery strategies:

1. **Missing Illustrations**: Auto-generates images for markers without corresponding illustrations
2. **Marker Mismatches**: Fixes inconsistent marker numbering and placement
3. **Invalid Schema**: Repairs malformed `suggestedIllustrations` arrays  
4. **API Failures**: Implements retry logic with exponential backoff
5. **Base64 Corruption**: Validates and re-processes image data

**Step 3: Image Generation**
- **Multi-Model Support**: Gemini Flash (free tier), Imagen 3, Imagen 4 (Standard/Ultra)
- **Contextual Prompts**: Combines chapter context + specific scene description
- **Style Consistency**: Enforces consistent anime/manga art style across all images
- **Cost Optimization**: Real-time cost tracking and model selection

**Step 4: Storage & Display**
- **Base64 Encoding**: Images stored as data URLs for instant browser display
- **Persistent Storage**: Illustrations saved in IndexedDB for offline access
- **Lazy Loading**: Images render only when markers are encountered in text
- **Error Handling**: Graceful degradation when images fail to load

#### **🎯 Smart Marker System**

**Marker Placement Logic**
```typescript
// AI providers suggest strategic placement
suggestedIllustrations: [
  {
    marker: "[ILLUSTRATION-1]",
    imagePrompt: "Epic battle scene with protagonist wielding mystical sword",
    placement: "after_action_sequence"
  }
]
```

**Text Integration**
- **parseAndRender()** detects markers during text processing
- **Illustration.tsx** component looks up corresponding image by marker
- **Contextual Captions** display imagePrompt as accessible alt text
- **Responsive Design** ensures images scale properly on all devices

#### **📊 Performance & Cost Optimization**

**Caching Strategy**
- Generated images cached in IndexedDB for chapter re-reads
- Base64 data URLs enable instant display without API calls
- Smart cache invalidation when translation settings change

**Cost Management**
- **Real-time Tracking**: Each image generation cost calculated and displayed
- **Model Selection**: Users can choose between free and premium image models
- **Batch Optimization**: Multiple illustrations generated in single API calls when possible

**Debug Capabilities**
- `dlog()`: Summary logging (LF_AI_DEBUG flag)
- `dlogFull()`: Verbose logging with full API request/response (LF_AI_DEBUG_FULL flag)
- **Developer Settings**: 3-level debug system in Settings UI

#### **🔄 Integration Points**

**With Translation Pipeline**
- All 4 AI providers (Gemini, OpenAI, DeepSeek, Claude) support illustration suggestions
- Schema validation ensures consistent structure across providers
- Fallback handling when providers don't support image generation

**With UI Components**
- **ChapterView.tsx**: Renders illustrations inline with translated text
- **SessionInfo.tsx**: Displays image generation metrics and costs
- **EPUB Export**: Embeds illustrations in professional e-book output

**With Storage Systems**
- **Zustand Store**: Hot cache for active chapter illustrations
- **IndexedDB**: Persistent storage for entire illustration library
- **Dual-write Pattern**: Ensures illustrations survive browser restarts

### **🚀 Advanced Features**

#### **Contextual Intelligence**
- **Chapter Context**: Uses previous chapter summaries for consistent character/scene depiction
- **Scene Analysis**: AI identifies pivotal moments worthy of illustration
- **Style Consistency**: Maintains visual coherence across entire novel

#### **User Control**
- **Settings Integration**: Users can disable illustration generation to save costs
- **Model Selection**: Choose between free (Gemini Flash) and premium (Imagen) models
- **Quality Control**: Re-generate individual illustrations if unsatisfactory

#### **Professional Export**
- **EPUB Integration**: Illustrations embedded with proper formatting in exported e-books
- **Statistics Tracking**: Comprehensive metrics on image generation costs and performance
- **Template Customization**: User-configurable acknowledgments for AI-generated artwork

This illustration system represents a unique achievement in AI-powered reading experiences, combining technical sophistication with user-friendly controls and cost transparency.

## 🔧 **Debug System Architecture**

### **🛠️ Developer-Friendly Debugging Framework**

LexiconForge implements a comprehensive 3-tier debugging system that provides developers and power users with detailed insights into AI translation and image generation processes.

#### **Debug Level Architecture**

**Three-Tier Debug System**
- **Off**: Errors only - minimal logging for production use
- **Summary**: Request/response summaries - model details, tokens, timing, validation status
- **Full**: Complete request/response JSON - full API payloads (very verbose)

#### **Storage & Configuration**

**LocalStorage Integration**
```typescript
// New unified system (2025)
localStorage.setItem('LF_AI_DEBUG_LEVEL', 'summary|full|off');

// Legacy backward compatibility
localStorage.setItem('LF_AI_DEBUG', '1'); // Summary mode
localStorage.setItem('LF_AI_DEBUG_FULL', '1'); // Full mode
```

**Settings UI Integration**
- **components/SettingsModal.tsx**: Developer Settings section with dropdown selector
- **Backward Compatibility**: Automatically converts legacy flags to new system
- **Persistent Storage**: Debug settings survive browser restarts

#### **Debug Utility Functions**

**Core Debug Functions**
```typescript
// services/aiService.ts & imageService.ts
dlog(message: string, data?: any): void     // Summary logging
dlogFull(message: string, data?: any): void // Verbose logging
```

**Gated Logging Logic**
- **dlog()**: Only logs when `LF_AI_DEBUG` localStorage flag is set
- **dlogFull()**: Only logs when `LF_AI_DEBUG_FULL` localStorage flag is set
- **Performance**: Zero runtime cost when debugging disabled

#### **Logged Information**

**Summary Mode (`LF_AI_DEBUG`):**
- Model selection and configuration
- Temperature and context settings
- Translation request timing
- Token usage and cost estimates
- Response structure validation
- Error status and retry attempts
- HTML validation results
- Image generation requests and costs

**Full Mode (`LF_AI_DEBUG_FULL`):**
- Complete request JSON payloads
- Full response data structures
- Fallback request bodies
- Raw API responses before processing
- Detailed error stack traces
- Performance profiling data

#### **Integration Points**

**Translation Pipeline Debug**
- **services/aiService.ts**: Logs provider routing, model selection, context building
- **services/geminiService.ts**: Gemini-specific API request/response logging
- **services/openaiService.ts**: OpenAI API interaction logging
- **services/deepseekService.ts**: DeepSeek API debugging
- **services/claudeService.ts**: Claude API request/response logging

**Image Generation Debug**
- **services/imageService.ts**: Image generation requests and validation
- **Illustration Pipeline**: Marker validation, recovery strategies, Base64 processing
- **Cost Tracking**: Real-time image generation cost logging

#### **User Experience**

**Accessibility**
- **Settings Modal**: Clear 3-level dropdown with explanations
- **Documentation**: Inline help text explaining what each level logs
- **Visual Feedback**: Settings persist across browser sessions

**Performance Considerations**
- **Conditional Logging**: No performance impact when debugging disabled
- **Efficient Storage**: Uses localStorage for minimal overhead
- **Smart Defaults**: Starts in "Off" mode for new users

#### **Use Cases**

**For Developers**
- **API Debugging**: Troubleshoot AI provider integration issues
- **Performance Optimization**: Analyze request/response timing
- **Error Investigation**: Detailed error logging and stack traces
- **Feature Development**: Monitor new feature behavior

**For Power Users**
- **Translation Quality**: Understand how different models and settings affect output
- **Cost Optimization**: Track token usage and pricing across different providers
- **Troubleshooting**: Diagnose issues with specific chapters or websites

**For Support**
- **User Assistance**: Users can enable debugging to help diagnose issues
- **Bug Reports**: Developers can request debug logs for issue investigation
- **Feature Feedback**: Detailed logging helps understand user workflows

This debug system strikes an optimal balance between developer needs and user simplicity, providing comprehensive diagnostic capabilities without cluttering the main user interface.

## 🗄️ **State Management & Database Architecture**

### **Dual-Tier Data Architecture**: Zustand + IndexedDB

LexiconForge uses a **hybrid data management strategy** with two complementary storage layers:

#### **🚀 Zustand Store (Hot Cache)**
**Purpose**: Real-time UI state and session workflow management
**Location**: `store/useAppStore.ts`

**Key Responsibilities**:
- **UI State Management**: `isLoading`, `showSettingsModal`, `showEnglish`, `amendmentProposal`
- **Session Workflow**: `urlHistory`, `currentUrl`, `activeTranslations`, `urlLoadingStates`
- **Hot Data Cache**: `sessionData` - frequently accessed chapters for instant UI updates
- **Settings Management**: User preferences with localStorage persistence
- **Translation Orchestration**: Managing active translation requests and abort controllers
- **Advanced Image Controls**: Per-illustration state for LoRA models, steering images, negative prompts, guidance scales
  - `steeringImages`: Record<string, string | null> - steering image paths by chapter:marker
  - `negativePrompts`: Record<string, string> - negative prompt text by chapter:marker  
  - `guidanceScales`: Record<string, number> - guidance scale values by chapter:marker
  - `loraModels`: Record<string, string | null> - selected LoRA model by chapter:marker
  - `loraStrengths`: Record<string, number> - LoRA strength values by chapter:marker

**Performance Benefits**:
- Instant UI reactivity through Zustand subscriptions
- Zero-latency access to frequently used data
- Optimized re-renders with useShallow selectors

#### **💾 IndexedDB (Persistent Storage)**
**Purpose**: Durable cross-session data persistence
**Location**: `services/indexeddb.ts`

**Key Responsibilities**:
- **Chapter Library**: Permanent storage of fetched chapters with `storeChapter()`
- **Translation Versions**: Multiple translation attempts with `storeTranslation()`
- **Prompt Templates**: User-created system prompts with CRUD operations
- **Cross-Session Data**: Information that survives browser restarts

**Data Flow Patterns**:
```typescript
// Dual-write pattern (import functionality)
set(state => ({ sessionData: updatedData }));           // Instant UI update
await indexedDBService.storeChapter(chapterData);       // Persistent storage

// Read patterns
const chapters = useAppStore(s => s.sessionData);       // Hot cache access
const allChapters = await indexedDBService.getChapters(); // Bulk retrieval
```

#### **🔄 Data Synchronization Strategy**

**When Zustand is Primary**:
- Active session navigation and translation results
- Real-time UI state changes
- Temporary workflow data (loading states, error messages)

**When IndexedDB is Primary**:
- SessionInfo component chapter counts (reads directly from IndexedDB)
- Prompt template management (CRUD operations)
- Cross-session data persistence

**Critical Integration Points**:
1. **Import System**: Updates Zustand for immediate UI feedback, persists to IndexedDB for durability
2. **Chapter Navigation**: Reads from Zustand cache first, falls back to IndexedDB
3. **Settings**: Zustand for reactive UI, localStorage for simple persistence
4. **Prompt Templates**: IndexedDB as source of truth, Zustand for active template caching

#### **🏗️ Database Schema (IndexedDB)**

**Object Stores**:
```typescript
// chapters: Chapter storage
{
  keyPath: 'originalUrl',
  data: { title, content, originalUrl, nextUrl, prevUrl }
}

// translations: Translation versions
{
  keyPath: 'id', 
  indexes: ['chapterUrl', 'createdAt'],
  data: { translationResult, settings, usageMetrics }
}

// promptTemplates: User prompt library
{
  keyPath: 'id',
  data: { name, content, description, isDefault, createdAt }
}

// settings: App configuration
{
  keyPath: 'key',
  data: { defaultPromptTemplate, userPreferences }
}
```

#### **⚡ Performance Architecture**

**Why Both Are Essential**:
1. **Zustand**: Sub-millisecond access for active UI state
2. **IndexedDB**: Persistent storage without localStorage size limits
3. **Complementary Access Patterns**: Hot cache + durable storage
4. **Memory Efficiency**: Only active data in Zustand, bulk data in IndexedDB

**Memory Management**:
- Zustand holds ~10-50 chapters in active session
- IndexedDB stores unlimited chapter library
- Automatic cleanup of stale Zustand data on navigation

### **store/useAppStore.ts**
- **Role**: Central Zustand store with persistence
- **Key Sections**:
  - **Session Data**: Chapter cache and translation results with usage metrics
  - **Settings**: User preferences and API configurations
  - **Feedback History**: Collaborative feedback storage
  - **Loading States**: UI state management
  - **Amendment System**: Translation rule evolution
  - **Export System**: JSON and EPUB export functionality
- **Features**:
  - Persistent storage with selective partitioning
  - Dual format export (JSON/EPUB) with statistics
  - Proxy score tracking
  - Rate limiting integration
  - Usage metrics aggregation for cost transparency

## 📊 **Data & Configuration**

### **types.ts**
- **Role**: Comprehensive TypeScript type definitions
- **Key Interfaces**:
  - `AppSettings` - User configuration with temperature control
  - `TranslationResult` - AI response structure
  - `Chapter` - Novel content structure
  - `FeedbackItem` - User feedback data
  - `AmendmentProposal` - Rule change suggestions

### **constants.ts**
- **Role**: System prompts and model definitions
- **Contains**:
  - Detailed translation system prompt (75+ lines)
  - Available model configurations
  - Translation guidelines and evaluation criteria

### **costs.ts**
- **Role**: Real-time cost tracking with 2025 pricing
- **Models Supported**: 22 models across all providers
- **Pricing Data**:
  - **GPT-5**: $1.25 input / $10.00 output per 1M tokens
  - **Gemini 2.5 Pro**: $3.50 input / $10.50 output per 1M tokens
  - **DeepSeek V3**: $0.27 input / $1.10 output per 1M tokens
- **Features**: Automatic cost calculation and tracking

## 📚 **Documentation**

### **README.md**
- **Role**: Comprehensive project documentation
- **Sections**:
  - Implementation status and features
  - Setup instructions with prerequisites
  - Architecture highlights and pipeline explanation
  - Performance characteristics and limitations
  - Roadmap and future enhancements
  - Troubleshooting guide

## 🚀 **Key Architectural Decisions**

### **ES Modules + Importmap**
- **Why**: No build step needed for development
- **Benefit**: Fast startup and hot reloading
- **Challenge**: Required careful version management (solved)

### **Zustand State Management**
- **Why**: Simpler than Redux, better than Context API
- **Features**: Built-in persistence, TypeScript support
- **Pattern**: Centralized store with selective subscriptions

### **Component Composition**
- **Pattern**: Small, focused components with clear responsibilities
- **Benefits**: Maintainable, testable, reusable
- **Example**: Feedback system split into Display + Popover + Amendment

### **Service Layer Abstraction**
- **Pattern**: Unified service interfaces for different providers
- **Benefits**: Easy to add new AI providers or novel sites
- **Implementation**: Abstract base classes with concrete implementations

### **Professional Export System**
- **Pattern**: Comprehensive data aggregation with customizable templates
- **Benefits**: Transparency in AI costs and usage, professional presentation
- **Features**:
  - **Cost Tracking**: Real-time aggregation of translation costs across providers
  - **Template System**: User-customizable acknowledgments and project descriptions
  - **Statistics Dashboard**: Visual breakdown of model usage, time, and token consumption
  - **Professional EPUB**: Production-ready e-books with embedded images and styling

## 📚 **EPUB Export Feature Details**

### **What Gets Generated**
Each exported EPUB contains:
1. **Table of Contents** - Professional chapter listing with AI model metadata
2. **All Translated Chapters** - With embedded AI-generated illustrations  
3. **Translation Statistics** - Comprehensive cost and usage breakdown
4. **Acknowledgments** - Customizable gratitude section thanking AI providers

### **Customization Example**
```typescript
import { createCustomTemplate } from './services/epubService';

const myTemplate = createCustomTemplate({
  gratitudeMessage: 'Special thanks to the AI models that made this possible...',
  projectDescription: 'This translation project explores...',
  githubUrl: 'https://github.com/myusername/myproject',
  customFooter: 'Made with ❤️ in 2025'
});
```

## 🔄 **Critical Feature Flows & File Interactions**

Understanding how files work together to implement key features is essential for maintainers. Here are the most important workflows:

### **❓ Smart Explanation Generation Flow**
**User Journey**: Select text → Click ? emoji → Get detailed explanation footnote
```
ChapterView.tsx → FeedbackPopover.tsx → services/explanationService.ts → AI Provider → Display footnote
       ↓                  ↓                         ↓                        ↓           ↓
Text selection → ? emoji click → generateExplanationFootnote() → OpenAI/DeepSeek → Contextual explanation
       ↓                  ↓                         ↓                        ↓           ↓
useTextSelection → onReact('?') → Translation choice analysis → API request → Footnote rendering
```

**Key Files Involved**:
- `components/ChapterView.tsx`: Text selection and emoji interface
- `components/FeedbackPopover.tsx`: ? emoji button handling
- `services/explanationService.ts`: Explanation generation logic
- `config/prompts.json`: Explanation prompt templates
- Provider services: OpenAI/DeepSeek API integration

### **🎨 Illustration Prompt Generation Flow**
**User Journey**: Select text → Click 🎨 emoji → Generate contextual image prompt
```
ChapterView.tsx → FeedbackPopover.tsx → services/illustrationService.ts → AI Provider → Image Generation
       ↓                  ↓                         ↓                        ↓                ↓
Text selection → 🎨 emoji click → generateIllustrationForSelection() → OpenAI/DeepSeek → Flux/Imagen models
       ↓                  ↓                         ↓                        ↓                ↓
Scene context → onReact('🎨') → Enhanced prompt creation → API request → Visual illustration
```

**Key Files Involved**:
- `components/FeedbackPopover.tsx`: 🎨 emoji trigger
- `services/illustrationService.ts`: Context-aware prompt generation  
- `services/imageService.ts`: Multi-provider image generation
- `components/Illustration.tsx`: Image rendering and display
- `config/prompts.json`: Image prompt templates

### **🚀 Smart Preloading System Flow**
**User Journey**: Background fetching of upcoming chapters for seamless reading
```
App.tsx → services/navigationService.ts → services/workerService.ts → services/adapters.ts
   ↓              ↓                             ↓                           ↓
Preload trigger → preloadChapters() → scheduleBackgroundTask() → fetchAndParseUrl()
   ↓              ↓                             ↓                           ↓
Settings check → URL chain building → Task queuing → Silent scraping
```

**Key Files Involved**:
- `App.tsx`: Preload orchestration and settings monitoring
- `services/navigationService.ts`: Chapter URL chain building
- `services/workerService.ts`: Background task management
- `services/rateLimitService.ts`: API rate limiting during preload
- `services/adapters.ts`: Site-specific content extraction

### **📖 Chapter Reading Flow**
**User Journey**: Navigate to novel URL → Read translated content
```
InputBar.tsx → useAppStore.ts → services/adapters.ts → ChapterView.tsx
     ↓              ↓                    ↓                   ↓
URL input → handleNavigate() → fetchAndParseUrl() → Display content
     ↓              ↓                    ↓                   ↓
Validation → Store in sessionData → Extract title/content → Show original/translated
```

**Key Files Involved**:
- `components/InputBar.tsx`: URL validation, fetch trigger
- `store/useAppStore.ts`: Navigation state, chapter caching
- `services/adapters.ts`: Site-specific content extraction  
- `components/ChapterView.tsx`: Side-by-side text display
- `services/indexeddb.ts`: Chapter persistence

**Critical Integration**: When user navigates, `handleNavigate()` updates URL history, triggers `handleFetch()`, which calls site adapters and stores results in both Zustand sessionData and IndexedDB for persistence.

### **🤖 AI Translation Pipeline**
**User Journey**: Toggle to English → AI translates → Display with feedback
```
ChapterView.tsx → App.tsx → useAppStore.ts → services/aiService.ts → ChapterView.tsx
       ↓             ↓           ↓                   ↓                     ↓
Toggle English → Translation → handleTranslate() → Multi-provider → Display result
       ↓             ↓           ↓                   ↓                     ↓
showEnglish=true → Effect → Build context → Route to Gemini/OpenAI → Show translation
```

**Key Files Involved**:
- `components/ChapterView.tsx`: Language toggle UI
- `App.tsx`: Translation orchestration with useEffect
- `store/useAppStore.ts`: Translation state management, context building
- `services/aiService.ts`: Provider routing, cost tracking
- `services/geminiService.ts`: Gemini API integration
- `costs.ts`: Real-time cost calculation

**Critical Integration**: App.tsx monitors `showEnglish` + `currentUrl` and triggers translation only when needed. The store builds context from previous chapters, aiService routes to appropriate provider, and results are cached in both storage layers.

### **💬 Collaborative Feedback System**
**User Journey**: Select text → Rate/comment → Store feedback → Export
```
ChapterView.tsx → useTextSelection.ts → FeedbackPopover.tsx → useAppStore.ts → IndexedDB
       ↓                  ↓                      ↓                    ↓            ↓
Text selection → Track selection → Feedback UI → Store feedback → Persist data
       ↓                  ↓                      ↓                    ↓            ↓
Mouse events → getBoundingRect → 👍👎? buttons → addFeedback() → Long-term storage
```

**Key Files Involved**:
- `hooks/useTextSelection.ts`: Mouse event handling, selection detection
- `components/FeedbackPopover.tsx`: Rating UI, comment input
- `components/FeedbackDisplay.tsx`: Feedback management
- `store/useAppStore.ts`: Feedback state, dual-write to sessionData + feedbackHistory
- `services/indexeddb.ts`: Feedback persistence

**Critical Integration**: Text selection triggers popover, feedback gets stored in both Zustand (for immediate UI) and IndexedDB (for export), creating a collaborative annotation layer.

### **⚙️ Settings & Prompt Management**
**User Journey**: Open settings → Change model/prompt → Apply to translations
```
SettingsModal.tsx → useAppStore.ts → services/indexeddb.ts → App.tsx
        ↓                 ↓                    ↓               ↓
Settings UI → updateSettings() → Persist templates → Re-translate
        ↓                 ↓                    ↓               ↓
Model/prompt → localStorage → PromptTemplate CRUD → hasSettingsChanged()
```

**Key Files Involved**:
- `components/SettingsModal.tsx`: Comprehensive settings UI
- `store/useAppStore.ts`: Settings state, prompt template management
- `services/indexeddb.ts`: Prompt template persistence
- `App.tsx`: Settings change detection, re-translation logic
- `constants.ts`: Default prompts, model definitions

**Critical Integration**: Settings changes trigger localStorage persistence and prompt templates go to IndexedDB. App.tsx monitors settings fingerprint and re-translates when needed.

### **📤 Export System (JSON/EPUB)**
**User Journey**: Click export → Choose format → Generate professional output
```
SessionInfo.tsx → useAppStore.ts → services/epubService.ts → File Download
       ↓                ↓                     ↓                    ↓
Export button → exportSessionData() → collectActiveVersions() → Professional EPUB
       ↓                ↓                     ↓                    ↓
Format choice → Aggregate data → Calculate stats → Download file
```

**Key Files Involved**:
- `components/SessionInfo.tsx`: Export UI, format selection
- `store/useAppStore.ts`: Data aggregation, JSON export
- `services/epubService.ts`: Professional EPUB generation with stats
- `costs.ts`: Usage metrics aggregation
- `services/indexeddb.ts`: Bulk data retrieval

**Critical Integration**: Export system reads from both storage layers, aggregates comprehensive statistics, and generates professional outputs with cost transparency.

### **🔄 Import System**
**User Journey**: Select JSON file → Import chapters → Persist across storage layers
```
SettingsModal.tsx → FileReader → useAppStore.ts → services/indexeddb.ts
        ↓              ↓             ↓                      ↓
File input → Parse JSON → importSessionData() → storeChapter()
        ↓              ↓             ↓                      ↓
File selection → Extract data → Update Zustand → Persist IndexedDB
```

**Key Files Involved**:
- `components/SettingsModal.tsx`: File input handling
- `store/useAppStore.ts`: Dual-write import logic
- `services/indexeddb.ts`: Persistent storage
- `components/SessionInfo.tsx`: Chapter count display

**Critical Integration**: Import performs dual-write pattern - immediate Zustand update for UI feedback, then IndexedDB persistence for durability. This ensures imported chapters appear instantly and survive browser restart.

### **🚀 Preload System (Performance)**
**User Journey**: Background fetching/translation of upcoming chapters
```
App.tsx → useAppStore.ts → services/adapters.ts → services/aiService.ts
   ↓           ↓                    ↓                      ↓
Preload worker → Get next URLs → Background fetch → Background translate
   ↓           ↓                    ↓                      ↓
setTimeout → Build URL chain → Silent scraping → Cache results
```

**Key Files Involved**:
- `App.tsx`: Preload orchestration with useEffect
- `store/useAppStore.ts`: Preload settings, URL chain building
- `services/adapters.ts`: Background chapter fetching
- `services/aiService.ts`: Background translation
- `services/indexeddb.ts`: Preloaded content storage

**Critical Integration**: Preload system runs silently in background, respecting user settings (preloadCount 0-10), checking for existing translations, and stopping on API key failures.

## 🎯 **Architecture Decision Motivations**

### **Why These File Interactions Matter**

1. **Separation of Concerns**: Each file has a clear role but integrates seamlessly
2. **Performance**: Hot cache (Zustand) + persistent storage (IndexedDB) + background preloading
3. **User Experience**: Immediate feedback + professional export + collaborative features
4. **Maintainability**: Clear data flows make debugging and feature addition easier
5. **Reliability**: Dual-write patterns ensure data integrity across browser sessions

### **Database Architecture Tradeoffs**

#### **✅ Benefits of Dual Storage (Zustand + IndexedDB)**
- **Instant UI Updates**: Zustand provides sub-millisecond reactivity for active session
- **Unlimited Storage**: IndexedDB bypasses localStorage 5MB limit for large chapter libraries
- **Optimal Memory Usage**: Only active chapters in memory, bulk data on disk
- **Crash Recovery**: IndexedDB survives browser crashes and restarts
- **Complex Queries**: IndexedDB supports indexed lookups for chapter search/filtering
- **Offline Capability**: Full functionality without network after initial load

#### **⚠️ Complexity Costs**
- **Dual-Write Logic**: Must keep both storage layers synchronized
- **Multiple APIs**: Different patterns for Zustand subscriptions vs IndexedDB promises
- **Data Migration**: Schema changes require both store updates and IndexedDB migrations
- **Debug Complexity**: Issues may involve either storage layer or synchronization
- **Bundle Size**: IndexedDB service adds ~15KB to client bundle

#### **🔄 Alternative Approaches Considered**

**Option A: Zustand Only**
- ✅ Simple, single API
- ❌ Lost on browser restart, 5MB localStorage limit
- ❌ Poor performance for large datasets

**Option B: IndexedDB Only**  
- ✅ Unlimited storage, persistence
- ❌ Async-only API hurts UI responsiveness
- ❌ Complex state subscriptions, no built-in reactivity

**Option C: External DB (Supabase/Firebase)**
- ✅ Real-time sync, backup/restore
- ❌ Network dependency, privacy concerns
- ❌ API costs, vendor lock-in

**Chosen: Hybrid Zustand + IndexedDB**
- ✅ Best of both worlds: speed + persistence
- ✅ Privacy-first (all local storage)
- ✅ Zero runtime costs
- ⚠️ Manageable complexity with clear patterns

### **Common Maintenance Patterns**

- **Adding New AI Provider**: Extend `services/aiService.ts`, update `costs.ts`, add to `constants.ts`
- **Adding New Novel Site**: Create adapter in `services/adapters.ts`, update URL validation
- **New Export Format**: Extend `services/epubService.ts` with new generation logic
- **UI Enhancement**: Modify components while maintaining store contract
- **Storage Schema Changes**: Update both Zustand interface and IndexedDB migrations

This architecture provides a solid foundation for a production-ready collaborative translation platform with comprehensive export capabilities and easy maintenance.
