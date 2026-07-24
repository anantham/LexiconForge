import { extractBalancedJson } from '../ai/textUtils';
import type {
  AnatomistPass,
  AnatomistSegment,
  CanonicalSegment,
  PhaseView,
  SourceRef,
} from '../../types/suttaStudio';

export const stripCodeFences = (text: string): string => {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
};

export const parseJsonResponse = <T>(raw: string): T => {
  const cleaned = stripCodeFences(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    const balanced = extractBalancedJson(cleaned);
    return JSON.parse(balanced) as T;
  }
};

export type PhaseStageKey = 'anatomist' | 'lexicographer' | 'weaver' | 'typesetter';

/** v12-b sliding window default: include up to N most-recent prior phases in context. */
export const V12_PRIOR_PHASES_WINDOW = 3;

/**
 * Formats prior compiled phases as a compact summary block.
 *
 * v12-b (sliding-window prior context, 2026-05-14) — closes the cross-phase
 * narrative gap that v11 couldn't bridge from a single-phase prompt window.
 * The LLM now sees what it (or the curator) wrote for the most-recent N
 * phases and can:
 *   - Cross-reference recurring lemmas with prior appearances
 *   - Detect parallel grammatical structures
 *   - Observe formula chains and conceptual pivots
 *
 * Per docs/sutta-studio/GROUNDING.md anti-pattern guard: this gives the LLM
 * STRUCTURED prior context (segments, anchor, key lemmas) but NOT free-form
 * curator narrative — the LLM should synthesize its own observations, not
 * parrot prior tooltips. The CROSS_PHASE amendment in V2 prompts already
 * tells it how to use this context.
 */
export const formatPriorPhasesContext = (
  priorPhases: PhaseView[]
): string => {
  if (!priorPhases.length) return '';

  const lines = ['=== PRIOR PHASES CONTEXT (read-only, last ' + priorPhases.length + ') ==='];

  for (const phase of priorPhases) {
    const paliWords = phase.paliWords ?? [];
    const fullPali = paliWords
      .map((w) => w.segments.map((s) => s.text).join(''))
      .join(' ');
    const anchor = paliWords.find((w) => w.isAnchor);
    const anchorPali = anchor
      ? anchor.segments.map((s) => s.text).join('')
      : null;
    const anchorEnglish = anchor?.senses?.[0]?.english ?? null;

    // Key lemmas: distinct segment texts (lemma-ish surface), short list
    const lemmas = new Set<string>();
    for (const w of paliWords) {
      for (const seg of w.segments) {
        if (seg.text && seg.text.length >= 3) lemmas.add(seg.text);
      }
    }
    const lemmasList = Array.from(lemmas).slice(0, 8).join(', ');

    lines.push('');
    lines.push(`${phase.id}${phase.title ? ` — ${phase.title}` : ''}`);
    if (fullPali) lines.push(`  Pāli: ${fullPali}`);
    if (anchorPali && anchorEnglish) {
      lines.push(`  Anchor: ${anchorPali} ("${anchorEnglish}")`);
    }
    if (lemmasList) lines.push(`  Key lemmas: ${lemmasList}`);
  }

  lines.push('');
  lines.push('Use this context to:');
  lines.push(
    '  - cross-reference recurring lemmas (per V2 CROSS_PHASE AWARENESS rules)'
  );
  lines.push('  - detect parallel grammatical structures');
  lines.push('  - observe formula chains / conceptual pivots');
  lines.push('Do NOT hallucinate references — only reference lemmas actually appearing above.');
  lines.push('=== END PRIOR PHASES CONTEXT ===');

  return lines.join('\n');
};

