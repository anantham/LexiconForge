import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';

export type StudioSettings = {
  tooltips: boolean;
  emojiInTooltips: boolean;
  grammarTerms: boolean;
  grammarArrows: boolean;
  refrainColors: boolean;
  alignmentLines: boolean;
  ghostWords: boolean;
  // cycleDots: small dots under English words linked to multi-sense Pāli — shows
  // count + current position. Off = hide the affordance even though clicking
  // still cycles.
  cycleDots: boolean;
  // V2 audit/metadata fields — toggle to A/B which ones earn their packet bulk.
  // auditPanel: opens the LensPanel side drawer for the hovered word, showing
  //   full sense data (notes, citations, confidence, basis tags). When OFF, the
  //   drawer never appears.
  // anchorEmphasis: subtle amber underline on PaliWord.isAnchor === true.
  // senseNotes: per-sense `notes` prose in the audit panel.
  // citationChips: per-sense `citationIds` rendered as chips in the audit panel.
  // confidenceBadges: per-sense `confidence` ('high'/'medium'/'low') + `epistemicBasis`
  //   ('lexical'/'curatorial'/'etymological'/...) tags in the audit panel.
  auditPanel: boolean;
  anchorEmphasis: boolean;
  senseNotes: boolean;
  citationChips: boolean;
  confidenceBadges: boolean;
  // legend: visual reference panel showing color/symbol vocabulary once.
  // Replaces the deleted "Colored differently because…" per-word meta-commentary.
  legend: boolean;
};

export const DEFAULT_SETTINGS: StudioSettings = {
  tooltips: true,
  emojiInTooltips: true,
  grammarTerms: false,
  grammarArrows: true,
  refrainColors: false,
  alignmentLines: true,
  ghostWords: true,
  cycleDots: true,
  // Audit panel OFF by default — opt-in for empirical evaluation.
  auditPanel: false,
  anchorEmphasis: true,
  senseNotes: true,
  citationChips: true,
  // Off by default. The 'confidence' + 'epistemicBasis' badges are useful for
  // curators auditing the data, confusing for end readers. Toggle on per session.
  confidenceBadges: false,
  legend: false,
};

const STORAGE_KEY = 'sutta-studio-settings';

export function loadSettings(): StudioSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: StudioSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

type SettingToggleProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function SettingToggle({ label, checked, onChange }: SettingToggleProps) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer hover:bg-slate-800/50 px-3 -mx-3 rounded">
      <span className="text-slate-300 text-sm">{label}</span>
      <div
        onClick={(e) => {
          e.preventDefault();
          onChange(!checked);
        }}
        className={`w-8 h-4 rounded-full p-0.5 transition-colors ${
          checked ? 'bg-emerald-500' : 'bg-slate-600'
        }`}
      >
        <motion.div
          layout
          className="w-3 h-3 bg-white rounded-full"
          animate={{ x: checked ? 14 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </div>
    </label>
  );
}

type SettingsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  settings: StudioSettings;
  onSettingsChange: (settings: StudioSettings) => void;
};

export function SettingsPanel({ isOpen, onClose, settings, onSettingsChange }: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    // Delay to avoid closing immediately on open click
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const updateSetting = <K extends keyof StudioSettings>(key: K, value: StudioSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    onSettingsChange(newSettings);
    saveSettings(newSettings);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="absolute top-12 right-0 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-[100] overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-slate-700">
            <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">Settings</span>
          </div>
          <div className="p-3 space-y-1">
            <SettingToggle
              label="Tooltips"
              checked={settings.tooltips}
              onChange={(v) => updateSetting('tooltips', v)}
            />
            <SettingToggle
              label="Emoji in tooltips"
              checked={settings.emojiInTooltips}
              onChange={(v) => updateSetting('emojiInTooltips', v)}
            />
            <SettingToggle
              label="Grammar terms"
              checked={settings.grammarTerms}
              onChange={(v) => updateSetting('grammarTerms', v)}
            />
            <SettingToggle
              label="Grammar arrows"
              checked={settings.grammarArrows}
              onChange={(v) => updateSetting('grammarArrows', v)}
            />
            <SettingToggle
              label="Refrain colors"
              checked={settings.refrainColors}
              onChange={(v) => updateSetting('refrainColors', v)}
            />
            <SettingToggle
              label="Alignment lines"
              checked={settings.alignmentLines}
              onChange={(v) => updateSetting('alignmentLines', v)}
            />
            <SettingToggle
              label="Ghost words"
              checked={settings.ghostWords}
              onChange={(v) => updateSetting('ghostWords', v)}
            />
            <SettingToggle
              label="Cycle dots"
              checked={settings.cycleDots}
              onChange={(v) => updateSetting('cycleDots', v)}
            />
            <SettingToggle
              label="Legend"
              checked={settings.legend}
              onChange={(v) => updateSetting('legend', v)}
            />
          </div>

          <div className="px-3 py-2 border-t border-slate-700 mt-1">
            <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">Audit fields (V2)</span>
          </div>
          <div className="p-3 space-y-1">
            <SettingToggle
              label="Audit panel"
              checked={settings.auditPanel}
              onChange={(v) => updateSetting('auditPanel', v)}
            />
            <SettingToggle
              label="Anchor emphasis"
              checked={settings.anchorEmphasis}
              onChange={(v) => updateSetting('anchorEmphasis', v)}
            />
            <SettingToggle
              label="Sense notes"
              checked={settings.senseNotes}
              onChange={(v) => updateSetting('senseNotes', v)}
            />
            <SettingToggle
              label="Citation chips"
              checked={settings.citationChips}
              onChange={(v) => updateSetting('citationChips', v)}
            />
            <SettingToggle
              label="Confidence + basis"
              checked={settings.confidenceBadges}
              onChange={(v) => updateSetting('confidenceBadges', v)}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
