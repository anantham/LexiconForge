import { EpubTemplate } from '../types';

/**
 * Default template for EPUB metadata
 * This template can be customized by users to personalize their EPUB exports
 */
export const getDefaultTemplate = (): EpubTemplate => ({
  gratitudeMessage: `This translation was made possible through the remarkable capabilities of modern AI language models. We express our deep gratitude to the teams behind these technologies who have made creative translation accessible to everyone.`, 
  
  projectDescription: `This e-book was generated using LexiconForge, an open-source AI translation platform that enables high-quality, creative translations of literature. The platform supports multiple AI providers and allows for collaborative refinement of translations.`,
  
  githubUrl: 'https://github.com/anantham/LexiconForge',
  
  additionalAcknowledgments: `Special thanks to the original authors whose creative works inspire these translations, and to the open-source community that makes tools like this possible. Translation is an art that bridges cultures and languages, bringing stories to new audiences worldwide.`, 
  
  customFooter: ''
});

/**
 * Creates a customizable template - users can override any field
 */
export const createCustomTemplate = (overrides: Partial<EpubTemplate>): EpubTemplate => {
  const def = getDefaultTemplate();
  const merge = (a: any, b: any): any =>
    Object.fromEntries(Object.keys({ ...a, ...b }).map(k => {
      const av = (a as any)[k], bv = (b as any)[k];
      return [k, (av && typeof av === 'object' && bv && typeof bv === 'object') ? merge(av, bv) : (bv ?? av)];
    }));
  return merge(def, overrides ?? {});
};
