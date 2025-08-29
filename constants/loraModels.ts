import { getDefaultLoRAStrength, getLoRAStrengthLimits } from '../services/configService';

export interface LoRAModel {
  id: string;
  name: string;
  displayName: string;
  source: string;
  category: 'XLabs' | 'CivitAI';
  description?: string;
}

export const LORA_MODELS: LoRAModel[] = [
  // XLabs Collection
  {
    id: 'anime',
    name: 'anime',
    displayName: 'Anime Style',
    source: 'https://huggingface.co/XLabs-AI/flux-lora-collection',
    category: 'XLabs',
    description: 'Japanese anime and manga art style'
  },
  {
    id: 'art',
    name: 'art',
    displayName: 'Artistic Style',
    source: 'https://huggingface.co/XLabs-AI/flux-lora-collection',
    category: 'XLabs',
    description: 'General artistic enhancement'
  },
  {
    id: 'disney',
    name: 'disney',
    displayName: 'Disney Style',
    source: 'https://huggingface.co/XLabs-AI/flux-lora-collection',
    category: 'XLabs',
    description: 'Disney animated movie style'
  },
  {
    id: 'furry',
    name: 'furry',
    displayName: 'Furry Art',
    source: 'https://huggingface.co/XLabs-AI/flux-lora-collection',
    category: 'XLabs',
    description: 'Anthropomorphic animal characters'
  },
  {
    id: 'mjv6',
    name: 'mjv6',
    displayName: 'MidJourney v6 Style',
    source: 'https://huggingface.co/XLabs-AI/flux-lora-collection',
    category: 'XLabs',
    description: 'MidJourney v6 aesthetic'
  },
  {
    id: 'realism',
    name: 'realism',
    displayName: 'Photorealistic',
    source: 'https://huggingface.co/XLabs-AI/flux-lora-collection',
    category: 'XLabs',
    description: 'Enhanced photorealistic rendering'
  },
  {
    id: 'scenery',
    name: 'scenery',
    displayName: 'Landscape Scenery',
    source: 'https://huggingface.co/XLabs-AI/flux-lora-collection',
    category: 'XLabs',
    description: 'Beautiful landscape and scenery enhancement'
  },

  // CivitAI Collection
  {
    id: 'collage-artstyle',
    name: 'collage-artstyle',
    displayName: 'Retro Collage Art',
    source: 'https://civitai.com/models/748468/retro-collage-art',
    category: 'CivitAI',
    description: 'Vintage collage and mixed media style'
  },
  {
    id: 'creepcute',
    name: 'creepcute',
    displayName: 'Creepy Cute',
    source: 'https://civitai.com/models/788990/creepycute',
    category: 'CivitAI',
    description: 'Adorably unsettling aesthetic'
  },
  {
    id: 'cyberpunk-anime-style',
    name: 'cyberpunk-anime-style',
    displayName: 'Cyberpunk Anime',
    source: 'https://civitai.com/models/128568/cyberpunk-anime-style',
    category: 'CivitAI',
    description: 'Futuristic cyberpunk anime style'
  },
  {
    id: 'deco-pulse',
    name: 'deco-pulse',
    displayName: 'Art Deco Pulse',
    source: 'https://civitai.com/models/720587/decopulse-flux',
    category: 'CivitAI',
    description: 'Art Deco geometric patterns and style'
  },
  {
    id: 'deep-sea-particle-enhencer',
    name: 'deep-sea-particle-enhencer',
    displayName: 'Deep Sea Particles',
    source: 'https://civitai.com/models/15452/paseer-moxin-assist-for-adding-colorful',
    category: 'CivitAI',
    description: 'Colorful underwater particle effects'
  },
  {
    id: 'faetastic-details',
    name: 'faetastic-details',
    displayName: 'Fantasy Details',
    source: 'https://civitai.com/models/643886/flux-faetastic-details',
    category: 'CivitAI',
    description: 'Enhanced fantasy and magical details'
  },
  {
    id: 'fractal-geometry',
    name: 'fractal-geometry',
    displayName: 'Fractal Geometry',
    source: 'https://civitai.com/models/269592/fractal-geometry-style-fluxsdxl15',
    category: 'CivitAI',
    description: 'Mathematical fractal patterns'
  },
  {
    id: 'galactixy-illustrations-style',
    name: 'galactixy-illustrations-style',
    displayName: 'Galaxy Illustrations',
    source: 'https://civitai.com/models/747833/galactixy-illustrations-style',
    category: 'CivitAI',
    description: 'Cosmic and space-themed illustration style'
  },
  {
    id: 'geometric-woman',
    name: 'geometric-woman',
    displayName: 'Geometric Portrait',
    source: 'https://civitai.com/models/103528/geometric-woman',
    category: 'CivitAI',
    description: 'Geometric stylized portraits'
  },
  {
    id: 'graphic-portrait',
    name: 'graphic-portrait',
    displayName: 'Graphic Portrait',
    source: 'https://civitai.com/models/170039/graphic-portrait',
    category: 'CivitAI',
    description: 'Bold graphic design portraits'
  },
  {
    id: 'mat-miller-art',
    name: 'mat-miller-art',
    displayName: 'Mat Miller Art Style',
    source: 'https://civitai.com/models/894974/mat-miller-art-style',
    category: 'CivitAI',
    description: 'Psychedelic surreal art style'
  },
  {
    id: 'moebius-style',
    name: 'moebius-style',
    displayName: 'Moebius Comic Style',
    source: 'https://civitai.com/models/682651/moebius-style-flux',
    category: 'CivitAI',
    description: 'Classic European comic book style'
  },
  {
    id: 'ob3d-isometric-3d-room',
    name: 'ob3d-isometric-3d-room',
    displayName: 'Isometric 3D Room',
    source: 'https://civitai.com/models/555323/ob3d-isometric-3d-room-v20',
    category: 'CivitAI',
    description: '3D isometric room layouts'
  },
  {
    id: 'paper-quilling-and-layering-style',
    name: 'paper-quilling-and-layering-style',
    displayName: 'Paper Quilling Art',
    source: 'https://civitai.com/models/860403/paper-quilling-and-layering-style-flux',
    category: 'CivitAI',
    description: 'Layered paper craft and quilling style'
  }
];

// Helper functions
export const getLoRAModelById = (id: string): LoRAModel | undefined => {
  return LORA_MODELS.find(model => model.id === id);
};

export const getLoRAModelsByCategory = (category: 'XLabs' | 'CivitAI'): LoRAModel[] => {
  return LORA_MODELS.filter(model => model.category === category);
};

// Default LoRA strength ranges - imported from config
const loraLimits = getLoRAStrengthLimits();

export const DEFAULT_LORA_STRENGTH = getDefaultLoRAStrength();
export const MIN_LORA_STRENGTH = loraLimits.min;
export const MAX_LORA_STRENGTH = loraLimits.max;