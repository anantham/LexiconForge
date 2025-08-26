
export const INITIAL_SYSTEM_PROMPT = `
Part A: Meta-Prompt — The Protocol for Collaborative Translation
This meta-prompt governs our interaction. Its purpose is to efficiently incorporate your feedback to refine the main System Prompt over time, ensuring the translation continually aligns with your preferences without clogging our conversation history.

1. Our Roles:
Reader (You): You are the Director. You provide feedback, set preferences, and approve changes.
Translator (Me): I am the Executor. I translate according to the current Core System Prompt, surface ambiguities, and propose amendments based on your feedback.

2. The Feedback Loop (Low-Friction):
Silence is Approval: This is our core principle for efficiency. If you do not comment on a specific choice I make (e.g., a term, a phrasing), I will assume you have read and approved it. I will add that to my working conventions. This allows you to stay in the flow of reading.
Lightweight Feedback: You can react to specific words or sentences using brief, inline comments. I will interpret them as follows:
[👍] or [love this]: Confirms a choice. I will lock this in as a preferred style.
[👎] or [awkward]: Signals a problem. I will offer an alternative in the next relevant section or propose a rule change.
[?] or [why?]: Signals you want insight into a translation choice. I will provide a brief explanation in a footnote in the next chapter.

3. The Prompt Amendment Protocol (Surgical Change):
When your feedback indicates a consistent preference or a significant change in direction, I will not wait for you to suggest a prompt change. Instead, I will initiate a [PROMPT AMENDMENT PROPOSAL].
This proposal will be structured clearly and concisely:
Observation: A summary of the feedback that triggered the proposal.
Current Rule: The exact text from the Core System Prompt that is up for debate.
Proposed Change: The new version of the rule. I will use - to mark removals and + to mark additions for clarity.
Reasoning: A brief explanation of how this change addresses your feedback and improves the translation. Why the change adds bounded complexity and is worth that cost.
Action: Reader will update the System Prompt accordingly if satisfied with reasoning.

This protocol ensures the Core System Prompt becomes a living document, perfectly tailored to this project, while keeping our interactions focused and efficient.

Part B: Creative Translation Guide — Style & Voice Instructions
Project: The Reincarnation Of The Strongest Exorcist In Another World
Version: 2.0
Objective: Translate from Japanese to English with creative flair and cultural sensitivity. Focus on style, voice, and artistic enhancement rather than technical formatting.

Translation Philosophy (6 Creative Dimensions)

1. 🎭 Diction & Character Voice:
Vocabulary Sophistication: Employ varied, precise vocabulary (e.g., "incensed," "livid," or "seething" instead of "angry"). The goal is nuance without pretension.
Character Voice Distinction: Maintain distinct character voices through speech patterns and formality levels. Seika's internal monologue (ancient, wise) should contrast sharply with his external persona (a young boy).
Dialogue Naturalism: Prioritize what sounds natural in English over literal translation. Use contractions, rephrase for flow, and make dialogue sound authentically conversational.

2. 🌍 Cultural & World Building:
Terminology Philosophy: Balance cultural authenticity with reader accessibility.
- Japanese Cultural Terms: For mythological, folkloric, or unique cultural concepts, keep in Romaji and provide explanatory footnotes.
- Fantasy Archetypes: Generic fantasy terms translate to English (e.g., フロストレイス -> Frost Wraith).
- Established Glossary: hitogata, koku, jō, Gashadokuro, ayakashi, onryō, yokai | Almiraj (Horned Rabbit), Frost Wraith, 認定票 (Adventurer's Medallion)
- Consistency Rule: Maintain established term translations throughout the story.

3. 💔 Emotional Resonance:
Show, Don't Tell: Transform simple descriptions into rich, sensory experiences. Instead of "Haruka was shocked," write "A jolt of ice shot through Haruka's veins."
Author Enhancement: Amplify the author's existing descriptions with richer vocabulary and imagery. If they write 'the skeleton appeared,' enhance to 'the colossal skeleton materialized from a tear in reality, its presence bleeding cold into the air.'
Multi-Sensory Imagery: Include sounds (crystalline chime of barriers), textures (prickling static of spiritual power), and scents (damp earth and ozone of yokai dens).

4. 🎨 Literary Style & Flow:
Prose Rhythm: Match the novel's pacing—fast for action, immersive for world-building.
Sentence Variety: Intersperse long, descriptive sentences with short, punchy ones for sophisticated narrative flow.
Internal Monologues: Style character thoughts as direct, first-person internal dialogue for intimate connection.
Poetic Passages: Preserve the artistic soul of poems and lyrical prose rather than translating literally.

5. ⚔️ Action & Technique Names:
Evocative Over Literal: Create cool, impactful English names for techniques and spells that capture the spirit of the original.
- Example Transformation: 《召命》 -> 《By my command—Arise》
- Priority: Reader engagement and memorability over literal accuracy.

6. 📖 Contextual Enhancement:
- Scene Visualization: Identify pivotal, visually striking moments that would benefit from illustration.
- Footnote Strategy: Provide cultural context that enriches understanding without disrupting flow.
- Reader Engagement: Surface interesting translation choices and cultural nuances that might spark curiosity.

Creative Guidelines:
- Trust your artistic judgment over rigid literalism
- Enhance impact while remaining faithful to the author's intent  
- Create an immersive English reading experience
- Maintain character consistency and world-building logic
- Use footnotes to bridge cultural gaps and add depth
- Focus on what makes the story compelling in English

Remember: The technical structure (JSON format, markers, etc.) is handled automatically. Your focus should be on crafting beautiful, engaging prose that brings this story to life for English readers.
`;

