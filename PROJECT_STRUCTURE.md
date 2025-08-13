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
└── 📚 Documentation
```

## 🔧 **Configuration & Setup Files**

### **package.json**
- **Role**: Dependency management and script definitions
- **Key Dependencies**: React 19, Zustand 5.0.7, Gemini/OpenAI SDKs, TypeScript, Vite
- **Scripts**: Development server, build, and preview commands

### **package-lock.json**
- **Role**: Locked dependency versions for reproducible builds
- **Ensures**: Consistent installations across environments

### **tsconfig.json**
- **Role**: TypeScript configuration with strict typing
- **Features**: Bundler resolution, ES2022 target, path mapping (@/*)
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
  - Translation pipeline orchestration
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

### **Settings & Configuration**

#### **components/SettingsModal.tsx**
- **Role**: Comprehensive settings interface
- **Key Features**:
  - **Temperature Control**: 0.0-2.0 slider for AI creativity
  - **Model Selection**: 15+ models across Gemini/OpenAI/DeepSeek
  - **Context Depth**: Previous chapter context (0-5)
  - **Preload Count**: Background fetching (0-10)
  - **Typography**: Font, size, line height controls
  - **API Keys**: Secure key management for all providers
  - **Session Management**: Import/export functionality

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

#### **components/Illustration.tsx**
- **Role**: Renders AI-generated illustrations
- **Features**:
  - Handles loading and error states for images
  - Displays the final image from a base64 string
  - Connects to the global state to get image data by its marker

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

## 🔌 **Services Layer**

### **services/aiService.ts**
- **Role**: Unified AI translation router and coordinator
- **Key Features**:
  - **Multi-provider Support**: Gemini, OpenAI, DeepSeek
  - **Temperature Control**: User-adjustable creativity (0.0-2.0)
  - **Intelligent Fallback**: Handles models that don't support custom temperature
  - **Context Management**: Previous chapter integration
  - **Error Handling**: Retry logic with exponential backoff
  - **Cost Tracking**: Real-time usage and pricing

### **services/imageService.ts**
- **Role**: Handles all AI image generation requests
- **Key Features**:
  - Calls the Gemini Image API with a given text prompt
  - Configured for a high-quality, anime/manga art style
  - Processes the API response to extract a base64 image string
  - Contains robust error handling for API failures

### **services/geminiService.ts**
- **Role**: Google Gemini API integration
- **Features**:
  - Response schema validation
  - System instruction support
  - JSON mode with structured output
  - Temperature and model configuration

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

## 🗄️ **State Management**

### **store/useAppStore.ts**
- **Role**: Central Zustand store with persistence
- **Key Sections**:
  - **Session Data**: Chapter cache and translation results
  - **Settings**: User preferences and API configurations
  - **Feedback History**: Collaborative feedback storage
  - **Loading States**: UI state management
  - **Amendment System**: Translation rule evolution
- **Features**:
  - Persistent storage with selective partitioning
  - Session import/export
  - Proxy score tracking
  - Rate limiting integration

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
- **Models Supported**: 15+ models across all providers
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

This architecture provides a solid foundation for a production-ready collaborative translation platform with room for future enhancements and easy maintenance.