export const buildPhaseStateEnvelope = (params: {
  workId: string;
  phaseId: string;
  segments: CanonicalSegment[];
  currentStageLabel: string;
  currentStageKey?: PhaseStageKey;
  completed?: Partial<Record<PhaseStageKey, boolean>>;
  /** v12-b: most-recent prior compiled phases (sliding window, default 3). */
  priorPhases?: PhaseView[];
}) => {
  const {
    workId,
    phaseId,
    segments,
    currentStageLabel,
    currentStageKey,
    completed,
    priorPhases,
  } = params;
  const start = segments[0]?.ref.segmentId ?? 'n/a';
  const end = segments[segments.length - 1]?.ref.segmentId ?? start;
  const stages: Array<{ key: PhaseStageKey; label: string }> = [
    { key: 'anatomist', label: 'Anatomist' },
    { key: 'lexicographer', label: 'Lexicographer' },
    { key: 'weaver', label: 'Weaver' },
    { key: 'typesetter', label: 'Typesetter' },
  ];
  const statusLines = stages.map((stage) => {
    const done = Boolean(completed?.[stage.key]);
    const inProgress = !done && currentStageKey === stage.key;
    const stateLabel = done ? 'complete' : inProgress ? 'IN PROGRESS' : 'pending';
    return `${done ? '[x]' : '[ ]'} ${stage.label}: ${stateLabel}`;
  });

  const sections = [
    '=== PHASE STATE (READ ONLY) ===',
    `• Work: ${workId}`,
    `• Phase: ${phaseId}`,
    `• Segments: ${start} — ${end}`,
    `• Current Stage: ${currentStageLabel}`,
    '',
    'STATUS CHECK:',
    ...statusLines,
    '',
    'INVARIANTS:',
    '1) Do NOT add/remove Pali IDs (p1, p2...).',
    '2) Segment texts must concatenate to the surface text exactly.',
    '3) Preserve source word order and spelling (no normalization).',
    '===============================',
  ];

  if (priorPhases && priorPhases.length > 0) {
    const priorContext = formatPriorPhasesContext(priorPhases);
    if (priorContext) {
      sections.push('');
      sections.push(priorContext);
    }
  }

  return sections.join('\n');
};

export const getTimeoutSignal = (ms: number, external?: AbortSignal): AbortSignal | undefined => {
  if (external && typeof AbortSignal !== 'undefined' && 'any' in AbortSignal) {
    return AbortSignal.any([external, AbortSignal.timeout(ms)]);
  }
  if (external) return external;
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return AbortSignal.timeout(ms);
  }
  return undefined;
};

export const waitFor = (ms: number, signal?: AbortSignal): Promise<void> => {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(new Error('Compiler throttle aborted.'));
    };
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        reject(new Error('Compiler throttle aborted.'));
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
};

export const createCompilerThrottle = (minGapMs: number) => {
  let nextAllowedAt = 0;
  return async (signal?: AbortSignal) => {
    if (!minGapMs || minGapMs <= 0) return;
    const now = Date.now();
    const waitMs = Math.max(0, nextAllowedAt - now);
    if (waitMs > 0) {
      await waitFor(waitMs, signal);
    }
    nextAllowedAt = Date.now() + minGapMs;
  };
};

export const buildSourceRefs = (
  segmentIds: string[],
  segmentIdToWorkId: Map<string, string>,
  fallbackWorkId: string
): SourceRef[] =>
  segmentIds.map((id) => ({
    provider: 'suttacentral',
    workId: segmentIdToWorkId.get(id) || fallbackWorkId,
    segmentId: id,
  }));

export const computeSourceDigest = (segments: CanonicalSegment[]): string => {
  const text = segments.map((seg) => seg.pali).join('\n');
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
};

export type BoundaryNote = {
  workId: string;
  startSegmentId: string;
  afterSegmentId?: string;
};

export const buildBoundaryContext = (boundaries: BoundaryNote[], allowCrossChapter: boolean) => {
  if (!boundaries.length) return '';
  const lines = boundaries
    .map((b) =>
      b.afterSegmentId
        ? `- ${b.workId} begins at ${b.startSegmentId} (after ${b.afterSegmentId})`
        : `- ${b.workId} begins at ${b.startSegmentId}`
    )
    .join('\n');
  const rule = allowCrossChapter
    ? 'Boundary map provided (cross-chapter phases are allowed).'
    : 'Boundary map provided: do not place segments from different works in the same phase.';
  return `\n${rule}\n${lines}\n`;
};

export type SkeletonPhase = {
  id: string;
  title?: string;
  segmentIds: string[];
  wordRange?: [number, number];
};

/**
 * Apply wordRange slicing to phase segments when sub-segment splitting is used.
 * When wordRange is present, slice the Pali text to only include the specified word indices.
 * English is NOT sliced - the full text is passed through for the weaver to handle mapping.
 */
export const applyWordRangeToSegments = (
  segments: CanonicalSegment[],
  wordRange?: [number, number]
): CanonicalSegment[] => {
  if (!wordRange || segments.length === 0) return segments;

  const [start, end] = wordRange;
  const fullPali = segments.map((s) => s.pali).join(' ');
  const paliWords = fullPali.split(/\s+/).filter(Boolean);
  const slicedPali = paliWords.slice(start, end).join(' ');

  const fullEnglish = segments
    .map((s) => s.baseEnglish || '')
    .filter(Boolean)
    .join(' ');

  return [
    {
      ref: segments[0].ref,
      order: segments[0].order,
      pali: slicedPali,
      baseEnglish: fullEnglish || undefined,
    },
  ];
};

