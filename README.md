# LexiconForge : Let the AI customize the translation for you!

**Tired of waiting for official translations? Wish you could continue the story right after the anime or manga ends?**

LexiconForge is your gateway to the world of web novels. It is an interface that lets you translate chapters from almost any source (let me know and I can add support), in any language, to any language!

This was a passion project because of how much I love going into these worlds.

> 🎮 **Use it instantly:** [lexicon-forge.vercel.app](https://lexicon-forge.vercel.app/) is live for anyone to read and translate right now.  

> 💎 **Patreon concierge:** Subscribers get 1:1 onboarding, priority feature requests, bug fixes, and a complimentary $10 API credit to start reading. [Join here](https://www.patreon.com/posts/lexicon-forge-is-141128641?utm_medium=clipboard_copy&utm_source=copyLink&utm_campaign=postshare_creator&utm_content=join_link).

![Demo gif](media/demo_2x_24fps.gif)

[Watch full video here](https://youtu.be/KtzXbnZNLs8)

---

## ✨ Key Features: The Ultimate Reading Experience

LexiconForge is more than just a translator; it's a power tool for readers.

### **📚 Reader Feedback Loop Highlights**
1. 👍 / 👎 on any line to teach the model your taste and steadily improve every chapter.
2. 🔒 Privacy-first architecture keeps your API keys and translation history on-device.
3. 🧠 Bring your own favorite model—Gemini, Claude, DeepSeek, OpenRouter, Flux, more—all supported.
4. ❓ Use the question emoji to generate cultural footnotes and etymology explanations on demand.
5. 🎨 Summon bespoke illustrations by reacting to your favorite scene with the art emoji.
6. ✏️ Tap the edit button to surgically refine the AI's output before saving it.
7. 📖 Compare against trusted fan translations inline, toggling between AI, raw, and fan versions—use Settings to control whether fan translations are sent as reference to the AI or kept purely for comparison.
8. 📦 Export polished EPUBs for offline reading once you've curated the perfect translation.
9. 🎛️ Experiment with prompts, OST generation, img2img steering, session analytics, and more quality-of-life tools built for deep reading.

![Floating toolbar with emoji reactions](<Marketing/Features/Select any span of text to see floating toolbar of emojis to press.png>)
![Footnotes explaining translation choices](<Marketing/Features/Footnotes elaborate on why that choice of english word was used to translate, etymology, context.png>)
![Compare AI vs fan translation inline](<Marketing/Features/Insert comparison text inline for comparing AI translation with Human translation - toggle to see raw text.png>)
![Hundreds of AI models to choose from](<Marketing/Features/Hundreds of AI models to chose from.png>)
![Illustration generation example](<Marketing/Features/example illustration.png>)
![Versioned translations snapshot](<Marketing/Features/version 6 english translation of DD ch 224 by grok.png>)


### **🌐 Universal Web Novel Access**
*   📖 **Multi-Site Support:** Currently supports 8 web novel platforms:
    - **Kakuyomu** (kakuyomu.jp) - Japanese light novels
    - **Syosetu** (ncode.syosetu.com) - Japanese web novels
    - **Dxmwx** (dxmwx.org) - Chinese web novels
    - **Kanunu** (kanunu8.com, kanunu.net) - Chinese literature archive
    - **NovelCool** (novelcool.com) - Multi-language novel platform
    - **BookToki** (booktoki468.com) - Korean web novels
    - **SuttaCentral** (suttacentral.net) - Pali Buddhist suttas

*   🌐 **Intelligent CORS Proxy System:** 10+ redundant proxy servers with automatic health monitoring and failover for reliable content fetching.
*   ⚡ **Smart Preloading:** Background fetching of upcoming chapters for seamless reading (configurable 0-50 chapters ahead).
*   🔗 **Navigation Memory:** Intelligent usage of Disk and Ram to ensure the app does not slow your computer down.

### **🤖 Advanced AI Translation**
*   🔑 **Multi-Provider Support:** Use your own API keys for Gemini, Claude, DeepSeek, or OpenRouter. You control your usage and data. If you need help contact admin in the [@webnovels](https://t.me/webnovels) group to get an API key that works!
*   📊 **22+ AI Models:** Access the latest generation of AI models across all providers to find your perfect translator. Quality and style varies across models and prompt combinations.
*   🔮 **OpenAI Supported:** Use your own API key directly or access OpenAI models via OpenRouter.
*   🎛️ **Fine-Tuned Control:** Adjust temperature (creativity), context depth (0-5 previous chapters), and model-specific settings.
*   💰 **Real-Time Cost Tracking:** Obsessive focus on cost-efficiency. See exactly how much each translation costs, down to the fraction of a cent, with 2025 pricing.
*   🛑 **Cancelable Requests:** Click the red spinner to abort in‑flight translations instantly.
*   ✅ **Structure Guarantees:** Built-in validation for illustration and footnote markers keeps body text and JSON aligned.
*   🎯 **Fan Translation Control:** Toggle whether fan translations are sent to the AI as reference (Settings → General → "Include Fan Translation as Reference"). When enabled (default), the AI uses fan translations as ground truth to improve quality. When disabled, test pure translation quality with only raw text and previous chapters—fan translations remain available for side-by-side comparison.

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

If you’d like a guided setup, tailored prompts, or bespoke feature development, hop onto the [Patreon](https://www.patreon.com/posts/lexicon-forge-is-141128641?utm_medium=clipboard_copy&utm_source=copyLink&utm_campaign=postshare_creator&utm_content=join_link)—I’ll work with you directly to craft the perfect reading experience.

### For Developers: Self-Hosting
Want to run your own instance? It's easy.

1.  **Clone the repository.**
2.  **Install dependencies:** `npm install`
3.  **Add your API keys** to a new `.env.local` file:
    ```env
    VITE_GEMINI_API_KEY=your_gemini_key_here
    VITE_DEEPSEEK_API_KEY=your_deepseek_key_here
    VITE_CLAUDE_API_KEY=your_claude_key_here
    VITE_OPENROUTER_API_KEY=your_openrouter_key # Access to 100+ models including GPT-4o
    VITE_PIAPI_API_KEY=your_piapi_key_here      # For Flux models and LoRA
    VITE_OPENAI_API_KEY=your_openai_key_here   # Direct OpenAI access (or use OpenRouter)
    ```
4.  **Run the app:** `npm run dev`

#### Fan Translation Merge (Optional)
If you have reference fan translations (e.g., from human translators), you can merge them into an exported session JSON:

```bash
npm run merge-fan-translations path/to/session.json path/to/fan-translations/ [output.json]
```

**What this does:**
- Matches fan translation files by chapter number (e.g., `chapter-256.txt` → chapter 256)
- Adds them to the session as `fanTranslation` field for each chapter
- Prints merge coverage statistics (how many chapters got fan translations)

**Fan translations unlock:**
- **Side-by-side comparison:** Toggle between AI, raw, and fan versions while reading
- **AI reference mode:** When "Include Fan Translation as Reference" is enabled (Settings → General), the AI uses fan translations as ground truth to improve quality
- **Quality benchmarking:** Disable the reference mode to test how well the AI translates from raw text alone, using fan translations purely for comparison

### Technical Architecture


For detailed technical information, see the [Architecture Decision Records](./docs/adr/).

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
- Architecture Decisions (ADRs): `docs/adr/`
- Chrome Extension (BookToki scraper): `chrome_extension/README.md`

---

## 💬 Community & Support

Have a question, a feature request, or want to see what's next? The project is fully open source—hack on it with me, or just hang out with other readers.

*   **Join our Telegram Group:** Get help, suggest new site adapters, and chat with other users at [@webnovels](https://t.me/webnovels).
*   **Patreon concierge:** [Become a patron](https://www.patreon.com/posts/lexicon-forge-is-141128641?utm_medium=clipboard_copy&utm_source=copyLink&utm_campaign=postshare_creator&utm_content=join_link) for bespoke support, new feature prototypes, and API credits.
* You can try [readomni](https://readomni.com/) and let me know if you like it more than LexiconForge and why! 

---

## ❤️ Support the Project

LexiconForge is a passion project. If you find it useful, please consider supporting its continued development.

*   **Donate via Ethereum:** `adityaarpitha.eth`
*   **Sponsor ongoing work:** [Patreon link](https://www.patreon.com/posts/lexicon-forge-is-141128641?utm_medium=clipboard_copy&utm_source=copyLink&utm_campaign=postshare_creator&utm_content=join_link)

---

## 🔧 Developer Quick Links

- Contributing Guide: `CONTRIBUTING.md`
- Debugging Flags: `docs/Debugging.md`
- Prompt Configuration: `config/PROMPT_DOCUMENTATION.md`
