# LexiconForge - Collaborative Novel Translator

An AI-powered web application for reading and translating web novels with collaborative user feedback and iterative translation refinement.

## 🎯 Current Implementation Status

### ✅ **Fully Implemented Features**

**🤖 Multi-Provider AI Translation**
- Gemini API integration (primary, fully tested)
- OpenAI API support (configured, ready to use)
- DeepSeek API support (configured, ready to use)
- Automatic rate limiting and error handling
- Cost tracking with detailed usage metrics

**🔗 Universal Web Novel Scraping**
- **4 Site Adapters**: Kakuyomu, Dxmwx, Kanunu, Novelcool
- Smart proxy rotation with automatic failover
- Robust error handling and retry logic
- Chapter navigation (prev/next) extraction

**👥 Collaborative Feedback System**
- Text selection feedback (👍/👎/? + comments)
- Real-time feedback collection and persistence
- Amendment proposal system for translation rules
- Feedback-driven system prompt evolution

**📱 Real-time Translation Experience**
- Context-aware translation (uses previous chapters)
- Proactive chapter preloading (configurable count)
- Session-based caching for performance
- Synchronized text display with feedback integration

**⚙️ Advanced Configuration**
- Translation provider switching (runtime)
- Comprehensive model selection (15+ models across providers)
- Temperature control (0.0-2.0) for creativity/determinism balance
- Context depth control (0-10 previous chapters)
- Typography customization (font, size, line height)
- System prompt editing with live preview
- Preload count optimization (0-10 chapters)

**💾 Session Management**
- Complete session persistence (localStorage)
- Export/import functionality (JSON format)
- Reading history tracking
- Conflict resolution for imported sessions

**🔧 Developer Experience**
- TypeScript throughout with strict typing
- Zustand state management with persistence
- Modular component architecture
- ES modules with importmap (no bundler needed)
- Early error logging and debugging tools

### 🚧 **Architecture Highlights**

**Translation Pipeline**
1. **Fetch**: Universal adapter → structured chapter data
2. **Context**: Gather previous chapters for consistency
3. **Translate**: AI service → translation + footnotes + amendments
4. **Feedback**: User selection → collaborative refinement
5. **Iterate**: Amendment proposals → system prompt evolution

**Supported Novel Sites**
- **Kakuyomu** (kakuyomu.jp) - Japanese web novels
- **Dxmwx** (dxmwx.org) - Chinese web novels  
- **Kanunu** (kanunu8.com) - Chinese literature
- **Novelcool** (novelcool.com) - Multi-language novels

**AI Integration Details**
- **Latest Models**: GPT-5 series, Gemini 2.5 Pro, DeepSeek V3/R1
- **Context-aware**: Uses 2-10 previous chapters for consistency
- **Temperature Control**: Adjustable creativity/determinism (0.0-2.0)
- **Collaborative**: Incorporates user feedback into future translations
- **Adaptive**: System prompt evolves based on user preferences
- **Multi-metric**: Tracks tokens, cost, response time per provider
- **Current Pricing**: Real-time cost tracking with 2025 pricing

## 📋 **Roadmap & Future Enhancements**

### 🎯 **Planned Features**
- [ ] **Additional Site Adapters** (NovelUpdates, Webnovel.com)
- [ ] **Translation Memory** with terminology consistency
- [ ] **Batch Translation** for entire novels
- [ ] **Offline Mode** with IndexedDB storage
- [ ] **User Accounts** with cloud sync
- [ ] **Advanced Analytics** for translation quality metrics
- [ ] **Plugin System** for custom adapters
- [ ] **Mobile PWA** with offline reading

### 🔧 **Technical Debt**
- [ ] **Test Coverage** (unit + integration tests)
- [ ] **Performance Optimization** (virtual scrolling for long chapters)
- [ ] **Error Boundary** components for graceful failures
- [ ] **Accessibility** improvements (ARIA, keyboard navigation)
- [ ] **SEO Optimization** for translated content indexing

## 🚦 **Stability Status**

### ✅ **Production Ready Components**
- **Core Translation Pipeline**: Stable, handles errors gracefully
- **State Management**: Persistent, conflict-resistant
- **Site Adapters**: Tested across multiple novel sources
- **UI Components**: Responsive, accessible baseline
- **API Integration**: Rate-limited, cost-tracked

