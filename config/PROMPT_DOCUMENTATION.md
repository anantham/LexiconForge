# LexiconForge Prompt Configuration (`prompts.json`)

This document explains the purpose and usage of each key-value pair in `prompts.json`. These prompts are the building blocks for constructing the final API calls to the various AI language models.

## Core Concepts

The system works by assembling a large, context-rich prompt and pairing it with a strict JSON response schema.
- The **System Prompt** (`systemPrompt`) acts as the AI's long-term personality and creative guide.
- **Context Prompts** (`history...`, `fanRef...`) provide the immediate context for the translation task.
- **Schema Descriptions** (`...Description`, `...Rules`) are injected into the `responseSchema` to force the AI's output into a specific, validated format.

---

## Prompt Details

### `systemPrompt`
- **Purpose**: This is the main system prompt that defines the AI's persona, the rules of interaction (Part A), and the detailed creative and stylistic guidelines for the translation (Part B). It's the foundational instruction set for the model.
- **Used In**: `services/aiService.ts` in both `translateWithGemini` and `translateWithOpenAI`. It's passed as the main `systemInstruction` or a `system` role message.
- **Notes**: Contains a potential **contradiction**. It tells the model to focus on creativity and ignore technical formatting, while other prompts (`translationHtmlRules`) impose strict technical rules.

### `translationHtmlRules`
- **Purpose**: Provides critical, strict rules about the HTML tags allowed in the final translated text. It explicitly forbids `<p>` tags and `*` symbols.
- **Used In**: `services/aiService.ts`. Injected into the `responseSchema` for both Gemini and OpenAI as the `description` for the `translation` field.
- **Notes**: Directly **contradicts** the `systemPrompt`'s instruction to let the system handle technical formatting. This is a major source of potential confusion for the model.

### `footnotesDescription`
- **Purpose**: A structural requirement explaining that any footnote marker in the text must have a corresponding object in the `footnotes` array of the JSON output.
- **Used In**: `services/aiService.ts`. Injected into the `responseSchema` as the `description` for the `footnotes` array.
- **Notes**: Contains a "buried" creative instruction: `you are HIGHLY encourages to elaborate on the implicit connections...`. This would be more effective in the main `systemPrompt`.

### `deepseekJsonSystemMessage`
- **Purpose**: A specific instruction for the DeepSeek model provider, telling it to *only* return a valid JSON object and nothing else.
- **Used In**: `services/aiService.ts` within `translateWithOpenAI` when the provider is `DeepSeek`.

### `fanRefHeader`, `fanRefBullets`, `fanRefImportant`, `fanRefEnd`
- **Purpose**: These snippets are used to wrap the fan translation text, providing context to the AI on how to use it as a reference.
- **Used In**: `services/aiService.ts` within the `buildFanTranslationContext` helper function.
- **Notes**: The `fanRefImportant` key contains a potential **contradiction** with the creative freedom encouraged in the `systemPrompt`, as it demands that the AI not miss a single word from the fan translation.

### `translatePrefix`, `translateFanSuffix`, `translateInstruction`, `translateTitleLabel`, `translateContentLabel`
- **Purpose**: These are small snippets used to assemble the final instruction for the new chapter that needs to be translated.
- **Used In**: `services/aiService.ts` within `translateWithGemini` and `translateWithOpenAI` to form the final user-facing prompt.

### `history...` (all keys starting with `history`)
- **Purpose**: These keys are used to structure the historical context from previous chapters (original text, previous translation, feedback, etc.).
- **Used In**: `services/aiService.ts` within the `formatHistory` helper function.

### `illustrationsDescription`
- **Purpose**: A structural requirement explaining that any `[ILLUSTRATION-X]` marker in the text must have a corresponding object in the `suggestedIllustrations` array.
- **Used In**: `services/aiService.ts`. Injected into the `responseSchema` as the `description` for the `suggestedIllustrations` array.

### `illustrationPlacementMarkerDescription` & `illustrationImagePromptDescription`
- **Purpose**: These provide descriptions for the `placementMarker` and `imagePrompt` fields within each illustration object in the JSON output.
- **Used In**: `services/aiService.ts`. Injected into the `items` of the `suggestedIllustrations` part of the `responseSchema`.

### `proposal...` (all keys starting with `proposal`)
- **Purpose**: These keys provide descriptions for the fields within the optional `proposal` object in the JSON output, which the AI can use to suggest improvements to the system prompt.
- **Used In**: `services/aiService.ts`. Injected into the `responseSchema` for the `proposal` object and its properties.

### `footnoteMarkerDescription` & `footnoteTextDescription`
- **Purpose**: These provide descriptions for the `marker` and `text` fields within each footnote object in the JSON output.
- **Used In**: `services/aiService.ts`. Injected into the `items` of the `footnotes` part of the `responseSchema`.
