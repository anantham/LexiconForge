import type { AppSettings, ImagePlan } from '../types';
import { generateIllustrationFromSelection } from './imagePlanPlanner';

const log = (message: string, ...args: any[]) => console.log(`[IllustrationService] ${message}`, ...args);

export class IllustrationService {
  static async generateIllustrationForSelection(
    selection: string,
    context: string,
    settings: AppSettings
  ): Promise<{ imagePrompt: string; imagePlan: ImagePlan } | null> {
    log('Generating structured illustration payload for selection.', {
      provider: settings.provider,
      model: settings.model,
      selectionLength: selection.length,
      contextLength: context.length,
    });

    try {
      const planned = await generateIllustrationFromSelection(selection, context, settings);

      log('Structured illustration payload generated.', {
        source: planned.source,
        imagePrompt: planned.imagePrompt,
      });

      return {
        imagePrompt: planned.imagePrompt,
        imagePlan: planned.imagePlan,
      };
    } catch (error) {
      console.error('[IllustrationService] Failed to generate structured illustration payload:', error);
      return null;
    }
  }
}