export const chunkPhases = (
  segments: CanonicalSegment[],
  size = 8,
  boundaryStarts?: Set<string>
) => {
  const phases: Array<{ id: string; title?: string; segmentIds: string[] }> = [];
  let buffer: CanonicalSegment[] = [];
  const flush = () => {
    if (!buffer.length) return;
    phases.push({
      id: `phase-${phases.length + 1}`,
      title: undefined,
      segmentIds: buffer.map((seg) => seg.ref.segmentId),
    });
    buffer = [];
  };
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (boundaryStarts?.has(seg.ref.segmentId) && buffer.length) {
      flush();
    }
    buffer.push(seg);
    if (buffer.length >= size) flush();
  }
  flush();
  return phases;
};

// ─────────────────────────────────────────────────────────────────────────────
// Anatomist surface repair
// ─────────────────────────────────────────────────────────────────────────────

export type SurfaceRepair = {
  wordId: string;
  from: string;
  to: string;
  collapsed: boolean;
};

export type SurfaceRepairResult = {
  pass: AnatomistPass;
  repairs: SurfaceRepair[];
  /** Set when repair could not be attempted (e.g. word/token count mismatch). */
  skippedReason?: string;
};

/**
 * Split canonical Pāli into display words. Whitespace separates words, and so
 * does an em-dash — bilara joins list items like "seyyathidaṁ—sammādiṭṭhi"
 * into one whitespace token, but models (correctly) render them as separate
 * words. The dash stays attached to the LEFT word so display keeps it.
 */
export const splitPaliTokens = (text: string): string[] =>
  (text || '')
    .normalize('NFC')
    .split(/\s+/)
    .flatMap((tok) => tok.split(/(?<=—)/))
    .filter(Boolean);

/**
 * Force every Anatomist word back onto the canonical surface text.
 *
 * The anatomist prompt already demands that segment texts concatenate to the
 * exact surface (SUTTA-025), but models still re-expand sandhi a few percent
 * of the time (sāsavā → sa|āsavā, lokuttara → loka|uttara) or rewrite words
 * outright (atthi → asthi). The compiler KNOWS the true text — the phase's
 * canonical Pāli — so displaying a corrupted sacred text is never necessary:
 *
 * - word.surface is forced to the canonical token
 * - a single-segment word gets its segment text replaced
 * - a multi-segment word whose concat mismatches is COLLAPSED to one
 *   surface-true segment; the split's pedagogy survives in merged tooltips
 *   plus an "Underlying analysis" note
 *
 * The prompt's word-boundary rule guarantees one word per whitespace token in
 * order, so alignment is positional. If the model dropped or merged words the
 * counts disagree and we skip (never guess) — the packet validator reports
 * whatever remains.
 */
