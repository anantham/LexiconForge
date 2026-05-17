# Sutta Studio IR (Deep Loom) - MVP Schema

> **⚠️ SUPERSEDED — historical reference only.**
>
> This document describes the original MVP schema (last verified 2026-03-05).
> Since then the IR has been substantially extended: grounding provenance
> (`Sense.epistemicBasis`, `sourceCitationIds`, `Provenance`, `ParallelRef`,
> `CompoundType`) per SUTTA-008; the grounding pass per the FEATURES.md
> pipeline; commentarial-gloss + translator-bank providers. Do not use this
> file as source.
>
> **Authoritative sources:**
> - TypeScript types: `types/suttaStudio.ts`
> - Architecture + pipeline: `docs/sutta-studio/FEATURES.md`
> - Provenance layer: `docs/adr/SUTTA-008-grounded-curation-data-layer.md`
> - Transmission graph: `docs/sutta-studio/TEXT_GRAPH.md`

## Goals
- Represent Pali source text as canonical segments (stable IDs).
- Provide a derived phase view for UI rendering (polysemy, ghosts, tethers).
- Keep the schema minimal but extensible for reruns and future models.

---

## Canonical Source Layer (source of truth)
```ts
type SourceProvider = "suttacentral";

type SourceRef = {
  provider: SourceProvider;
  workId: string;     // e.g. "mn10"
  segmentId: string;  // e.g. "mn10:1.1"
};

type CanonicalSegment = {
  ref: SourceRef;
  order: number;
  pali: string;
  baseEnglish?: string; // optional: SuttaCentral translation segment
  html?: string;        // optional: future structure layer
};
```

---

## Citations Registry
```ts
type Citation = {
  id: string;          // stable internal id: "analayo-2003-satipatthana"
  kind: "sutta" | "book" | "paper" | "web";
  short: string;       // "MN 10", "Analayo 2003"
  detail?: string;
  url?: string;
};
```

---

## Derived Phase View (UI projection)
```ts
type RelationType = "ownership" | "direction" | "location" | "action";

type MorphHint = {
  case?: "gen" | "dat" | "loc" | "ins" | "acc" | "nom" | "voc";
  number?: "sg" | "pl";
  note?: string;
};

type Translation = {
  id: string;                 // stable sense id, e.g. "ekayano.direct"
  english: string;
  nuance: string;
  notes?: string;
  citationIds?: string[];     // references into citations registry
  ripples?: Record<string, string>; // ghostId -> replacement text
};

type WordSegment = {
  text: string;
  type: "root" | "suffix" | "prefix" | "stem";
  tooltips?: string[];             // legacy
  tooltip?: string;                // default
  tooltipsBySenseId?: Record<string, string>;
  morph?: MorphHint;
  relation?: {
    targetWordId: string;
    type: RelationType;
    label: string;
    status?: "confirmed" | "pending";
  };
};

type PaliWord = {
  id: string;                 // stable within packet
  sourceRefs: SourceRef[];    // maps back to canonical segments
  segments: WordSegment[];
  senses: Translation[];
  isAnchor?: boolean;
  displayColor?: string;      // optional UI hint
};

type EnglishToken = {
  id: string;
  label?: string;
  linkedPaliWordId?: string;
  isGhost?: boolean;
  ghostKind?: "required" | "interpretive";
};

type PhaseView = {
  id: string;                 // "phase-1"
  title?: string;
  sourceSpan: SourceRef[];    // which canonical segments this phase covers
  paliWords: PaliWord[];
  englishStructure: EnglishToken[];
  unresolved?: Array<{
    kind: "relation_target_missing" | "unknown_morphology" | "citation_needed";
    note: string;
  }>;
};
```

---

## IR Container (embedded in Chapter)
```ts
type SuttaStudioIR = {
  version: "v1";
  source: {
    provider: SourceProvider;
    workId: string;  // "mn10"
    workIds?: string[]; // optional stitched bundle, e.g. ["mn10", "mn11"]
    author: string;  // "sujato"
    lang: string;    // "en"
    canonicalUrl: string;
  };
  canonicalSegments: CanonicalSegment[];
  phases: PhaseView[];
  citations: Citation[];
  renderDefaults: {
    ghostOpacity: number;        // 0.3
    englishVisible: boolean;     // true
    studyToggleDefault: boolean; // true
  };
  compiler: {
    provider: "openrouter" | "openai" | "local";
    model: string;
    promptVersion: string;
    createdAtISO: string;
    sourceDigest: string;        // hash(canonicalSegments.pali)
    validatorVersion?: string;
    validationIssues?: Array<{
      level: "warn" | "error";
      code: string;
      message: string;
      phaseId?: string;
      wordId?: string;
      segmentIndex?: number;
      tokenId?: string;
    }>;
  };
};
```

---

## Grammar Palette (UI mapping)
- ownership → "OF" → gold
- direction → "TO/FOR" → blue
- location → "IN/AT" → green
- action → "BY/WITH" → orange

---

## Pipeline (Skeleton → Phase Deltas → Validator)
1) Skeleton pass (global): phases, anchors, ghost scaffolding.  
2) Phase deltas (per unit/phase): word segmentation, senses, relations, ripples.  
3) Validator pass: resolve ids, enforce schema, list unresolved.  

---

## Minimal Example
```json
{
  "version": "v1",
  "source": {
    "provider": "suttacentral",
    "workId": "mn10",
    "author": "sujato",
    "lang": "en",
    "canonicalUrl": "https://suttacentral.net/mn10/en/sujato"
  },
  "canonicalSegments": [
    {
      "ref": { "provider": "suttacentral", "workId": "mn10", "segmentId": "mn10:1.1" },
      "order": 1,
      "pali": "Evam me sutam",
      "baseEnglish": "So I have heard."
    }
  ],
  "phases": [
    {
      "id": "phase-1",
      "sourceSpan": [{ "provider": "suttacentral", "workId": "mn10", "segmentId": "mn10:1.1" }],
      "paliWords": [
        {
          "id": "p1",
          "sourceRefs": [{ "provider": "suttacentral", "workId": "mn10", "segmentId": "mn10:1.1" }],
          "segments": [{ "text": "evam", "type": "stem" }],
          "senses": [
            { "id": "evam.thus", "english": "thus", "nuance": "reporting" },
            { "id": "evam.so", "english": "so", "nuance": "narration" }
          ]
        }
      ],
      "englishStructure": [
        { "id": "e1", "linkedPaliWordId": "p1" },
        { "id": "g1", "label": "is", "isGhost": true }
      ]
    }
  ],
  "citations": [{ "id": "mn10", "kind": "sutta", "short": "MN 10" }],
  "renderDefaults": {
    "ghostOpacity": 0.3,
    "englishVisible": true,
    "studyToggleDefault": true
  },
  "compiler": {
    "provider": "openrouter",
    "model": "google/gemini-2.5-flash",
    "promptVersion": "v0",
    "createdAtISO": "2026-01-26T00:00:00.000Z",
    "sourceDigest": "sha256:..."
  }
}
```
