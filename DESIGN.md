# Design

## Theme

Dark. `bg-slate-950` (#020617) throughout. The surface is night-quiet — no ambient tint, no decorative dark-mode gradient. Text sits in open space with no containing boxes in the reading area. The darkness is not aesthetic; it is practical: practitioners often read in dim liturgy spaces or at night.

Color strategy: **Restrained with semantic Committed accents.** The base surface is near-monochrome (slate ramp). Color appears only in semantically meaningful roles (see Color section). No decorative tints.

## Color Palette

### Base surface ramp (cite: `components/sutta-studio/PaliWord.tsx`, `TripleScriptWitness.tsx`)

| Token | Value | Role |
|---|---|---|
| `bg-slate-950` | `#020617` | Page background, all reading areas |
| `bg-slate-900` | `#0f172a` | Hover backgrounds, tooltip panels, WitnessDots popover |
| `bg-slate-800` | `#1e293b` | Borders, dividers (sparse, never decorative) |
| `text-slate-100` | `#f1f5f9` | Primary chant / Pāli body text |
| `text-slate-300` | `#cbd5e1` | English translation lines (italic serif) |
| `text-slate-400` | `#94a3b8` | Secondary UI text, commentary, witness labels |
| `text-slate-500` | `#64748b` | Tertiary: transliteration lines, commentary prose, muted notes |

### Semantic accent palette (NOT decorative — each color means something specific)

**Interactive / hover (emerald):**
- `emerald-300` (`#6ee7b7`) — hovered chant word, active witness dot, alignment line stroke, active English word in Studio
- `emerald-400` (`#34d399`) — active WitnessDots filled dot
- `emerald-700/40` — default dotted underline on hoverable segments
- `emerald-900/50` — word focus ring in Studio (PaliWord `ring-1`)

**Three Jewels refrain accents (liturgy reader only — cite: `TripleScriptWitness.tsx` `ACCENT_CLASS`):**
- `amber-300` — Buddha refrain words
- `sky-300` — Dharma refrain words
- `rose-300` — Sangha refrain words
- `violet-300` — fourth accent role (available; used sparingly)

**Grammatical-relation palette (Sutta Studio only — cite: `components/sutta-studio/palette.ts`):**
- `amber-500` `#F59E0B` — ownership relation (●OF)
- `blue-500` `#3B82F6` — direction relation (→TO/FOR)
- `emerald-500` `#10B981` — location relation (▢IN/AT)
- `orange-500` `#F97316` — action relation (◆BY/WITH)

**Refrain formula colors (Sutta Studio, study mode — cite: `palette.ts` `REFRAIN_COLORS`):**
- Blue, yellow, green, purple, teal, amber, violet, rose — each reserved for a named formula/refrain type, rendered as underlines, never as backgrounds.

**CRITICAL:** No color outside this palette. No beige, no warm tint, no decorative gradient. Color = meaning.

## Typography

### Font stacks (cite: `TripleScriptWitness.tsx` `SCRIPT_FONT`)

| Script | Stack | Subtag |
|---|---|---|
| Latin / IAST | `'Cardo', 'Gentium Plus', 'Noto Serif', serif` | `Latn` |
| Devanāgarī | `'Noto Serif Devanagari', 'Cardo', serif` | `Deva` |
| Tibetan | `'Noto Serif Tibetan', 'Cardo', serif` | `Tibt` |
| Chinese (Trad) | `'Noto Serif SC', serif` | `Hant` / `Hans` |
| Japanese | `'Noto Serif JP', serif` | `Jpan` |
| Korean | `'Noto Serif KR', serif` | `Hang` |

All fonts are **classical serif**. No sans-serif in reading areas. Sans (`font-sans`) appears only for ghost/English tokens in Sutta Studio (`EnglishWord.tsx`) where the font contrast signals "English scaffolding vs. Pāli source."

### Size scale (cite: `TripleScriptWitness.tsx` `PaliLine`)

The reader exposes a `--liturgy-scale` CSS custom property for user-controlled zoom. All font sizes are `calc(Nrem * var(--liturgy-scale, 1))`.

| Context | Base size | Notes |
|---|---|---|
| Chant body (normal) | `1.5rem` | Latin baseline; CJK/Tibetan get ×1.1–1.2 multiplier |
| Chant body (opening, large) | `1.875rem` | Opening-treatment segments |
| English translation line | `1.125rem × 1.4 = ~1.575rem` | `ENGLISH_LINE_MULTIPLIER = 1.4` |
| Transliteration / pronunciation | `text-sm` (~0.875rem) | `italic text-slate-500` |
| Sutta Studio Pāli | `text-3xl md:text-5xl lg:text-6xl` | Very large — words as objects |
| Sutta Studio English | `text-xl md:text-2xl lg:text-3xl` | Subordinate to Pāli |
| Tooltip / gloss body | `text-[11px]` to `text-sm` | Small but readable on dark bg |

**Per-script size multipliers (cite: `SCRIPT_SIZE_MULTIPLIER`):**
- Latn: ×1.0, Deva: ×1.05, Hant/Hans: ×1.2, Jpan: ×1.2, Tibt: ×1.1, Hang: ×1.15

### Type rhythm

- `leading-loose` on Pāli lines, `leading-relaxed` on English/transliteration
- No tight tracking. `tracking-wide` only on transliteration lines (respelling, not chant)
- `italic` for English translations, commentary, and ghost words — italic = witness/supplied/commentary

## Layout

**Centered column, max-w-3xl** for all reading surfaces. Reading text never stretches full-width.

Sections separated by generous vertical space (`pt-16 pb-16`); opening sections use viewport-height framing (`min-h-[80vh]`). No cards, no panels framing the reading area.

**Section divider:** `border-t border-slate-900` — a single pixel line in the darkest non-background slate. Invisible unless you look for it; present to punctuate sections without boxing them.

**Spacing pattern:**
- Segment rows: `mb-8` per phrase pair (Pāli + English)
- `space-y-2` between segments within a section
- `mt-6` between Pāli line and its English translation within a segment
- Commentary / chanters' notes: `mt-10 max-w-2xl mx-auto text-center`

**Responsive:** reading area stays centered and narrows gracefully. Sutta Studio uses flex wrapping for word-level layout. No breakpoint-driven column layout changes inside the reading area.

## Components

### Hover tooltip (`components/sutta-studio/Tooltip.tsx`)
- Appears on `onMouseEnter`, dismissed on `onMouseLeave`; no persistent pin state in liturgy reader
- Dark background `bg-slate-900/85 border border-slate-800 shadow-lg`
- Small text `text-[11px]` or `text-sm`, `text-slate-300`
- When multiple facets exist (concept registry), click cycles; `text-[10px] text-slate-500` shows facet index
- Auto-flips to stay in viewport

### Dotted underline on hoverable words
- Default: `border-b border-dotted border-emerald-700/40` — barely visible hint of interactivity
- On hover: `border-emerald-300` — solid emerald, the text shifts to `text-emerald-100`
- Root morphemes render `font-semibold` (meaning-carriers are visually heavier)

### Ghost words (Sutta Studio, cite: `EnglishWord.tsx`)
- `italic font-serif` on ghost tokens (English-supplied scaffolding)
- `text-slate-400` default; 0.3–0.55 opacity depending on ghost kind
- Ghost subtypes carry distinct underlines: auxiliary → solid slate; pronoun-from-verb → dotted; interpretive → italic only; required → dotted slate-800

### Alignment lines (cite: `TripleScriptWitness.tsx` `AlignmentLines`)
- SVG overlay, `z-0`, `pointer-events-none`
- Stroke: `rgb(110, 231, 183)` (emerald-300 equivalent), `strokeOpacity: 0.9`, `strokeWidth: 2`
- Cubic bezier — near-vertical, gentle S-curve. Endpoint dots `r=2.5` in same color.
- Only renders on hover; filters by concept overlap when concept IDs are tagged.

### WitnessDots (cite: `TripleScriptWitness.tsx`)
- `w-1.5 h-1.5 rounded-full` dots — minimal affordance
- Active: `bg-emerald-400/70`; inactive: `border border-slate-700 bg-transparent`
- Hover reveals witness name in a tiny popover (same dark panel pattern as Tooltip)

### Repetition marker (three dots)
- `text-slate-500 text-2xl tracking-[0.5em]` — visual rhythm punctuation for 3× chants

### Settings controls
- Housed in `LiturgySettings`; surfaced as user-controlled toggles, not baked into the page
- `--liturgy-scale` CSS variable allows font scaling without reflowing page layout

## Motion

Uses `framer-motion` throughout for tooltip appear/exit and English word rotation in Studio.

- Tooltip: `AnimatePresence` wrapping — enter/exit via opacity or slide (short, `duration: 0.15`)
- English word rotation: `motion.span` with `initial/animate/exit` `opacity` + `y: 5/0/-5`, `duration: 0.15` — content rotates through senses without layout shift
- Word focus ring: CSS `transition-all duration-150` (no JS animation)
- Alignment lines: no animation on render — appear/disappear instantly on hover (hover is already the trigger; animating the line adds latency to what should feel instantaneous)

**Reduced motion:** any JS-driven animation that moves content or adjusts opacity must have a `@media (prefers-reduced-motion: reduce)` alternative. Framer-motion respects this if configured via `useReducedMotion`.

## Absolute Do-Nots (this project)

Beyond the shared impeccable bans:
- No cards or decorative container borders in the reading area
- No gradient text
- No decorative use of emerald or any semantic accent color
- No grammar jargon in reader-facing tooltip text (CURATION_PROTOCOL §3.4 hard gate)
- No warm tints (beige, sand, cream) — this is a dark-on-slate surface
- No serif/sans pairing in the *same* reading-area line (choose one per line; contrast comes from size and weight, not family mixing within a line)
- No sans-serif Pāli text