export const repairAnatomistSurfaces = (
  pass: AnatomistPass,
  paliText: string
): SurfaceRepairResult => {
  const nfc = (s: string) => (s || '').normalize('NFC');
  const tokens = splitPaliTokens(paliText);
  const words = pass.words || [];
  if (tokens.length === 0 || words.length !== tokens.length) {
    return {
      pass,
      repairs: [],
      skippedReason: `word/token count mismatch (${words.length} words vs ${tokens.length} tokens)`,
    };
  }

  const repairs: SurfaceRepair[] = [];
  const removedToSurvivor = new Map<string, string>();
  let newWords = [...words];
  let newSegments = [...(pass.segments || [])];

  words.forEach((word, i) => {
    const expected = tokens[i];
    const byId = new Map(newSegments.map((s) => [s.id, s]));
    const ordered = (word.segmentIds || [])
      .map((id) => byId.get(id))
      .filter((s): s is AnatomistSegment => Boolean(s));
    const segs = ordered.length
      ? ordered
      : newSegments.filter((s) => s.wordId === word.id);
    const concat = segs.map((s) => s.text || '').join('');
    const concatOk = nfc(concat) === nfc(expected);
    const surfaceOk = nfc(word.surface || '') === nfc(expected);
    if (concatOk && surfaceOk) return;

    if (concatOk) {
      // Segments are surface-true; only the word.surface field drifted.
      newWords = newWords.map((w) => (w.id === word.id ? { ...w, surface: expected } : w));
      repairs.push({ wordId: word.id, from: word.surface || '', to: expected, collapsed: false });
      return;
    }

    if (segs.length <= 1) {
      const target = segs[0];
      if (target) {
        newSegments = newSegments.map((s) => (s.id === target.id ? { ...s, text: expected } : s));
      }
      newWords = newWords.map((w) => (w.id === word.id ? { ...w, surface: expected } : w));
      repairs.push({ wordId: word.id, from: concat || word.surface || '', to: expected, collapsed: false });
      return;
    }

    // Punctuation-only mismatch on a multi-segment word (models often drop a
    // trailing comma or leading quote): absorb the edge punctuation into the
    // boundary segments instead of destroying the morpheme split for a comma.
    const edges = nfc(expected).match(/^([^a-zA-ZāīūṁṃṅñṭḍṇḷĀĪŪṀṂṄÑṬḌṆḶ]*)(.*?)([^a-zA-ZāīūṁṃṅñṭḍṇḷĀĪŪṀṂṄÑṬḌṆḶ]*)$/u);
    if (edges && nfc(concat) === edges[2]) {
      const [, lead, , trail] = edges;
      const firstId = segs[0].id;
      const lastId = segs[segs.length - 1].id;
      newSegments = newSegments.map((s) => {
        if (s.id === firstId && s.id === lastId) return { ...s, text: lead + s.text + trail };
        if (s.id === firstId && lead) return { ...s, text: lead + s.text };
        if (s.id === lastId && trail) return { ...s, text: s.text + trail };
        return s;
      });
      newWords = newWords.map((w) => (w.id === word.id ? { ...w, surface: expected } : w));
      repairs.push({ wordId: word.id, from: concat, to: expected, collapsed: false });
      return;
    }

    // Multi-segment mismatch: collapse to one surface-true segment, keep the
    // morphological pedagogy in tooltips.
    const survivor = segs[0];
    const seen = new Set<string>();
    const mergedTooltips = segs
      .flatMap((s) => s.tooltips || [])
      .filter((t) => (seen.has(t) ? false : (seen.add(t), true)));
    const analysisNote = `Underlying analysis: ${segs.map((s) => s.text).filter(Boolean).join(' + ')}`;
    const tooltips = [...mergedTooltips, analysisNote].slice(0, 8);
    const removedIds = new Set(segs.slice(1).map((s) => s.id));
    removedIds.forEach((id) => removedToSurvivor.set(id, survivor.id));
    newSegments = newSegments
      .filter((s) => !removedIds.has(s.id))
      .map((s) => (s.id === survivor.id ? { ...s, text: expected, tooltips } : s));
    newWords = newWords.map((w) =>
      w.id === word.id ? { ...w, surface: expected, segmentIds: [survivor.id] } : w
    );
    repairs.push({ wordId: word.id, from: concat, to: expected, collapsed: true });
  });

  if (repairs.length === 0) return { pass, repairs: [] };

  const relations = (pass.relations || []).map((r) => {
    const mapped = removedToSurvivor.get(r.fromSegmentId);
    return mapped ? { ...r, fromSegmentId: mapped } : r;
  });

  return {
    pass: { ...pass, words: newWords, segments: newSegments, relations },
    repairs,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Partition-aware surface matching
// ─────────────────────────────────────────────────────────────────────────────

export type SurfaceMatchResult = {
  /** words considered (empty-letter words are skipped, matching prior semantics) */
  total: number;
  mismatched: number;
  /** indexes INTO THE FILTERED word list of the words no partition could place */
  mismatchedIdx: number[];
};

/**
 * Partition-aware surface check (metric v2 of "surface integrity").
 *
 * Exact-token membership wrongly flags legitimate pedagogy: curators split
 * one canonical whitespace token into several teaching words — quotative ti
 * ("Bhikkhavo"ti → "Bhikkhavo" + ti), sandhi compounds (etadavoca → etad +
 * avoca, satova → sato + va). The flagship page carried 46 such false flags.
 *
 * Rule: a run of up to maxGroup CONSECUTIVE rendered words whose letters
 * concatenate to SOME canonical token's letters is matched. Dynamic program
 * minimizes mismatches (skipping a word costs 1), so one genuinely corrupt
 * word cannot strand its neighbours. Single-word matches are the trivial
 * group, so this is strictly more lenient than exact membership — and still
 * rejects the cross-boundary rides exact membership was tightened to reject
 * (a lone "vaā" matches no full token's letters).
 */
export const partitionSurfaceMismatches = (
  wordLetters: string[],
  canonTokenLetters: ReadonlySet<string>,
  maxGroup = 4
): SurfaceMatchResult => {
  const words = wordLetters.filter((w) => w.length > 0);
  const n = words.length;
  // cost[i] = min mismatches for suffix starting at i; choice[i] = group end j (or -1 = skip)
  const cost = new Array<number>(n + 1).fill(0);
  const choice = new Array<number>(n).fill(-1);
  for (let i = n - 1; i >= 0; i--) {
    let best = 1 + cost[i + 1]; // skip word i as a mismatch
    let pick = -1;
    let concat = '';
    for (let j = i; j < Math.min(n, i + maxGroup); j++) {
      concat += words[j];
      if (canonTokenLetters.has(concat) && cost[j + 1] < best) {
        best = cost[j + 1];
        pick = j;
      }
    }
    cost[i] = best;
    choice[i] = pick;
  }
  const mismatchedIdx: number[] = [];
  let i = 0;
  while (i < n) {
    if (choice[i] === -1) {
      mismatchedIdx.push(i);
      i += 1;
    } else {
      i = choice[i] + 1;
    }
  }
  return { total: n, mismatched: cost[0], mismatchedIdx };
};

export type EnglishStructureRepairStats = {
  /** Tokens dropped because their linked word/segment does not exist (repair
   *  renumbered anatomist words without remapping englishStructure). */
  droppedDangling: number;
  /** Repeat gloss tokens collapsed: segment-level links with NO segment senses
   *  render the parent word's gloss once per morpheme ("right view right view"). */
  collapsedStutter: number;
};

/**
 * Repair an englishStructure for faithful rendering (reader-report II classes).
 *
 * 1. DANGLING: a token linking a word/segment that does not exist renders as an
 *    empty pill — dropped.
 * 2. STUTTER: the weaver emits one token per SEGMENT (morpheme-level alignment),
 *    but when those segments carry no senses the view can only render the parent
 *    word's gloss per token, printing it once per morpheme. Repeats collapse to
 *    the first token, promoted to a word-level link so hovering ANY morpheme
 *    lights it (whole-word bidirectional behaviour).
 *
 * Deliberately untouched: ghosts; explicit word-level links (the flagship links
 * the same word twice on purpose — "or … or" for a repeated vā); segment links
 * whose segment HAS its own senses (true morpheme-level alignment, the future
 * path). Pure — used by the view at render time as a backstop and by
 * scripts/sutta-studio/repair-english-structure.ts to fix packets at rest.
 */
export const repairEnglishStructure = (phase: {
  paliWords: Array<{ id: string; segments: Array<{ id?: string; senses?: unknown[] }> }>;
  englishStructure?: Array<Record<string, any>>;
}): { tokens: Array<Record<string, any>>; stats: EnglishStructureRepairStats } => {
  const wordIds = new Set(phase.paliWords.map((w) => w.id));
  const segToWord = new Map<string, string>();
  const segHasSenses = new Map<string, boolean>();
  for (const w of phase.paliWords) {
    for (const seg of w.segments ?? []) {
      if (!seg.id) continue;
      segToWord.set(seg.id, w.id);
      segHasSenses.set(seg.id, Boolean(seg.senses && seg.senses.length > 0));
    }
  }

  const stats: EnglishStructureRepairStats = { droppedDangling: 0, collapsedStutter: 0 };
  const tokens: Array<Record<string, any>> = [];
  /** wordId → index in `tokens` of the token already rendering its gloss. */
  const glossRenderedAt = new Map<string, number>();

  for (const t of phase.englishStructure ?? []) {
    if (t.isGhost) {
      tokens.push(t);
      continue;
    }
    if (t.linkedPaliId) {
      if (!wordIds.has(t.linkedPaliId)) {
        stats.droppedDangling += 1;
        continue;
      }
      if (!glossRenderedAt.has(t.linkedPaliId)) glossRenderedAt.set(t.linkedPaliId, tokens.length);
      tokens.push(t); // word-level links always render (intentional repetition allowed)
      continue;
    }
    if (t.linkedSegmentId) {
      const wid = segToWord.get(t.linkedSegmentId);
      if (!wid) {
        stats.droppedDangling += 1;
        continue;
      }
      if (segHasSenses.get(t.linkedSegmentId)) {
        tokens.push(t); // true morpheme-level sense — render as-is
        continue;
      }
      const at = glossRenderedAt.get(wid);
      if (at === undefined) {
        glossRenderedAt.set(wid, tokens.length);
        tokens.push(t);
        continue;
      }
      // Repeat gloss with no distinct segment sense → stutter. Drop, and promote
      // the kept token (if segment-linked) to word level for whole-word hover.
      stats.collapsedStutter += 1;
      const kept = tokens[at];
      if (kept && !kept.isGhost && kept.linkedSegmentId && !kept.linkedPaliId) {
        const { linkedSegmentId: _dropped, ...rest } = kept;
        tokens[at] = { ...rest, linkedPaliId: wid };
      }
      continue;
    }
    tokens.push(t); // unlinked non-ghost token — leave as authored
  }

  return { tokens, stats };
};
