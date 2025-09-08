# LexiconForge: Your Personal AI-Powered Web Novel Translator

**Tired of waiting for official translations? Wish you could continue the story right after the anime or manga ends?**

LexiconForge is your gateway to the world of web novels. It's a powerful, AI-driven tool that lets you translate chapters from almost any source, in any language, and customize the reading experience to be *exactly* how you like it. Break down the language barriers and dive into the original stories.

![Demo gif](media/demo_2x_24fps.gif)

[Watch full video here](https://youtu.be/KtzXbnZNLs8)

---

## ✨ Key Features: The Ultimate Reading Experience

LexiconForge is more than just a translator; it's a power tool for readers.

### **🌐 Universal Web Novel Access**
*   📖 **Multi-Site Support:** Currently supports 5 major web novel platforms:
    - **Kakuyomu** (kakuyomu.jp) - Japanese light novels
    - **Syosetu** (ncode.syosetu.com) - User-generated Japanese fiction
    - **Dxmwx** (dxmwx.org) - Chinese web novels
    - **Kanunu** (kanunu8.com, kanunu.net) - Chinese literature archive
    - **NovelCool** (novelcool.com) - Multi-language novel platform
*   🌐 **Intelligent CORS Proxy System:** 10+ redundant proxy servers with automatic health monitoring and failover for reliable content fetching.
*   ⚡ **Smart Preloading:** Background fetching of upcoming chapters for seamless reading (configurable 0-50 chapters ahead).
*   🔗 **Navigation Memory:** Built-in chapter history and navigation breadcrumbs for easy browsing.

### **🤖 Advanced AI Translation**
*   🔑 **Multi-Provider Support:** Use your own API keys for Gemini, OpenAI, DeepSeek, or Claude. You control your usage and data.
*   📊 **22+ AI Models:** Access the latest generation of AI models across all providers (incl. DeepSeek V3.1 Chat/Reasoner) to find your perfect translator.
*   🎛️ **Fine-Tuned Control:** Adjust temperature (creativity), context depth (0-5 previous chapters), and model-specific settings.
*   💰 **Real-Time Cost Tracking:** Obsessive focus on cost-efficiency. See exactly how much each translation costs, down to the fraction of a cent, with 2025 pricing.
*   🛑 **Cancelable Requests:** Click the red spinner to abort in‑flight translations instantly.
*   ✅ **Structure Guarantees:** Built-in validation for illustration and footnote markers keeps body text and JSON aligned.

### **🧠 Collaborative AI Training & Interactive Features**
*   💬 **Text Selection Feedback:** Select any text and rate it 👍👎? to teach the AI your preferences.
*   ❓ **Smart Explanations:** Click the **?** emoji on selected text to generate detailed footnotes explaining translation choices, cultural context, or literary techniques.
*   🎨 **Illustration Generation:** Click the **🎨** emoji on selected passages to automatically generate contextual illustration prompts that capture key story moments.
*   ✍️ **Prompt Template Library:** Create, save, and manage custom system prompts for different novel types (Wuxia, Romance, Technical, etc.).
*   🔄 **Amendment Proposals:** AI suggests prompt improvements based on your feedback patterns.
*   📝 **Inline Annotations:** Collaborative feedback system with comments and rating history.

### **🎨 Rich Media & Export**
*   🖼️ **Advanced AI Image Generation:** Bring pivotal story moments to life with cutting-edge image generation:
  - **Multi-Model Support:** Flux models (PiAPI), Imagen 3.0/4.0, and Gemini image generation
  - **21 LoRA Style Models:** XLabs (7) and CivitAI (14) collections for artistic transformation - anime, realism, cyberpunk, art deco, and more
  - **img2img with Steering Images:** Guide generation with reference images for consistent character/scene styling
  - **Advanced Controls:** Negative prompts, guidance scale (1.5-5.0), and LoRA strength tuning (0.1-2.0)
  - **Smart Context Placement:** AI automatically places illustration markers at key story moments
  - **Collapsible Interface:** Advanced controls hidden by default for distraction-free reading
*   📚 **Professional EPUB Export:** Generate beautiful e-books with:
  - Comprehensive translation statistics and cost breakdowns
  - Provider/model usage analytics across your entire library
  - Embedded AI-generated illustrations with captions
  - Customizable acknowledgments and project descriptions
*   💾 **Complete Data Ownership:** Export/import your entire session as JSON. Your reading history, translations, feedback, and settings belong to you.

### **🎵 Audio Generation**
*   🎧 **Scene Music & Cues:** Generate background music or ambient tracks from style prompts
*   🧩 **Two Modes:** `txt2audio` (from text prompt) and `audio2audio` (style transfer)
*   🎛️ **Style Presets:** Curated prompts (Dark Cinematic, Strategist’s Gambit, etc.)
*   📈 **Cost Awareness:** Provider‑reported durations and simple cost estimates
*   🔐 **Opt‑In:** Works with your PiAPI key; entirely client‑side

### **⚡ Performance & Storage**
*   🗄️ **Dual-Tier Architecture:** Instant UI updates (Zustand) + unlimited persistent storage (IndexedDB) for the best of both worlds.
*   🔄 **Session Persistence:** Survive browser crashes and restarts. Your progress is never lost.
*   📊 **Professional Statistics:** Detailed breakdowns of token usage, costs, translation time, and model performance across your entire library.
*   🚀 **Smart Preloading:** Configurable background fetching (0-10 chapters ahead) with intelligent rate limiting and deduplication.
*   🎯 **Advanced Navigation:** Smart URL mapping, browser history integration, and cross-session chapter hydration.
*   🔧 **Developer-Friendly Debugging:** Optional console logging system to monitor translation performance and troubleshoot issues.

---

## 🚀 Getting Started

### The Easy Way: Use the Live Version
The easiest way to start is with the official hosted version on Vercel. No installation required!

**[➡️ Click here to launch LexiconForge](https://lexicon-forge.vercel.app/)**

### For Developers: Self-Hosting
Want to run your own instance? It's easy.

1.  **Clone the repository.**
2.  **Install dependencies:** `npm install`
3.  **Add your API keys** to a new `.env.local` file:
    ```env
    VITE_GEMINI_API_KEY=your_gemini_key_here
    VITE_OPENAI_API_KEY=your_openai_key_here
    VITE_DEEPSEEK_API_KEY=your_deepseek_key_here
    VITE_CLAUDE_API_KEY=your_claude_key_here
    VITE_PIAPI_API_KEY=your_piapi_key_here      # For Flux models and LoRA
    VITE_OPENROUTER_API_KEY=your_openrouter_key # Optional for additional models
    ```
4.  **Run the app:** `npm run dev`

#### Fan Translation Merge (optional)
If you have reference fan translations, you can merge them into an exported session JSON to enable Fan view and provide better context to AI:

```
npm run merge-fan-translations path/to/session.json path/to/fan-translations/ [output.json]
```
The CLI matches files by chapter number, merges them as `fanTranslation`, and prints coverage.

### Technical Architecture
LexiconForge uses a sophisticated **dual-tier data architecture**:
- **Zustand Store**: Sub-millisecond UI reactivity for active session
- **IndexedDB**: Unlimited persistent storage for chapter library and translations
- **Professional Export System**: EPUB generation with comprehensive statistics and embedded illustrations
- **Multi-Provider AI Integration**: Unified interface for 6 major AI providers with advanced illustration pipeline (Gemini, OpenAI, Claude, DeepSeek, PiAPI, OpenRouter)

Prompts & JSON schema descriptions are centralized in `config/prompts.json`, so you can quickly change the HTML rules, footnote/illustration requirements, DeepSeek JSON guard, fan-translation preface, translate preface, and history labels without touching code.

**🏗️ Architecture Evolution (2025)**: LexiconForge is currently undergoing modernization to implement agent-first development principles. See our [Architecture Decision Records](docs/) for the roadmap toward modular, maintainable services that work seamlessly with AI assistants.

For detailed technical information, see the [Project Structure & Technical Details](./docs/PROJECT_STRUCTURE.md).

---

## 📚 Documentation

- Settings Reference: `docs/Settings.md`
- Environment Variables: `docs/EnvVars.md`
- Providers & Models: `docs/Providers.md`
- Image/Illustrations: see Rich Media section above
- Audio Generation: `docs/Audio.md`
- Workers & Batch Jobs: `docs/Workers.md`
- Data Schemas (Translation/Session): `docs/Schemas.md`
- EPUB Export & Templates: `docs/EPUB.md`
- Architecture Decisions (ADRs): `docs/` and `docs/adr/`
- Chrome Extension (BookToki scraper): `chrome_extension/README.md`

---

## 💬 Community & Support

Have a question, a feature request, or want to see what's next?

*   **Join our Telegram Group:** Get help, suggest new site adapters, and chat with other users at [@webnovels](https://t.me/webnovels).

---

## ❤️ Support the Project

LexiconForge is a passion project. If you find it useful, please consider supporting its continued development.

*   **Donate via Ethereum:** `adityaarpitha.eth`

---

## 🔧 Developer Quick Links

- Contributing Guide: `CONTRIBUTING.md`
- Debugging Flags: `docs/Debugging.md`
- Prompt Configuration: `config/PROMPT_DOCUMENTATION.md`
