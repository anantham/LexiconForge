// PromptRegistry - Versioned, cached system prompts management

import type { PromptTemplateRecord } from '../indexeddb';

export interface PromptTemplate {
  id: string;
  name: string;
  version: number;
  systemPrompt: string;
  description?: string;
  tags?: string[];
  isDefault: boolean;
  isBuiltin: boolean;
  createdAt: number;
  updatedAt: number;
  parameters?: Record<string, any>;
}

export interface PromptVersion {
  version: number;
  template: PromptTemplate;
  createdAt: number;
  deprecated?: boolean;
  migration?: string; // Instructions for migrating from this version
}

export class PromptRegistry {
  private cache = new Map<string, PromptTemplate>();
  private versions = new Map<string, PromptVersion[]>();
  private defaultPromptId: string | null = null;

  // Built-in prompts that come with the system
  private builtinPrompts: Record<string, PromptTemplate> = {
    'default-translation': {
      id: 'default-translation',
      name: 'Default Translation',
      version: 1,
      systemPrompt: `You are an expert translator specializing in creative literature. Your task is to translate the provided text while maintaining the original style, tone, and nuances.

Guidelines:
- Preserve character personalities and dialogue styles
- Maintain cultural context where appropriate
- Keep formatting and structure intact
- Provide natural, flowing translations that read well in the target language
- Include footnotes for cultural references or wordplay that might be lost

Response format: JSON object with:
- translatedTitle: string
- translation: string
- footnotes: array of strings
- suggestedIllustrations: array of {description, placement}
- proposal: {issue, currentTranslation, suggestedImprovement, reasoning}`,
      description: 'Standard translation prompt for general literary works',
      tags: ['translation', 'literature', 'default'],
      isDefault: true,
      isBuiltin: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    
    'web-novel-translation': {
      id: 'web-novel-translation',
      name: 'Web Novel Translation',
      version: 1,
      systemPrompt: `You are a specialist in translating web novels and light novels. Focus on preserving the unique voice and style typical of web fiction.

Key considerations:
- Maintain the casual, often first-person narrative style
- Preserve Japanese/Korean cultural elements appropriately
- Handle gaming/fantasy terminology consistently
- Keep dialogue natural and character-appropriate
- Maintain chapter flow and pacing

Special attention to:
- Status screens and game-like elements
- Cultural honorifics and titles
- Fantasy/adventure terminology
- Character relationship dynamics

Response format: JSON object with:
- translatedTitle: string
- translation: string
- footnotes: array of strings
- suggestedIllustrations: array of {description, placement}
- proposal: {issue, currentTranslation, suggestedImprovement, reasoning}`,
      description: 'Specialized prompt for web novels and light novels',
      tags: ['web-novel', 'light-novel', 'fantasy', 'gaming'],
      isDefault: false,
      isBuiltin: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  };

  constructor(private repo?: any) {} // Will inject repo for persistence

  /**
   * Initialize the registry by loading prompts from storage
   */
  async initialize(): Promise<void> {
    try {
      // Load built-in prompts first
      for (const [id, template] of Object.entries(this.builtinPrompts)) {
        this.cache.set(id, template);
      }

      // Load custom prompts from database if repo is available
      if (this.repo) {
        const storedPrompts = await this.repo.getPromptTemplates();
        const defaultTemplate = await this.repo.getDefaultPromptTemplate();
        
        // Convert stored prompts to our format
        storedPrompts.forEach((stored: PromptTemplateRecord) => {
          const template: PromptTemplate = {
            id: stored.id,
            name: stored.name,
            version: stored.version || 1,
            systemPrompt: stored.systemPrompt,
            description: stored.description,
            tags: stored.tags || [],
            isDefault: defaultTemplate?.id === stored.id,
            isBuiltin: false,
            createdAt: stored.createdAt || Date.now(),
            updatedAt: stored.updatedAt || Date.now(),
            parameters: stored.parameters
          };
          
          this.cache.set(template.id, template);
        });

        if (defaultTemplate) {
          this.defaultPromptId = defaultTemplate.id;
        }
      }

      // Set default if none exists
      if (!this.defaultPromptId) {
        this.defaultPromptId = 'default-translation';
      }

    } catch (error) {
      console.error('[PromptRegistry] Failed to initialize:', error);
      // Fall back to built-in prompts only
    }
  }

  /**
   * Get a prompt template by ID
   */
  getPrompt(id: string): PromptTemplate | null {
    return this.cache.get(id) || null;
  }

  /**
   * Get the default prompt template
   */
  getDefaultPrompt(): PromptTemplate | null {
    return this.defaultPromptId ? this.getPrompt(this.defaultPromptId) : null;
  }

  /**
   * Get all available prompt templates
   */
  getAllPrompts(): PromptTemplate[] {
    return Array.from(this.cache.values()).sort((a, b) => {
      // Built-ins first, then by name
      if (a.isBuiltin !== b.isBuiltin) {
        return a.isBuiltin ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Get prompts by tags
   */
  getPromptsByTags(tags: string[]): PromptTemplate[] {
    return this.getAllPrompts().filter(prompt => 
      tags.some(tag => prompt.tags?.includes(tag))
    );
  }

  /**
   * Search prompts by name or description
   */
  searchPrompts(query: string): PromptTemplate[] {
    const lowercaseQuery = query.toLowerCase();
    return this.getAllPrompts().filter(prompt =>
      prompt.name.toLowerCase().includes(lowercaseQuery) ||
      prompt.description?.toLowerCase().includes(lowercaseQuery) ||
      prompt.tags?.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    );
  }

  /**
   * Create a new custom prompt template
   */
  async createPrompt(template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltin'>): Promise<string> {
    const id = this.generatePromptId(template.name);
    const now = Date.now();
    
    const newTemplate: PromptTemplate = {
      ...template,
      id,
      isBuiltin: false,
      createdAt: now,
      updatedAt: now,
    };

    // Store in cache
    this.cache.set(id, newTemplate);

    // Persist to database if repo is available
    if (this.repo) {
      await this.repo.storePromptTemplate({
        id,
        name: newTemplate.name,
        version: newTemplate.version,
        systemPrompt: newTemplate.systemPrompt,
        description: newTemplate.description,
        tags: newTemplate.tags,
        createdAt: now,
        updatedAt: now,
        parameters: newTemplate.parameters
      });
    }

    return id;
  }

  /**
   * Update an existing prompt template
   */
  async updatePrompt(id: string, updates: Partial<Omit<PromptTemplate, 'id' | 'isBuiltin' | 'createdAt'>>): Promise<void> {
    const existing = this.cache.get(id);
    if (!existing || existing.isBuiltin) {
      throw new Error(`Cannot update ${existing ? 'built-in' : 'non-existent'} prompt: ${id}`);
    }

    const updated: PromptTemplate = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      isBuiltin: false, // Ensure it stays custom
      updatedAt: Date.now()
    };

    // Update cache
    this.cache.set(id, updated);

    // Persist to database if repo is available
    if (this.repo) {
      await this.repo.storePromptTemplate({
        id,
        name: updated.name,
        version: updated.version,
        systemPrompt: updated.systemPrompt,
        description: updated.description,
        tags: updated.tags,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        parameters: updated.parameters
      });
    }
  }

  /**
   * Delete a custom prompt template
   */
  async deletePrompt(id: string): Promise<void> {
    const existing = this.cache.get(id);
    if (!existing) {
      return; // Already doesn't exist
    }

    if (existing.isBuiltin) {
      throw new Error(`Cannot delete built-in prompt: ${id}`);
    }

    // Remove from cache
    this.cache.delete(id);

    // If this was the default, reset to built-in default
    if (this.defaultPromptId === id) {
      this.defaultPromptId = 'default-translation';
      if (this.repo) {
        await this.repo.setDefaultPromptTemplate(this.defaultPromptId);
      }
    }

    // Note: We don't delete from database to preserve history
    // In a real implementation, you might mark as deleted instead
  }

  /**
   * Set the default prompt template
   */
  async setDefaultPrompt(id: string): Promise<void> {
    const prompt = this.cache.get(id);
    if (!prompt) {
      throw new Error(`Prompt not found: ${id}`);
    }

    // Update current default
    if (this.defaultPromptId) {
      const currentDefault = this.cache.get(this.defaultPromptId);
      if (currentDefault) {
        this.cache.set(this.defaultPromptId, {
          ...currentDefault,
          isDefault: false
        });
      }
    }

    // Set new default
    this.cache.set(id, {
      ...prompt,
      isDefault: true
    });

    this.defaultPromptId = id;

    // Persist to database if repo is available
    if (this.repo) {
      await this.repo.setDefaultPromptTemplate(id);
    }
  }

  /**
   * Clone an existing prompt template
   */
  async clonePrompt(id: string, newName: string): Promise<string> {
    const existing = this.cache.get(id);
    if (!existing) {
      throw new Error(`Prompt not found: ${id}`);
    }

    return this.createPrompt({
      name: newName,
      version: 1, // Reset version for clone
      systemPrompt: existing.systemPrompt,
      description: existing.description ? `${existing.description} (cloned)` : undefined,
      tags: existing.tags ? [...existing.tags, 'cloned'] : ['cloned'],
      isDefault: false,
      parameters: existing.parameters ? { ...existing.parameters } : undefined
    });
  }

  /**
   * Get prompt version history
   */
  getPromptVersions(id: string): PromptVersion[] {
    return this.versions.get(id) || [];
  }

  // Private helper methods
  private generatePromptId(name: string): string {
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 4);
    
    return `${slug}-${timestamp}-${random}`;
  }

  /**
   * Clear cache and reload from storage
   */
  async refresh(): Promise<void> {
    this.cache.clear();
    this.versions.clear();
    this.defaultPromptId = null;
    await this.initialize();
  }
}

// Singleton instance
export const promptRegistry = new PromptRegistry();