### ⚠️ **Known Limitations**
- **Site Coverage**: Limited to 4 adapters (easily extensible)
- **Test Coverage**: Manual testing only (automated tests planned)
- **Error Recovery**: Basic retry logic (could be more sophisticated)
- **Performance**: Client-side only (no server-side optimizations)

### 🎯 **Recommended Usage**
- **Individual Reading**: Excellent for personal novel translation
- **Research Projects**: Good for studying translation approaches
- **Development**: Solid foundation for extensions and improvements
- **Production**: Ready for single-user deployment with monitoring

## 📊 **Performance Characteristics**

- **Cold Start**: ~500ms (module loading)
- **Chapter Fetch**: 1-3s (depends on source site)
- **Translation**: 3-10s (depends on chapter length + provider)
- **Memory Usage**: ~50MB (for 50+ cached chapters)
- **Storage**: ~1MB per 100 chapters (localStorage)

## Prerequisites

- **Node.js 18+** (recommended: latest LTS)
- **API Keys** for translation services (at least one required):
  - Gemini API Key (Google AI Studio)
  - OpenAI API Key (optional)
  - DeepSeek API Key (optional)

## Quick Setup

### 1. Install Dependencies
```bash
cd LexiconForge
npm install
```

### 2. Configure API Keys
Create/edit `.env.local` file:
```bash
# Required: Get from https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# Optional additional providers
OPENAI_API_KEY=your_openai_key_here
DEEPSEEK_API_KEY=your_deepseek_key_here
```

### 3. Start Development Server
```bash
npm run dev
```

The app will be available at: **http://localhost:5173/**

## Usage

1. **Enter a web novel URL** in the input field
2. **Fetch chapter content** from supported sites
3. **Toggle translation** to see AI-generated English translation
4. **Provide feedback** by selecting text and rating/commenting
5. **Navigate chapters** using prev/next links
6. **Export/import sessions** to save your progress

## Configuration

### Translation Settings
- **Provider**: Choose between Gemini, OpenAI, or DeepSeek
- **Context Depth**: How many previous chapters to include for consistency
- **Preload Count**: Number of chapters to fetch ahead of time
- **System Prompt**: Customize translation style and instructions

### Reading Settings
- **Font**: Sans-serif or serif typography
- **Font Size**: Adjustable text size
- **Line Height**: Reading comfort customization

## Supported Sites

The app includes adapters for various web novel platforms. Add new sites by extending the adapter system in `services/adapters.ts`.

## Development

### Project Structure
```
├── components/          # React UI components
├── hooks/              # Custom React hooks
├── services/           # API and adapter services
├── store/              # Zustand state management
├── types.ts            # TypeScript type definitions
├── constants.ts        # App constants and prompts
└── index.html          # Entry point with importmap
```

### Build Commands
```bash
npm run build          # Production build
npm run preview        # Preview production build
```

## Troubleshooting

### "Failed to load the app" Error
1. **Check browser console** for specific error messages
2. **Verify API keys** are correctly set in `.env.local`
3. **Hard refresh** (Cmd+Shift+R) to clear module cache
4. **Check network tab** for failed module imports

### Translation Not Working
1. **Verify API key** for selected provider
2. **Check rate limits** - app includes automatic throttling
3. **Try different content** - some text may be blocked by safety filters

### Module Loading Issues
The app uses ES modules with importmap. If you see module resolution errors:
1. **Clear browser cache** completely
2. **Check console** for early loading errors
3. **Verify all dependencies** are properly installed

## API Key Setup

### Gemini (Google AI Studio)
1. Visit: https://aistudio.google.com/app/apikey
2. Create new API key
3. Add to `.env.local` as `GEMINI_API_KEY`

### OpenAI
1. Visit: https://platform.openai.com/api-keys
2. Create new secret key
3. Add to `.env.local` as `OPENAI_API_KEY`

### DeepSeek
1. Visit: https://platform.deepseek.com/api-keys
2. Create new API key
3. Add to `.env.local` as `DEEPSEEK_API_KEY`

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with proper TypeScript types
4. Test thoroughly with different novel sources
5. Submit pull request

## License

This project is private and proprietary.