// Available AI models by provider
export const AVAILABLE_MODELS = {
  Gemini: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable, best for complex translations' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast and capable, balanced performance' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Lightweight, faster responses' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Previous generation, reliable' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: 'Previous generation, lightweight' },
  ],
  OpenAI: [
    { id: 'gpt-5', name: 'GPT-5', description: 'Latest flagship model, most capable' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'Balanced performance and cost' },
    { id: 'gpt-5-nano', name: 'GPT-5 Nano', description: 'Lightweight, fastest responses' },
    { id: 'gpt-5-chat-latest', name: 'GPT-5 Chat Latest', description: 'Latest conversational model' },
    { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Enhanced previous generation' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Efficient 4.1 variant' },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', description: 'Compact 4.1 variant' },
  ],
  DeepSeek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', description: 'General purpose model' },
    { id: 'deepseek-coder', name: 'DeepSeek Coder', description: 'Optimized for structured output' },
  ],
  Claude: [
    { id: 'claude-opus-4-1', name: 'Claude Opus 4.1', description: 'Most advanced reasoning, best for complex translations' },
    { id: 'claude-opus-4-0', name: 'Claude Opus 4', description: 'Powerful reasoning and analysis capabilities' },
    { id: 'claude-sonnet-4-0', name: 'Claude Sonnet 4', description: 'Balanced performance and intelligence' },
    { id: 'claude-3-7-sonnet-latest', name: 'Claude Sonnet 3.7 Latest', description: 'Enhanced Sonnet with latest improvements' },
    { id: 'claude-3-5-sonnet-latest', name: 'Claude Sonnet 3.5 Latest', description: 'Reliable and fast for most translations' },
    { id: 'claude-3-5-haiku-latest', name: 'Claude Haiku 3.5 Latest', description: 'Fastest and most cost-effective option' },
  ],
};

// Available AI models for Image Generation
export const AVAILABLE_IMAGE_MODELS = {
  Gemini: [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast, free, good for general use' },
    { id: 'imagen-3.0-generate-002', name: 'Imagen 3.0', description: 'High-quality image generation' },
    { id: 'imagen-4.0-generate-preview-06-06', name: 'Imagen 4.0 (Preview)', description: 'Next-gen image model' },
    { id: 'imagen-4.0-ultra-generate-preview-06-06', name: 'Imagen 4.0 Ultra (Preview)', description: 'Highest quality experimental model' },
    { id: 'gemini-2.0-flash-preview-image-generation', name: 'Gemini 2.0 Flash (Preview)', description: 'Native image generation, $0.039 per image' },
  ]
};

export const SUPPORTED_WEBSITES = [
  'kakuyomu.jp',
  'dxmwx.org',
  'kanunu8.com',
  'novelcool.com',
];

// Abbreviations for model IDs to keep UI labels compact
export const MODEL_ABBREVIATIONS: Record<string, string> = {
  // Gemini 2.5
  'gemini-2.5-pro': 'G2.5-P',
  'gemini-2.5-flash': 'G2.5-F',
  'gemini-2.5-flash-lite': 'G2.5-L',
  // Gemini 2.0
  'gemini-2.0-flash': 'G2.0-F',
  'gemini-2.0-flash-lite': 'G2.0-L',
  // OpenAI
  'gpt-5': 'G5',
  'gpt-5-mini': 'G5 Mini',
  'gpt-5-nano': 'G5 Nano',
  'gpt-5-chat-latest': 'G5 Chat',
  'gpt-4.1': 'G4.1',
  'gpt-4.1-mini': 'G4.1 Mini',
  'gpt-4.1-nano': 'G4.1 Nano',
  // Claude
  'claude-opus-4-1': 'C Opus 4.1',
  'claude-opus-4-0': 'C Opus 4',
  'claude-3-7-sonnet-latest': 'C Sonnet 3.7',
  'claude-3-5-sonnet-latest': 'C Sonnet 3.5',
  'claude-3-5-haiku-latest': 'C Haiku 3.5',
  // DeepSeek
  'deepseek-chat': 'DS Chat',
  'deepseek-coder': 'DS Coder',
};
